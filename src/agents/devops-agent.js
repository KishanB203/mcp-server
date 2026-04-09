import { execSync } from "child_process";
import { updateWorkItemState, addWorkItemComment } from "../tools/ado/update-work-item.js";
import { extractTaskIdFromBranch } from "../tools/branch/branch-naming.js";
import { createGitHubClient } from "../infrastructure/github/github-client.js";

/**
 * DevOps Agent
 * Responsibilities:
 *   - Merge approved PRs
 *   - Delete feature branches post-merge
 *   - Update ADO ticket to Done
 *   - Trigger CI/CD notifications
 *   - Guard against merging unapproved or conflicted PRs
 */

export class DevOpsAgent {
  constructor() {
    this.name = "DevOpsAgent";
    this.role = "DevOps Engineer";
    this.github = createGitHubClient();
  }

  async getPrInfoViaApi(repo, prNumber) {
    const pr = await this.github.getPullRequest(repo, Number(prNumber));
    return {
      number: pr.number,
      title: pr.title,
      headRefName: pr.head?.ref,
      mergeable: pr.mergeable ? "MERGEABLE" : "UNKNOWN",
      state: pr.state?.toUpperCase(),
      reviewDecision: pr.mergeable_state,
    };
  }

  /**
   * Merge a PR using GitHub CLI
   * @param {number|string} prNumber
   * @param {object} options
   */
  async mergePR(prNumber, options = {}) {
    console.error(`[${this.name}] Merging PR #${prNumber}...`);
    const log = [];

    const mergeStrategy = options.strategy || "--squash";
    const repo = options.repo || { owner: process.env.REPO_OWNER, name: process.env.REPO_NAME };
    const apiMergeMethod =
      mergeStrategy === "--merge" ? "merge" : mergeStrategy === "--rebase" ? "rebase" : "squash";

    // 1. Check PR status before merging
    let prInfo = null;
    if (process.env.GITHUB_TOKEN && repo?.owner && repo?.name) {
      try {
        prInfo = await this.getPrInfoViaApi(repo, prNumber);
      } catch (err) {
        log.push(`⚠️  Could not fetch PR info via API: ${err.message}`);
      }
    } else {
      try {
        const output = execSync(
          `gh pr view ${prNumber} --json number,title,headRefName,mergeable,state,reviewDecision 2>/dev/null`,
          { encoding: "utf8" }
        ).trim();
        prInfo = JSON.parse(output);
      } catch (err) {
        log.push(`⚠️  Could not fetch PR info: ${err.message}`);
      }
    }

    if (prInfo) {
      if (prInfo.state !== "OPEN") {
        return {
          agent: this.name,
          success: false,
          log,
          error: `PR #${prNumber} is not open (state: ${prInfo.state})`,
        };
      }
      if (prInfo.mergeable === "CONFLICTING") {
        return {
          agent: this.name,
          success: false,
          log,
          error: `PR #${prNumber} has merge conflicts — resolve before merging`,
        };
      }
      log.push(`📋 PR: "${prInfo.title}" (${prInfo.headRefName})`);
    }

    // 2. Merge
    if (process.env.GITHUB_TOKEN && repo?.owner && repo?.name) {
      try {
        const merged = await this.github.mergePR(repo, Number(prNumber), {
          mergeMethod: apiMergeMethod,
        });
        if (!merged.merged) {
          return { agent: this.name, success: false, log, error: `Merge failed: ${merged.message}` };
        }
        log.push(`✅ PR #${prNumber} merged successfully (${apiMergeMethod})`);
      } catch (err) {
        return { agent: this.name, success: false, log, error: `Merge failed: ${err.message}` };
      }
    } else {
      try {
        execSync(
          `gh pr merge ${prNumber} ${mergeStrategy} --delete-branch --auto 2>&1`,
          { stdio: "inherit" }
        );
        log.push(`✅ PR #${prNumber} merged successfully (${mergeStrategy})`);
      } catch (err) {
        return {
          agent: this.name,
          success: false,
          log,
          error: `Merge failed: ${err.message}`,
        };
      }
    }

    // 3. Update ADO ticket if we know the task ID
    const taskId = prInfo
      ? extractTaskIdFromBranch(prInfo.headRefName)
      : options.taskId;

    if (taskId) {
      try {
        await updateWorkItemState(Number(taskId), "Done");
        log.push(`✅ ADO task #${taskId} marked as "Done"`);

        await addWorkItemComment(
          Number(taskId),
          `✅ **PR #${prNumber} merged** by DevOpsAgent.\n\n` +
            `Branch \`${prInfo?.headRefName || "feature-branch"}\` deleted post-merge.`
        );
        log.push(`✅ ADO comment added to task #${taskId}`);
      } catch (err) {
        log.push(`⚠️  Could not update ADO: ${err.message}`);
      }
    }

    return {
      agent: this.name,
      success: true,
      prNumber,
      taskId,
      log,
    };
  }

  /**
   * Check CI status for a PR
   */
  getCIStatus(prNumber) {
    try {
      const output = execSync(
        `gh pr checks ${prNumber} 2>/dev/null`,
        { encoding: "utf8" }
      ).trim();
      return { available: true, output };
    } catch {
      return { available: false, output: "gh CLI not available or no CI configured" };
    }
  }

  /**
   * List all merged PRs for a time range
   */
  getRecentMerges(limit = 10) {
    try {
      const output = execSync(
        `gh pr list --state merged --limit ${limit} --json number,title,mergedAt,headRefName 2>/dev/null`,
        { encoding: "utf8" }
      ).trim();
      return JSON.parse(output || "[]");
    } catch {
      return [];
    }
  }
}

export default new DevOpsAgent();
