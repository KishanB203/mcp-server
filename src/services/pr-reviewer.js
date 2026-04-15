/**
 * @module services/pr-reviewer
 *
 * Automated pull-request reviewer.
 *
 * Compares a feature branch against its base, runs a set of static checks
 * on the diff and changed file list, then posts a structured review comment
 * to the GitHub PR via the REST API.
 *
 * Checks performed:
 *   - TODO / FIXME markers (fails the review)
 *   - console.log in additions (warning)
 *   - Possible hardcoded secrets (fails the review)
 *   - Missing test files (warning)
 *   - Large change sets (warning)
 */

import { execSync } from "child_process";
import { createGitHubClient } from "../infrastructure/github-client.js";
import { analyzeDiffStatic } from "./diff-static-analysis.js";
import { loadMcpDocsMarkdown } from "./mcp-docs.js";
import { loadProjectRulesMarkdown } from "./project-rules.js";

// ─────────────────────────────────────────────────────────────────────────────
// Git helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the unified diff between two branches.
 * Silently returns an empty string if git is unavailable.
 *
 * @param {string} baseBranch
 * @param {string} headBranch
 * @param {{ projectDir?: string }} [options]
 * @returns {string}
 */
const getDiff = (baseBranch, headBranch, options = {}) => {
  try {
    return execSync(`git diff ${baseBranch}...${headBranch}`, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      cwd: options.projectDir,
    });
  } catch {
    return "";
  }
}

/**
 * Returns the list of files changed between two branches.
 *
 * @param {string} baseBranch
 * @param {string} headBranch
 * @param {{ projectDir?: string }} [options]
 * @returns {string[]}
 */
const getChangedFiles = (baseBranch, headBranch, options = {}) => {
  try {
    const out = execSync(
      `git diff --name-only ${baseBranch}...${headBranch}`,
      { encoding: "utf8", cwd: options.projectDir }
    ).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Review comment builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a Markdown review comment from the analysis result.
 *
 * @param {{ prNumber:number, baseBranch:string, headBranch:string, changedFiles:string[], rules:string, mcpDocs:string, analysis:object }} params
 * @returns {string}
 */
const renderComment = ({
  prNumber,
  baseBranch,
  headBranch,
  changedFiles,
  rules,
  mcpDocs,
  analysis,
}) => {
  const status = analysis.issues.length === 0 ? "APPROVED" : "CHANGES REQUESTED";
  const lines = [
    `## AI PR Review — #${prNumber}`,
    `**Status:** ${status}`,
    `**Compare:** \`${baseBranch}...${headBranch}\``,
    `**Files:** ${changedFiles.length}`,
    "",
  ];

  if (analysis.passed.length) lines.push("### Passed", ...analysis.passed, "");
  if (analysis.warnings.length) lines.push("### Warnings", ...analysis.warnings, "");
  if (analysis.issues.length) lines.push("### Issues", ...analysis.issues, "");

  if (rules.trim()) {
    lines.push(
      "### Rules considered",
      "```",
      rules.trim(),
      "```",
      ""
    );
  }

  if (mcpDocs.trim()) {
    lines.push(
      "### MCP docs considered",
      "```",
      mcpDocs.trim(),
      "```",
      ""
    );
  }

  lines.push("---", "_Automated PR review by claude-mcp-automation_");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PRReviewer
// ─────────────────────────────────────────────────────────────────────────────

export class PRReviewer {
  /**
   * @param {{ githubClient?: import("../infrastructure/github-client.js").GitHubClient }} [options]
   */
  constructor(options = {}) {
    this.github = options.githubClient ?? createGitHubClient();
  }

  /**
   * Runs the full review pipeline for a PR:
   *   1. Load project rules from `/rules/`
   *   2. Fetch the git diff and list of changed files
   *   3. Run static analysis
   *   4. Post review comment to GitHub PR
   *
   * @param {{ repo: {owner:string,name:string}, prNumber: number, baseBranch?: string, headBranch: string, projectDir?: string }} params
   * @returns {Promise<ReviewResult>}
   *
   * @typedef {object} ReviewResult
   * @property {number}   prNumber
   * @property {boolean}  approved
   * @property {object}   analysis    { issues, warnings, passed }
   * @property {object}   posted      GitHub comment object
   * @property {string}   comment     Rendered review comment (Markdown)
   */
  async reviewPR({ repo, prNumber, baseBranch = "main", headBranch, projectDir }) {
    if (!prNumber) throw new Error("prNumber is required");
    if (!headBranch) throw new Error("headBranch is required");

    // Load all `rules/*.md` from the git root so new standards are picked up automatically.
    const rules = loadProjectRulesMarkdown({ projectDir });
    const mcpDocs = loadMcpDocsMarkdown({ projectDir });

    const diff = getDiff(baseBranch, headBranch, { projectDir });
    const changedFiles = getChangedFiles(baseBranch, headBranch, { projectDir });
    const analysisResult = analyzeDiffStatic(diff, changedFiles, {
      consoleAsIssue: false,
      trackLargeChangeSet: true,
    });

    const comment = renderComment({
      prNumber,
      baseBranch,
      headBranch,
      changedFiles,
      rules,
      mcpDocs,
      analysis: analysisResult,
    });

    const posted = await this.github.addPRComment(repo, Number(prNumber), comment);

    return {
      prNumber: Number(prNumber),
      approved: analysisResult.issues.length === 0,
      analysis: analysisResult,
      posted,
      comment,
    };
  }
}

/** Singleton instance for use in the MCP server and CLI. */
export const prReviewer = new PRReviewer();
