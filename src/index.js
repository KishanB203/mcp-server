import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

import { validateConfig } from "./ado-client.js";
import { getWorkItem } from "./tools/get-ticket.js";
import { listWorkItems } from "./tools/list-tickets.js";
import { updateWorkItemState, addWorkItemComment } from "./tools/update-ticket.js";
import {
  getFigmaFile,
  runFigmaDesignWorkflow,
  addFigmaLinkToAdo,
} from "./figma-tools.js";
import productOwnerAgent from "./agents/product-owner-agent.js";
import architectAgent from "./agents/architect-agent.js";
import developerAgent from "./agents/developer-agent.js";
import reviewerAgent from "./agents/reviewer-agent.js";
import devopsAgent from "./agents/devops-agent.js";
import { generateBranchName, validateBranchName } from "./branch-naming.js";
import { preflightCheck } from "./conflict-prevention.js";

dotenv.config({
  path: new URL("../.env", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
});

// ─────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────
const TOOLS = [
  // ── ADO Tools ────────────────────────────────────────────────────────
  {
    name: "ado_get_work_item",
    description:
      "Fetches full details of an Azure DevOps work item by ID. Returns title, description, " +
      "acceptance criteria, state, priority, story points, comments, and relations.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Work item ID" } },
      required: ["id"],
    },
  },
  {
    name: "ado_list_work_items",
    description: "Lists Azure DevOps work items with optional filters (sprint, state, type, assignedTo).",
    inputSchema: {
      type: "object",
      properties: {
        sprint: { type: "string" },
        state: { type: "string" },
        type: { type: "string" },
        assignedTo: { type: "string" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "ado_update_work_item_state",
    description: "Updates the state of an ADO work item (e.g. 'In Progress', 'Done').",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number" },
        state: { type: "string" },
      },
      required: ["id", "state"],
    },
  },
  {
    name: "ado_add_comment",
    description: "Adds a comment to an Azure DevOps work item.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number" },
        comment: { type: "string" },
      },
      required: ["id", "comment"],
    },
  },

  // ── Figma Tools ──────────────────────────────────────────────────────
  {
    name: "figma_get_file",
    description:
      "Gets metadata for the configured Figma file. Use to verify Figma connection.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string", description: "Figma file key (defaults to FIGMA_FILE_KEY env var)" },
      },
      required: [],
    },
  },
  {
    name: "figma_generate_wireframe",
    description:
      "Generates a wireframe specification for a UI task and adds it to Figma as an annotation. " +
      "Also adds the Figma link to the ADO task. Use for any UI/frontend task.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "ADO task ID to generate wireframe for" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "figma_add_ado_link",
    description: "Adds a Figma link as a comment on an Azure DevOps task.",
    inputSchema: {
      type: "object",
      properties: {
        adoTaskId: { type: "number" },
        figmaUrl: { type: "string" },
        figmaFileName: { type: "string" },
      },
      required: ["adoTaskId", "figmaUrl"],
    },
  },

  // ── Branch & Conflict Tools ──────────────────────────────────────────
  {
    name: "branch_generate_name",
    description:
      "Generates a branch name: feature/{task-id}-{task-name}. Always call before creating a branch.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        taskTitle: { type: "string" },
      },
      required: ["taskId", "taskTitle"],
    },
  },
  {
    name: "conflict_preflight_check",
    description:
      "Checks if a branch or PR already exists for a task. Run before starting work.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        branchName: { type: "string" },
      },
      required: ["taskId", "branchName"],
    },
  },

  // ── Agent Tools ───────────────────────────────────────────────────────
  {
    name: "agent_analyze_task",
    description:
      "ProductOwnerAgent: Analyzes an ADO task — validates completeness, detects UI/API scope, " +
      "and posts analysis as ADO comment. Run this first before any implementation.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "number" } },
      required: ["taskId"],
    },
  },
  {
    name: "agent_generate_architecture",
    description:
      "ArchitectAgent: Scaffolds a clean architecture for a feature: " +
      "domain entities, repository interfaces, use cases, DTOs, React components, and test files.",
    inputSchema: {
      type: "object",
      properties: {
        featureName: { type: "string", description: "Feature name e.g. 'employee-management'" },
        rootDir: { type: "string", description: "Target directory (default: cwd)" },
      },
      required: ["featureName"],
    },
  },
  {
    name: "agent_start_development",
    description:
      "DeveloperAgent: Creates the feature branch (feature/{id}-{name}), marks ADO task as 'In Progress'. " +
      "Runs conflict preflight check automatically.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        force: { type: "boolean", description: "Override conflict detection" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "agent_create_pr",
    description:
      "DeveloperAgent: Creates a GitHub PR using the standard PR template. " +
      "Posts PR link to ADO task.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        branchName: { type: "string" },
        figmaUrl: { type: "string" },
        summary: { type: "string" },
      },
      required: ["taskId", "branchName"],
    },
  },
  {
    name: "agent_review_pr",
    description:
      "ReviewerAgent: Runs automated code review — checks coding standards, architecture, " +
      "naming, and test coverage. Posts review comment to GitHub PR.",
    inputSchema: {
      type: "object",
      properties: {
        prNumber: { type: "number" },
        branchName: { type: "string" },
      },
      required: ["prNumber", "branchName"],
    },
  },
  {
    name: "agent_merge_pr",
    description:
      "DevOpsAgent: Merges an approved PR, deletes the branch, and marks ADO task as Done.",
    inputSchema: {
      type: "object",
      properties: {
        prNumber: { type: "number" },
        taskId: { type: "number", description: "ADO task ID (auto-detected from branch if omitted)" },
        strategy: { type: "string", description: "'--squash' (default), '--merge', '--rebase'" },
      },
      required: ["prNumber"],
    },
  },
  {
    name: "agent_full_workflow",
    description:
      "Runs the COMPLETE automated workflow: " +
      "analyze task → Figma wireframe → architecture scaffold → create branch → create PR. " +
      "Use when user says 'work on task 123' or 'implement task 456'.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        skipFigma: { type: "boolean" },
        skipArch: { type: "boolean" },
        force: { type: "boolean" },
      },
      required: ["taskId"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────
const server = new Server(
  { name: "claude-mcp-automation", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── ADO ──────────────────────────────────────────────────────────
      case "ado_get_work_item":
        return text(formatWorkItem(await getWorkItem(args.id)));

      case "ado_list_work_items":
        return text(formatWorkItemList(await listWorkItems(args)));

      case "ado_update_work_item_state": {
        const r = await updateWorkItemState(args.id, args.state);
        return text(`✅ #${r.id} "${r.title}" → **${r.newState}**\n${r.url}`);
      }

      case "ado_add_comment": {
        const r = await addWorkItemComment(args.id, args.comment);
        return text(`✅ Comment added to #${args.id} by ${r.createdBy}`);
      }

      // ── Figma ─────────────────────────────────────────────────────────
      case "figma_get_file": {
        const f = await getFigmaFile(args.fileKey);
        return text(
          `# Figma: ${f.name}\n**URL:** ${f.url}\n**Modified:** ${f.lastModified}\n` +
          `**Pages:** ${f.pages?.map((p) => p.name).join(", ")}`
        );
      }

      case "figma_generate_wireframe": {
        const task = await getWorkItem(args.taskId);
        const r = await runFigmaDesignWorkflow(task);
        return text(
          `# Figma Wireframe — Task #${task.id}\n\n` +
          `**Figma URL:** ${r.figmaFile?.url}\n` +
          `**Status:** ${r.wireframe?.message || r.wireframe?.error}\n` +
          `**ADO:** ${r.adoUpdate?.message || r.adoUpdate?.error}\n\n` +
          `\`\`\`\n${r.wireframe?.wireframeSpec || ""}\n\`\`\``
        );
      }

      case "figma_add_ado_link": {
        const r = await addFigmaLinkToAdo(args.adoTaskId, args.figmaUrl, args.figmaFileName);
        return text(`✅ ${r.message}`);
      }

      // ── Branch / Conflict ─────────────────────────────────────────────
      case "branch_generate_name": {
        const branchName = generateBranchName(args.taskId, args.taskTitle);
        const check = validateBranchName(branchName);
        return text(`**Branch:** \`${branchName}\`\n**Valid:** ${check.valid ? "✅" : "❌ " + check.reason}`);
      }

      case "conflict_preflight_check": {
        const r = preflightCheck(args.taskId, args.branchName);
        const lines = [
          `# Preflight Check`,
          `**Proceed:** ${r.canProceed ? "✅ Yes" : "❌ Conflicts detected"}`,
          ...r.warnings,
        ];
        if (r.existingBranch) lines.push(`**Existing branch:** \`${r.existingBranch}\``);
        if (r.existingPR) lines.push(`**Existing PR:** #${r.existingPR.number}`);
        return text(lines.join("\n"));
      }

      // ── Agents ────────────────────────────────────────────────────────
      case "agent_analyze_task": {
        const r = await productOwnerAgent.analyzeTask(args.taskId);
        return text(
          `# ProductOwnerAgent — Task #${args.taskId}\n\n` +
          r.analysis.summary + "\n\n" +
          `**UI Design needed:** ${r.analysis.requires.uiDesign ? "Yes" : "No"}\n` +
          `**API changes needed:** ${r.analysis.requires.apiChanges ? "Yes" : "No"}\n` +
          `**Ready for dev:** ${r.analysis.validation.readyForDevelopment ? "✅ Yes" : "⚠️ " + r.analysis.validation.issues.join(", ")}`
        );
      }

      case "agent_generate_architecture": {
        const r = architectAgent.generateArchitecture(args.featureName, args.rootDir);
        return text(
          `# ArchitectAgent — Scaffold: ${r.featureName}\n\n` +
          `**Files created (${r.structure.files.length}):**\n` +
          r.structure.files.map((f) => `- \`${f.path}\``).join("\n")
        );
      }

      case "agent_start_development": {
        const task = await getWorkItem(args.taskId);
        const r = await developerAgent.workOnTask(task, { force: args.force });
        return text(
          `# DeveloperAgent — ${r.success ? "✅ Ready" : "❌ Blocked"}\n\n` +
          r.log.join("\n") + (r.warning ? `\n\n⚠️ ${r.warning}` : "")
        );
      }

      case "agent_create_pr": {
        const task = await getWorkItem(args.taskId);
        const r = await developerAgent.createPR(task, args.branchName, {
          figmaUrl: args.figmaUrl,
          summary: args.summary,
        });
        return text(r.success ? `✅ PR: ${r.prUrl}\n**Title:** ${r.title}` : `❌ ${r.error}`);
      }

      case "agent_review_pr": {
        const r = await reviewerAgent.reviewPR(args.prNumber, args.branchName);
        return text(r.reviewBody + `\n\n**Posted:** ${r.posted ? "✅" : "⚠️ No (gh CLI required)"}`);
      }

      case "agent_merge_pr": {
        const r = await devopsAgent.mergePR(args.prNumber, {
          strategy: args.strategy,
          taskId: args.taskId,
        });
        return text(
          `# DevOpsAgent — ${r.success ? "✅ Merged" : "❌ Failed"}\n\n` +
          r.log.join("\n") + (r.error ? `\n\n❌ ${r.error}` : "")
        );
      }

      case "agent_full_workflow": {
        const task = await getWorkItem(args.taskId);
        const results = {};

        // 1. PO Analysis
        const po = await productOwnerAgent.analyzeTask(args.taskId);
        results.analysis = po.analysis;

        // 2. Figma
        if (!args.skipFigma) {
          try { results.figma = await runFigmaDesignWorkflow(task); }
          catch (e) { results.figma = { error: e.message }; }
        }

        // 3. Architecture scaffold
        if (!args.skipArch) {
          const slug = task.title.toLowerCase().replace(/[^a-z0-9\s]/g,"").replace(/\s+/g,"-").slice(0,30);
          try { results.arch = architectAgent.generateArchitecture(slug); }
          catch (e) { results.arch = { error: e.message }; }
        }

        // 4. Branch + In Progress
        const dev = await developerAgent.workOnTask(task, { force: args.force });
        results.dev = dev;

        // 5. Commit + PR
        if (dev.success) {
          const commit = developerAgent.commitAndPush(task, dev.branchName);
          const pr = await developerAgent.createPR(task, dev.branchName, {
            figmaUrl: results.figma?.figmaFile?.url,
          });
          results.commit = commit;
          results.pr = pr;
        }

        return text([
          `# 🚀 Full Workflow — Task #${args.taskId}`,
          `**Task:** ${task.title}`,
          `**Branch:** \`${results.dev?.branchName || "N/A"}\``,
          `**PR:** ${results.pr?.prUrl || "Not created (gh CLI required)"}`,
          `**Figma:** ${results.figma?.figmaFile?.url || (results.figma?.error ? "Error: " + results.figma.error : "Skipped")}`,
          `**Arch Scaffold:** ${results.arch?.structure ? results.arch.structure.files.length + " files" : "Skipped/Error"}`,
          ``,
          `## Agent Results`,
          `- PO Analysis: ${po.analysis.validation.isValid ? "✅" : "⚠️ " + po.analysis.validation.issues.join(", ")}`,
          `- Architecture: ${results.arch?.structure ? "✅" : "Skipped"}`,
          `- Branch: ${dev.success ? "✅ " + dev.branchName : "❌ " + (dev.warning || "Failed")}`,
          `- PR: ${results.pr?.success ? "✅" : "⚠️ Not created"}`,
        ].join("\n"));
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Error in ${name}: ${error.message}` }],
      isError: true,
    };
  }
});

// ─── Formatters ────────────────────────────────────────────────────────
function text(str) {
  return { content: [{ type: "text", text: str }] };
}

function formatWorkItem(item) {
  return [
    `# Work Item #${item.id}: ${item.title}`,
    `**Type:** ${item.type} | **State:** ${item.state} | **Priority:** ${item.priority}`,
    `**Assigned:** ${item.assignedTo} | **Points:** ${item.storyPoints} | **Sprint:** ${item.iterationPath}`,
    `**URL:** ${item.url}`,
    ``, `## Description`, item.description,
    ``, `## Acceptance Criteria`, item.acceptanceCriteria,
    ...(item.reproductionSteps ? [``, `## Reproduction Steps`, item.reproductionSteps] : []),
    ...(item.comments?.length > 0
      ? [``, `## Comments (${item.comments.length})`,
         ...item.comments.map((c) => `**${c.author}:** ${c.text.replace(/<[^>]+>/g, "")}`)]
      : []),
    ...(item.relations?.length > 0
      ? [``, `## Linked Items`, ...item.relations.map((r) => `- [${r.type}] ${r.title || r.url}`)]
      : []),
  ].join("\n");
}

function formatWorkItemList(items) {
  if (!items.length) return "No work items found.";
  return [`# Work Items (${items.length})`,
    ...items.map((i) => `## #${i.id} — ${i.title}\n**${i.type}** | ${i.state} | ${i.assignedTo} | P${i.priority}`)

  ].join("\n\n");
}

// ─── Start ────────────────────────────────────────────────────────────
async function main() {
  validateConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Claude MCP Automation v2.0.0 — ready");
  console.error(`   ${TOOLS.length} tools registered`);
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
