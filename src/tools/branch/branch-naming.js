/**
 * @module tools/branch/branch-naming
 *
 * Utilities for generating and validating Git branch names that follow
 * the project convention:
 *
 *   feature/{task-id}-{kebab-case-title}
 *
 * Examples:
 *   feature/123-add-employee-form
 *   feature/456-fix-login-redirect
 *
 * Rules:
 *   - Always prefixed with "feature/"
 *   - Task ID immediately follows the prefix
 *   - Title portion is lowercased, special chars removed, spaces → dashes
 *   - Maximum total slug length of 40 characters for the title segment
 */

/**
 * Generates a branch name from an ADO task ID and task title.
 *
 * @param {number|string} taskId    ADO work item ID
 * @param {string}        taskTitle Work item title (will be slugified)
 * @returns {string}                Branch name e.g. "feature/123-my-task"
 */
export const generateBranchName = (taskId, taskTitle) => {
  const slug = slugify(taskTitle);
  return `feature/${taskId}-${slug}`;
};

/**
 * Validates that a branch name conforms to the project convention.
 *
 * @param {string} branchName
 * @returns {{ valid: boolean, reason?: string }}
 */
export const validateBranchName = (branchName) => {
  const pattern = /^feature\/\d+-[a-z0-9-]+$/;
  if (!pattern.test(branchName)) {
    return {
      valid: false,
      reason: `Branch "${branchName}" does not match required pattern: feature/{task-id}-{task-name}`,
    };
  }
  return { valid: true };
};

/**
 * Extracts the ADO task ID embedded in a branch name.
 * Returns `null` when the branch does not follow the convention.
 *
 * @param {string} branchName  e.g. "feature/123-add-employee"
 * @returns {string|null}      e.g. "123"
 */
export const extractTaskIdFromBranch = (branchName) => {
  const match = String(branchName ?? "").match(/^feature\/(\d+)-/);
  return match ? match[1] : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts arbitrary text to a URL-safe kebab-case slug (max 40 chars).
 *
 * @param {string} text
 * @returns {string}
 */
const slugify = (text = "") => {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special chars
    .replace(/\s+/g, "-")            // spaces → dashes
    .replace(/-+/g, "-")             // collapse consecutive dashes
    .replace(/^-|-$/g, "")           // trim leading / trailing dashes
    .slice(0, 40)
    .replace(/-$/, "");              // trim trailing dash that may appear after slice
}
