import { execSync } from "child_process";
import { extractTaskIdFromBranch } from "./branch-naming.js";

/**
 * Conflict Prevention Utilities
 * - Check if a branch already exists for a task
 * - List open PRs to avoid duplicates
 * - Ensure one branch per task
 */

/**
 * Check if a branch already exists locally or remotely
 */
export function branchExists(branchName) {
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
}

/**
 * List all open branches for a given task ID
 */
export function findBranchesForTask(taskId) {
  try {
    const output = execSync(
      `git branch -a --list "*feature/${taskId}-*" 2>/dev/null`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    return output ? output.split("\n").map((b) => b.trim().replace(/^\*\s*/, "")) : [];
  } catch {
    return [];
  }
}

/**
 * List all open PRs using GitHub CLI (if available)
 * Returns array of { number, title, branch, taskId }
 */
export function listOpenPRs() {
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
}

/**
 * Check if a PR already exists for a task
 */
export function prExistsForTask(taskId) {
  const openPRs = listOpenPRs();
  return openPRs.find((pr) => pr.taskId === String(taskId)) || null;
}

/**
 * Pre-flight check before starting work on a task
 * Returns { canProceed, warnings, existingBranch, existingPR }
 */
export function preflightCheck(taskId, branchName) {
  const warnings = [];
  let existingBranch = null;
  let existingPR = null;

  // Check for existing branches
  const branches = findBranchesForTask(taskId);
  if (branches.length > 0) {
    existingBranch = branches[0];
    warnings.push(
      `⚠️  Branch already exists for task #${taskId}: ${existingBranch}`
    );
  }

  // Check for existing PRs
  const pr = prExistsForTask(taskId);
  if (pr) {
    existingPR = pr;
    warnings.push(
      `⚠️  Open PR #${pr.number} already exists for task #${taskId}: "${pr.title}"`
    );
  }

  // Check exact branch name conflict
  const branchCheck = branchExists(branchName);
  if (branchCheck.exists) {
    warnings.push(
      `⚠️  Branch "${branchName}" already exists (${branchCheck.location})`
    );
  }

  return {
    canProceed: warnings.length === 0,
    warnings,
    existingBranch,
    existingPR,
  };
}
