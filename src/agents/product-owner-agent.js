import { getWorkItem } from "../tools/get-ticket.js";
import { updateWorkItemState, addWorkItemComment } from "../tools/update-ticket.js";

/**
 * Product Owner Agent
 * Responsibilities:
 *   - Read and interpret Azure DevOps tasks/PBIs
 *   - Break down requirements into actionable specs
 *   - Validate acceptance criteria completeness
 *   - Prioritize tasks and flag blockers
 */

export class ProductOwnerAgent {
  constructor() {
    this.name = "ProductOwnerAgent";
    this.role = "Product Owner";
  }

  /**
   * Analyze a work item and produce a structured spec for downstream agents
   */
  async analyzeTask(taskId) {
    console.error(`[${this.name}] Analyzing task #${taskId}...`);

    const task = await getWorkItem(taskId);

    const analysis = this.buildAnalysis(task);

    // Comment on the ADO task
    await addWorkItemComment(
      taskId,
      `🤖 **ProductOwnerAgent** analyzed this task.\n\n${analysis.summary}`
    );

    return {
      agent: this.name,
      task,
      analysis,
    };
  }

  /**
   * Validate that a task has sufficient information to proceed
   */
  validateTask(task) {
    const issues = [];

    if (!task.description || task.description === "No description provided.") {
      issues.push("Missing description");
    }
    if (
      !task.acceptanceCriteria ||
      task.acceptanceCriteria === "No acceptance criteria provided."
    ) {
      issues.push("Missing acceptance criteria");
    }
    if (!task.storyPoints || task.storyPoints === "Not set") {
      issues.push("Story points not estimated");
    }

    return {
      isValid: issues.length === 0,
      issues,
      readyForDevelopment: issues.length === 0,
    };
  }

  /**
   * Build a structured analysis of the task
   */
  buildAnalysis(task) {
    const validation = this.validateTask(task);

    const uiRequired = this.detectsUIWork(task);
    const apiRequired = this.detectsAPIWork(task);
    const testingRequired = true; // always true

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type,
      priority: task.priority,
      validation,
      requires: {
        uiDesign: uiRequired,
        apiChanges: apiRequired,
        testing: testingRequired,
        documentation:
          task.description?.toLowerCase().includes("document") || false,
      },
      suggestedAgents: this.suggestAgents({ uiRequired, apiRequired }),
      summary:
        `**Task Analysis:**\n` +
        `- Type: ${task.type}\n` +
        `- Priority: ${task.priority}\n` +
        `- UI Work: ${uiRequired ? "Yes" : "No"}\n` +
        `- API Work: ${apiRequired ? "Yes" : "No"}\n` +
        `- Validation: ${validation.isValid ? "✅ Ready" : "⚠️ Issues: " + validation.issues.join(", ")}`,
    };
  }

  detectsUIWork(task) {
    const keywords = [
      "ui",
      "screen",
      "page",
      "form",
      "component",
      "display",
      "view",
      "button",
      "modal",
      "layout",
    ];
    const text =
      `${task.title} ${task.description} ${task.acceptanceCriteria}`.toLowerCase();
    return keywords.some((k) => text.includes(k));
  }

  detectsAPIWork(task) {
    const keywords = [
      "api",
      "endpoint",
      "service",
      "backend",
      "database",
      "query",
      "mutation",
      "rest",
      "fetch",
    ];
    const text =
      `${task.title} ${task.description} ${task.acceptanceCriteria}`.toLowerCase();
    return keywords.some((k) => text.includes(k));
  }

  suggestAgents({ uiRequired, apiRequired }) {
    const agents = ["architect-agent", "developer-agent", "reviewer-agent", "devops-agent"];
    if (uiRequired) agents.unshift("figma-design-step");
    return agents;
  }
}

export default new ProductOwnerAgent();
