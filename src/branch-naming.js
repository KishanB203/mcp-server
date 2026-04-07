/**
 * Branch Naming Utility
 * Enforces the convention: feature/{task-id}-{task-name}
 * Example: feature/123-add-employee-form
 */

/**
 * Generate a branch name from a task ID and title
 * @param {number|string} taskId
 * @param {string} taskTitle
 * @returns {string} branch name
 */
export function generateBranchName(taskId, taskTitle) {
  const slug = slugify(taskTitle);
  return `feature/${taskId}-${slug}`;
}

/**
 * Convert a title to a URL-safe kebab-case slug (max 40 chars)
 */
function slugify(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special chars
    .replace(/\s+/g, "-")            // spaces to dashes
    .replace(/-+/g, "-")             // collapse multiple dashes
    .replace(/^-|-$/g, "")           // trim leading/trailing dashes
    .slice(0, 40)
    .replace(/-$/, "");              // trim trailing dash after slice
}

/**
 * Validate that a branch name follows the convention
 * @param {string} branchName
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateBranchName(branchName) {
  const pattern = /^feature\/\d+-[a-z0-9-]+$/;
  if (!pattern.test(branchName)) {
    return {
      valid: false,
      reason: `Branch "${branchName}" does not match pattern: feature/{task-id}-{task-name}`,
    };
  }
  return { valid: true };
}

/**
 * Extract task ID from a branch name
 * @param {string} branchName e.g. "feature/123-add-employee"
 * @returns {string|null}
 */
export function extractTaskIdFromBranch(branchName) {
  const match = branchName.match(/^feature\/(\d+)-/);
  return match ? match[1] : null;
}
