import { execSync } from "child_process";
import { generateBranchName, validateBranchName } from "../branch-naming.js";
import { preflightCheck } from "../conflict-prevention.js";
import { buildPR } from "../pr-template.js";
import { updateWorkItemState, addWorkItemComment } from "../tools/update-ticket.js";
import fs from "fs";
import path from "path";

/**
 * Developer Agent
 * Responsibilities:
 *   - Create feature branch (one per task)
 *   - Generate code scaffold based on architecture
 *   - Commit changes
 *   - Push branch
 *   - Create GitHub PR using gh CLI
 */

export class DeveloperAgent {
  constructor() {
    this.name = "DeveloperAgent";
    this.role = "Developer";
  }

  /**
   * Full development workflow for a task
   */
  async workOnTask(task, options = {}) {
    console.error(`[${this.name}] Starting work on task #${task.id}: ${task.title}`);
    const log = [];

    // 1. Generate branch name
    const branchName = generateBranchName(task.id, task.title);
    log.push(`🌿 Branch name: ${branchName}`);

    // 2. Validate branch naming
    const nameCheck = validateBranchName(branchName);
    if (!nameCheck.valid) {
      throw new Error(nameCheck.reason);
    }

    // 3. Preflight conflict check
    const preflight = preflightCheck(task.id, branchName);
    if (!preflight.canProceed && !options.force) {
      log.push(...preflight.warnings);
      return {
        agent: this.name,
        success: false,
        branchName,
        log,
        warning: "Task already has an open branch/PR. Use --force to override.",
        preflight,
      };
    }
    if (preflight.warnings.length > 0) {
      log.push(...preflight.warnings);
    }

    // 4. Create branch
    try {
      if (preflight.existingBranch) {
        execSync(`git checkout ${branchName}`, { stdio: "inherit" });
        log.push(`✅ Checked out existing branch: ${branchName}`);
      } else {
        execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
        log.push(`✅ Created branch: ${branchName}`);
      }
    } catch (err) {
      log.push(`⚠️  Could not create branch (may be in detached state): ${err.message}`);
    }

    // 5. Mark ADO task as In Progress
    try {
      await updateWorkItemState(task.id, "In Progress");
      log.push(`✅ ADO task #${task.id} marked as "In Progress"`);
    } catch (err) {
      log.push(`⚠️  Could not update ADO state: ${err.message}`);
    }

    return {
      agent: this.name,
      success: true,
      branchName,
      task,
      log,
    };
  }

  /**
   * Commit and push current changes
   */
  commitAndPush(task, branchName, message) {
    const commitMsg =
      message || `feat: ${task.title} [#${task.id}]`;

    try {
      execSync(`git add -A`, { stdio: "inherit" });
      execSync(`git commit -m "${commitMsg}"`, { stdio: "inherit" });
      execSync(`git push origin ${branchName} --set-upstream`, { stdio: "inherit" });
      return { success: true, commitMsg };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a GitHub PR using the gh CLI
   */
  async createPR(task, branchName, options = {}) {
    const { title, body } = buildPR(task, { branchName, ...options });

    try {
      const output = execSync(
        `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")}" --assignee @me 2>&1`,
        { encoding: "utf8" }
      ).trim();

      const prUrl = output.match(/https:\/\/github\.com\/[^\s]+/)?.[0] || output;

      // Add PR link to ADO ticket
      try {
        await addWorkItemComment(
          task.id,
          `🔗 **Pull Request created:**\n\n${prUrl}\n\nTitle: ${title}`
        );
      } catch (_) {}

      return { success: true, prUrl, title };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export default new DeveloperAgent();
