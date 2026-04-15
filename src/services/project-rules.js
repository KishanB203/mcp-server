/**
 * @module services/project-rules
 *
 * Single source of truth for repository coding standards: all `*.md` files
 * under the git root `rules/` directory.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * Git repository root for `projectDir`, or fallback to `process.cwd()`.
 *
 * @param {string} [projectDir]
 * @returns {string}
 */
export const getRepoRoot = (projectDir) => {
  const cwd = projectDir ? path.resolve(projectDir) : process.cwd();
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      cwd,
    }).trim();
  } catch {
    return cwd;
  }
};

/**
 * Absolute path to the project `rules/` directory.
 *
 * @param {string} [projectDir]
 * @returns {string}
 */
export const getProjectRulesDir = (projectDir) =>
  path.join(getRepoRoot(projectDir), "rules");

/**
 * Sorted list of `*.md` filenames in `rules/` (no paths). Empty if missing or unreadable.
 *
 * @param {{ projectDir?: string }} [options]
 * @returns {string[]}
 */
export const listProjectRuleMarkdownFiles = (options = {}) => {
  const rulesDir = getProjectRulesDir(options.projectDir);
  try {
    return fs
      .readdirSync(rulesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
};

/**
 * Loads and concatenates all markdown files from `rules/`, sorted by filename.
 * No truncation is applied.
 * @param {{ projectDir?: string }} [options]
 * @returns {string}
 */
export const loadProjectRulesMarkdown = (options = {}) => {
  const rulesDir = getProjectRulesDir(options.projectDir);

  let text = "";
  try {
    text = fs
      .readdirSync(rulesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort()
      .map((fileName) => {
        const fullPath = path.join(rulesDir, fileName);
        try {
          const content = fs.readFileSync(fullPath, "utf8").trim();
          return content ? `# ${fileName}\n\n${content}` : "";
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "";
  }

  return text;
};
