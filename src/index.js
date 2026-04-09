/**
 * @module src/index
 *
 * MCP Server bootstrap — entry point for the Claude MCP Automation pipeline.
 *
 * Responsibilities:
 *   1. Load environment (via config/env.js, which calls dotenv.config() once)
 *   2. Register all tool schemas with the MCP SDK
 *   3. Route incoming `CallToolRequest` messages to the correct handler
 *   4. Return formatted text responses to the MCP client
 *
 * Tool categories:
 *   ado_*        — Azure DevOps work-item CRUD
 *   figma_*      — Figma design file operations
 *   branch_*     — Git branch naming utilities
 *   conflict_*   — Pre-flight conflict detection
 *   agent_*      — Autonomous agent orchestration
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Config — must be imported before any infrastructure module so that dotenv
// is loaded and process.env is populated before clients are instantiated.
import { validateAdoConfig } from "./config/env.js";
import { TOOLS } from "./config/tool-definitions.js";

// Infrastructure clients
import { validateFigmaConfig } from "./infrastructure/figma/figma-client.js";

// ADO tools
import { getWorkItem } from "./tools/ado/get-work-item.js";
import { listWorkItems } from "./tools/ado/list-work-items.js";
import { createWorkItem } from "./tools/ado/create-work-item.js";
import { updateWorkItemState, addWorkItemComment } from "./tools/ado/update-work-item.js";

// Figma tools
import {
  getFigmaFile,
  runFigmaDesignWorkflow,
  addFigmaLinkToAdo,
} from "./tools/figma/figma-tools.js";

// Branch tools
import { generateBranchName, validateBranchName } from "./tools/branch/branch-naming.js";
import { preflightCheck } from "./tools/branch/conflict-prevention.js";

// Agents
import productOwnerAgent from "./agents/product-owner-agent.js";
import architectAgent from "./agents/architect-agent.js";
import developerAgent from "./agents/developer-agent.js";
import reviewerAgent from "./agents/reviewer-agent.js";
import devopsAgent from "./agents/devops-agent.js";

// Services
import { runWorkflow } from "./services/workflow.js";
import { architectureGenerator } from "./services/architecture-generator.js";

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "claude-mcp-automation", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// ── List tools ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ── Call tool ─────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      // ── Azure DevOps ───────────────────────────────────────────────────────

      case "ado_get_work_item":
        return text(formatWorkItem(await getWorkItem(args.id)));

      case "ado_list_work_items":
        return text(formatWorkItemList(await listWorkItems(args)));

      case "ado_create_work_item": {
        const item = await createWorkItem(args);
        return text(
          `✅ Work item created:\n` +
          `**#${item.id}** — ${item.title}\n` +
          `**Type:** ${item.type} | **State:** ${item.state ?? "N/A"}\n` +
          `**URL:** ${item.url}`
        );
      }

      case "ado_update_work_item_state": {
        const r = await updateWorkItemState(args.id, args.state);
        return text(
          `✅ #${r.id} "${r.title}" → **${r.newState}**\n${r.url}`
        );
      }

      case "ado_add_comment": {
        const r = await addWorkItemComment(args.id, args.comment);
        return text(`✅ Comment added to #${args.id} by ${r.createdBy}`);
      }

      // ── Figma ──────────────────────────────────────────────────────────────

      case "figma_get_file": {
        const f = await getFigmaFile(args.fileKey);
        return text(
          `# Figma: ${f.name}\n` +
          `**URL:** ${f.url}\n` +
          `**Modified:** ${f.lastModified}\n` +
          `**Pages:** ${f.pages?.map((p) => p.name).join(", ")}`
        );
      }

      case "figma_generate_wireframe": {
        const task = await getWorkItem(args.taskId);
        const r = await runFigmaDesignWorkflow(task);
        return text(
          `# Figma Wireframe — Task #${task.id}\n\n` +
          `**Figma URL:** ${r.figmaFile?.url}\n` +
          `**Status:** ${r.wireframe?.message ?? r.wireframe?.error}\n` +
          `**ADO:** ${r.adoUpdate?.message ?? r.adoUpdate?.error}\n\n` +
          `\`\`\`\n${r.wireframe?.wireframeSpec ?? ""}\n\`\`\``
        );
      }

      case "figma_add_ado_link": {
        const r = await addFigmaLinkToAdo(args.adoTaskId, args.figmaUrl, args.figmaFileName);
        return text(`✅ ${r.message}`);
      }

      // ── Branch / Conflict ──────────────────────────────────────────────────

      case "branch_generate_name": {
        const branchName = generateBranchName(args.taskId, args.taskTitle);
        const check = validateBranchName(branchName);
        return text(
          `**Branch:** \`${branchName}\`\n` +
          `**Valid:** ${check.valid ? "✅" : "❌ " + check.reason}`
        );
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

      // ── Agents ────────────────────────────────────────────────────────────

      case "agent_analyze_task": {
        const r = await productOwnerAgent.analyzeTask(args.taskId);
        return text(
          `# ProductOwnerAgent — Task #${args.taskId}\n\n` +
          r.analysis.summary + "\n\n" +
          `**UI Design needed:** ${r.analysis.requires.uiDesign ? "Yes" : "No"}\n` +
          `**API changes needed:** ${r.analysis.requires.apiChanges ? "Yes" : "No"}\n` +
          `**Ready for dev:** ${
            r.analysis.validation.readyForDevelopment
              ? "✅ Yes"
              : "⚠️ " + r.analysis.validation.issues.join(", ")
          }`
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
          r.log.join("\n") +
          (r.warning ? `\n\n⚠️ ${r.warning}` : "")
        );
      }

      case "agent_create_pr": {
        const task = await getWorkItem(args.taskId);
        const r = await developerAgent.createPR(task, args.branchName, {
          figmaUrl: args.figmaUrl,
          summary: args.summary,
        });
        return text(
          r.success
            ? `✅ PR: ${r.prUrl}\n**Title:** ${r.title}`
            : `❌ ${r.error}`
        );
      }

      case "agent_review_pr": {
        const r = await reviewerAgent.reviewPR(args.prNumber, args.branchName);
        return text(
          r.reviewBody +
          `\n\n**Posted:** ${r.posted ? "✅" : "⚠️ No (gh CLI required)"}`
        );
      }

      case "agent_merge_pr": {
        const r = await devopsAgent.mergePR(args.prNumber, {
          strategy: args.strategy,
          taskId: args.taskId,
        });
        return text(
          `# DevOpsAgent — ${r.success ? "✅ Merged" : "❌ Failed"}\n\n` +
          r.log.join("\n") +
          (r.error ? `\n\n❌ ${r.error}` : "")
        );
      }

      case "agent_full_workflow": {
        const result = await runWorkflow(args.taskId, {
          skipFigma: args.skipFigma,
          skipArch: args.skipArch,
          force: args.force,
        });

        if (!result.success) {
          return text(
            `# ❌ Workflow blocked — Task #${args.taskId}\n\n` +
            `**Reason:** ${result.reason ?? "Unknown"}\n` +
            (result.preflight?.warnings?.join("\n") ?? "")
          );
        }

        return text([
          `# ✅ Full Workflow Complete — Task #${args.taskId}`,
          `**Task:** ${result.task?.title}`,
          `**Branch:** \`${result.branchName}\``,
          `**PR:** ${result.pr?.url ?? "Not created"}`,
          `**Figma:** ${result.figma?.figmaFile?.url ?? "Skipped"}`,
          `**Architecture:** ${result.architecture ? "✅ Scaffolded" : "Skipped"}`,
          `**Merged:** ${result.merge?.merged ? "✅ Yes" : "⚠️ Not merged"}`,
        ].join("\n"));
      }

      default:
        throw new Error(`Unknown tool: "${name}"`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Error in "${name}": ${error.message}` }],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Response formatters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a plain string in the MCP text-content envelope.
 *
 * @param {string} str
 * @returns {{ content: Array<{type:'text',text:string}> }}
 */
function text(str) {
  return { content: [{ type: "text", text: str }] };
}

/**
 * Formats a full work item as Markdown.
 *
 * @param {import("./tools/ado/get-work-item.js").WorkItem} item
 * @returns {string}
 */
function formatWorkItem(item) {
  return [
    `# Work Item #${item.id}: ${item.title}`,
    `**Type:** ${item.type} | **State:** ${item.state} | **Priority:** ${item.priority}`,
    `**Assigned:** ${item.assignedTo} | **Points:** ${item.storyPoints} | **Sprint:** ${item.iterationPath}`,
    `**URL:** ${item.url}`,
    ``,
    `## Description`,
    item.description,
    ``,
    `## Acceptance Criteria`,
    item.acceptanceCriteria,
    ...(item.reproductionSteps
      ? [``, `## Reproduction Steps`, item.reproductionSteps]
      : []),
    ...(item.comments?.length > 0
      ? [
          ``,
          `## Comments (${item.comments.length})`,
          ...item.comments.map(
            (c) => `**${c.author}:** ${c.text.replace(/<[^>]+>/g, "")}`
          ),
        ]
      : []),
    ...(item.relations?.length > 0
      ? [
          ``,
          `## Linked Items`,
          ...item.relations.map((r) => `- [${r.type}] ${r.title || r.url}`),
        ]
      : []),
  ].join("\n");
}

/**
 * Formats a list of work-item summaries as Markdown.
 *
 * @param {import("./tools/ado/list-work-items.js").WorkItemSummary[]} items
 * @returns {string}
 */
function formatWorkItemList(items) {
  if (!items.length) return "No work items found.";
  return [
    `# Work Items (${items.length})`,
    ...items.map(
      (i) =>
        `## #${i.id} — ${i.title}\n**${i.type}** | ${i.state} | ${i.assignedTo} | P${i.priority}`
    ),
  ].join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  validateAdoConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `✅ Claude MCP Automation v2.0.0 — ready (${TOOLS.length} tools)\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
