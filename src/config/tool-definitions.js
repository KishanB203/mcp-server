/**
 * @module config/tool-definitions
 *
 * Canonical list of MCP tool schemas exposed by this server.
 * Each entry is passed verbatim to the `ListToolsRequestSchema` handler.
 *
 * Naming conventions:
 *   ado_*       — Azure DevOps work-item operations
 *   figma_*     — Figma design file operations
 *   branch_*    — Git branch utilities
 *   conflict_*  — Pre-flight conflict detection
 *   agent_*     — Autonomous agent orchestration
 */

/** @type {import("@modelcontextprotocol/sdk/types.js").Tool[]} */
export const TOOLS = [
  // ── Azure DevOps ─────────────────────────────────────────────────────────

  {
    name: "ado_get_work_item",
    description:
      "Fetches full details of an Azure DevOps work item by ID. Returns title, description, " +
      "acceptance criteria, state, priority, story points, comments, and linked relations.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Work item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "ado_list_work_items",
    description:
      "Lists Azure DevOps work items with optional filters: sprint, state, type, assignedTo.",
    inputSchema: {
      type: "object",
      properties: {
        sprint: { type: "string", description: "Iteration path to filter by" },
        state: { type: "string", description: "Work item state (e.g. 'In Progress')" },
        type: { type: "string", description: "Work item type (e.g. 'Task', 'Bug')" },
        assignedTo: { type: "string", description: "Assignee display name or email" },
        limit: { type: "number", description: "Maximum number of results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "ado_create_work_item",
    description: "Creates a new Azure DevOps work item (Task, Bug, User Story, Feature, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Work item title (required)" },
        type: { type: "string", description: "Work item type (default: Task)" },
        description: { type: "string" },
        acceptanceCriteria: { type: "string" },
        state: { type: "string" },
        assignedTo: { type: "string" },
        sprint: { type: "string", description: "Iteration path (e.g. 'Project\\\\Sprint 1')" },
        tags: { type: "string", description: "Semicolon-separated tags" },
        priority: { type: "number" },
        storyPoints: { type: "number" },
      },
      required: ["title"],
    },
  },
  {
    name: "ado_update_work_item_state",
    description: "Updates the state of an ADO work item (e.g. 'In Progress', 'Done').",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Work item ID" },
        state: { type: "string", description: "New state value" },
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
        id: { type: "number", description: "Work item ID" },
        comment: { type: "string", description: "Comment text (Markdown supported)" },
      },
      required: ["id", "comment"],
    },
  },

  // ── Figma ─────────────────────────────────────────────────────────────────

  {
    name: "figma_get_file",
    description:
      "Gets metadata for the configured Figma file. Use to verify the Figma connection.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: {
          type: "string",
          description: "Figma file key (defaults to FIGMA_FILE_KEY env var)",
        },
      },
      required: [],
    },
  },
  {
    name: "figma_generate_wireframe",
    description:
      "Generates a wireframe specification for a UI task and annotates it on the Figma file. " +
      "Also posts the Figma link back to the ADO task. Use for any UI/frontend task.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "ADO task ID to generate the wireframe for" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "figma_add_ado_link",
    description: "Adds a Figma URL as a comment on an Azure DevOps task.",
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

  // ── Branch & Conflict ─────────────────────────────────────────────────────

  {
    name: "branch_generate_name",
    description:
      "Generates a branch name following the convention: feature/{task-id}-{task-name}. " +
      "Always call this before creating a branch.",
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
      "Checks whether a branch or open PR already exists for the given task. " +
      "Run before starting work to prevent duplicate branches.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        branchName: { type: "string" },
      },
      required: ["taskId", "branchName"],
    },
  },

  // ── Agents ────────────────────────────────────────────────────────────────

  {
    name: "agent_analyze_task",
    description:
      "ProductOwnerAgent: Analyzes an ADO task — validates completeness, detects UI/API scope, " +
      "and posts the analysis as an ADO comment. Run this first before any implementation.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "agent_generate_architecture",
    description:
      "ArchitectAgent: Scaffolds a clean architecture for a feature: " +
      "domain entities, repository interfaces, use cases, DTOs, React components, and test stubs.",
    inputSchema: {
      type: "object",
      properties: {
        featureName: {
          type: "string",
          description: "Feature name in kebab-case (e.g. 'employee-management')",
        },
        rootDir: {
          type: "string",
          description: "Target root directory (defaults to cwd)",
        },
      },
      required: ["featureName"],
    },
  },
  {
    name: "agent_start_development",
    description:
      "DeveloperAgent: Runs conflict preflight, creates the feature branch " +
      "(feature/{id}-{name}), and marks the ADO task as 'In Progress'.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        force: {
          type: "boolean",
          description: "Override conflict detection (proceed even if branch/PR exists)",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "agent_create_pr",
    description:
      "DeveloperAgent: Creates a GitHub PR using the standard PR template " +
      "and posts the PR link back to the ADO task.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        branchName: { type: "string" },
        figmaUrl: { type: "string", description: "Optional Figma design URL" },
        summary: { type: "string", description: "Optional PR summary override" },
      },
      required: ["taskId", "branchName"],
    },
  },
  {
    name: "agent_review_pr",
    description:
      "ReviewerAgent: Runs automated code review — checks coding standards, architecture " +
      "layer violations, naming conventions, test coverage, and credentials. " +
      "Posts the review comment to the GitHub PR.",
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
      "DevOpsAgent: Merges an approved PR (squash by default), deletes the feature branch, " +
      "and marks the associated ADO task as 'Done'.",
    inputSchema: {
      type: "object",
      properties: {
        prNumber: { type: "number" },
        taskId: {
          type: "number",
          description: "ADO task ID (auto-detected from branch name if omitted)",
        },
        strategy: {
          type: "string",
          description: "Merge strategy: '--squash' (default) | '--merge' | '--rebase'",
        },
      },
      required: ["prNumber"],
    },
  },
  {
    name: "agent_generate_solution_requirements",
    description:
      "SolutionRequirementsAgent: Converts Figma/screen input + raw client requirements into " +
      "implementation-ready docs: context.md, modular frontend/*.md UI specs, and backend/*.md " +
      "(API surface, data model, services/integrations, security/auth).",
    inputSchema: {
      type: "object",
      properties: {
        featureName: { type: "string", description: "Feature or screen name" },
        figmaInput: { type: "string", description: "Figma link or screen description" },
        businessRequirements: { type: "string", description: "Raw client requirements text" },
        outputDir: { type: "string", description: "Output directory (default: current working directory)" },
      },
      required: ["featureName", "businessRequirements"],
    },
  },
  {
    name: "agent_full_workflow",
    description:
      "Runs the COMPLETE automated pipeline in one call: " +
      "analyze task → Figma wireframe → architecture scaffold → create branch → commit → PR → review → merge. " +
      "Use when the user says 'work on task 123' or 'implement task 456'.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        skipFigma: { type: "boolean", description: "Skip Figma wireframe generation" },
        skipArch: { type: "boolean", description: "Skip architecture scaffold generation" },
        force: { type: "boolean", description: "Override conflict detection" },
      },
      required: ["taskId"],
    },
  },
];
