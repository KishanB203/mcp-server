/**
 * @module tools/branch/conflict-prevention
 *
 * Pre-flight checks that prevent duplicate branches and pull requests.
 *
 * Before starting work on any task the pipeline MUST call `preflightCheck()`
 * to detect:
 *   - An existing local or remote branch for the same task ID
 *   - An already-open GitHub PR for the same branch
 *
 * The `canProceed` flag is `true` only when no conflicts are found.
 * Pass `force: true` in the DeveloperAgent to override when necessary.
 */

import { execSync } from "child_process";
import { extractTaskIdFromBranch } from "./branch-naming.js";

// ─────────────────────────────────────────────────────────────────────────────
// Branch checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a branch already exists locally or on the remote.
 *
 * @param {string} branchName
 * @returns {{ exists: boolean, location?: 'local'|'remote' }}
 */
export const branchExists = (branchName) => {
  try {
    const local = execSync(`git branch --list "${branchName}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (local) return { exists: true, location: "local" };

    const remote = execSync(
      `git ls-remote --heads origin "${branchName}" 2>/dev/null`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    if (remote) return { exists: true, location: "remote" };

    return { exists: false };
  } catch {
    return { exists: false };
  }
};

/**
 * Lists all local and remote branches that belong to a given task ID.
 *
 * @param {number|string} taskId
 * @returns {string[]}  Branch names (trimmed, asterisk removed)
 */
export const findBranchesForTask = (taskId) => {
  try {
    const output = execSync(
      `git branch -a --list "*feature/${taskId}-*" 2>/dev/null`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    return output
      ? output.split("\n").map((b) => b.trim().replace(/^\*\s*/, ""))
      : [];
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PR checks (requires GitHub CLI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all currently open GitHub PRs that were created by this pipeline,
 * using the `gh` CLI.  Returns an empty array when `gh` is unavailable.
 *
 * @returns {Array<{number:number, title:string, branch:string, taskId:string|null}>}
 */
export const listOpenPRs = () => {
  try {
    const output = execSync(
      `gh pr list --state open --json number,title,headRefName 2>/dev/null`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    const prs = JSON.parse(output || "[]");
    return prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      branch: pr.headRefName,
      taskId: extractTaskIdFromBranch(pr.headRefName),
    }));
  } catch {
    return [];
  }
};

/**
 * Returns the open PR for a given task ID, or `null` if none exists.
 *
 * @param {number|string} taskId
 * @returns {{number:number,title:string,branch:string,taskId:string|null}|null}
 */
export const prExistsForTask = (taskId) => {
  return listOpenPRs().find((pr) => pr.taskId === String(taskId)) ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Preflight
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all conflict checks before the pipeline starts work on a task.
 *
 * @param {number|string} taskId
 * @param {string}        branchName  Proposed branch name (output of `generateBranchName`)
 * @returns {{ canProceed: boolean, warnings: string[], existingBranch: string|null, existingPR: object|null }}
 */
export const preflightCheck = (taskId, branchName) => {
  const warnings = [];
  let existingBranch = null;
  let existingPR = null;

  const branches = findBranchesForTask(taskId);
  if (branches.length > 0) {
    existingBranch = branches[0];
    warnings.push(
      `Branch already exists for task #${taskId}: ${existingBranch}`
    );
  }

  const pr = prExistsForTask(taskId);
  if (pr) {
    existingPR = pr;
    warnings.push(
      `Open PR #${pr.number} already exists for task #${taskId}: "${pr.title}"`
    );
  }

  const branchCheck = branchExists(branchName);
  if (branchCheck.exists) {
    warnings.push(
      `Branch "${branchName}" already exists (${branchCheck.location})`
    );
  }

  return {
    canProceed: warnings.length === 0,
    warnings,
    existingBranch,
    existingPR,
  };
};
