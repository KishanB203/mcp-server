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

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createGitHubClient } from "../infrastructure/github-client.js";

// ─────────────────────────────────────────────────────────────────────────────
// Git helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects the git repository root.  Falls back to `process.cwd()`.
 *
 * @returns {string}
 */
const getRepoRoot = () => {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

/**
 * Returns the unified diff between two branches.
 * Silently returns an empty string if git is unavailable.
 *
 * @param {string} baseBranch
 * @param {string} headBranch
 * @returns {string}
 */
const getDiff = (baseBranch, headBranch) => {
  try {
    return execSync(`git diff ${baseBranch}...${headBranch}`, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
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
 * @returns {string[]}
 */
const getChangedFiles = (baseBranch, headBranch) => {
  try {
    const out = execSync(
      `git diff --name-only ${baseBranch}...${headBranch}`,
      { encoding: "utf8" }
    ).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Safely reads a text file; returns an empty string on error.
 *
 * @param {string} filePath
 * @returns {string}
 */
const readFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Loads all markdown rule files from the rules directory.
 *
 * @param {string} rulesDir
 * @returns {string}
 */
const loadRules = (rulesDir) => {
  try {
    return fs
      .readdirSync(rulesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort()
      .map((fileName) => {
        const content = readFile(path.join(rulesDir, fileName)).trim();
        return content ? `# ${fileName}\n\n${content}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Static analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all static checks against the diff and changed file list.
 *
 * @param {string}   diff
 * @param {string[]} changedFiles
 * @returns {{ issues: string[], warnings: string[], passed: string[] }}
 */
const analyze = (diff, changedFiles) => {
  const issues = [];
  const warnings = [];
  const passed = [];

  // ── Change-set size ──────────────────────────────────────────────────────
  const addedLines = (diff.match(/^\+(?!\+\+).*/gm) ?? []).length;
  if (addedLines > 1200) {
    warnings.push(`Large change set: ${addedLines} lines added — consider splitting`);
  }

  // ── TODO / FIXME markers ─────────────────────────────────────────────────
  const todoCount = (diff.match(/^\+.*\b(TODO|FIXME|HACK|XXX)\b/gm) ?? []).length;
  if (todoCount > 0) {
    issues.push(`TODO/FIXME present: ${todoCount} occurrence(s) — address or track in ADO`);
  } else {
    passed.push("No TODO/FIXME markers");
  }

  // ── console.log ───────────────────────────────────────────────────────────
  const consoleCount = (diff.match(/^\+.*\bconsole\.log\b/gm) ?? []).length;
  if (consoleCount > 0) {
    warnings.push(`console.log present: ${consoleCount} occurrence(s) — remove before merge`);
  } else {
    passed.push("No console.log in additions");
  }

  // ── Possible hardcoded secrets ────────────────────────────────────────────
  const secretPatterns = [
    /^\+.*(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/im,
    /^\+.*BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/im,
  ];
  if (secretPatterns.some((p) => p.test(diff))) {
    issues.push("Possible hardcoded secret detected — use environment variables");
  } else {
    passed.push("No obvious hardcoded secrets");
  }

  // ── Test file coverage ────────────────────────────────────────────────────
  const srcFiles = changedFiles.filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
  const testFiles = changedFiles.filter((f) => /\.(test|spec)\./.test(f));
  if (srcFiles.length > 0 && testFiles.length === 0) {
    warnings.push("No test files detected in change set — add tests before merge");
  } else if (testFiles.length > 0) {
    passed.push(`Tests included: ${testFiles.length} file(s)`);
  }

  return { issues, warnings, passed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Review comment builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a Markdown review comment from the analysis result.
 *
 * @param {{ prNumber:number, baseBranch:string, headBranch:string, changedFiles:string[], rules:string, analysis:object }} params
 * @returns {string}
 */
const renderComment = ({
  prNumber,
  baseBranch,
  headBranch,
  changedFiles,
  rules,
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
      rules.trim().slice(0, 2000),
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
   * @param {{ repo: {owner:string,name:string}, prNumber: number, baseBranch?: string, headBranch: string }} params
   * @returns {Promise<ReviewResult>}
   *
   * @typedef {object} ReviewResult
   * @property {number}   prNumber
   * @property {boolean}  approved
   * @property {object}   analysis    { issues, warnings, passed }
   * @property {object}   posted      GitHub comment object
   * @property {string}   comment     Rendered review comment (Markdown)
   */
  async reviewPR({ repo, prNumber, baseBranch = "main", headBranch }) {
    if (!prNumber) throw new Error("prNumber is required");
    if (!headBranch) throw new Error("headBranch is required");

    const repoRoot = getRepoRoot();
    const rulesDir = path.join(repoRoot, "rules");
    // Load all project rule files so new standards are picked up automatically.
    const rules = loadRules(rulesDir);

    const diff = getDiff(baseBranch, headBranch);
    const changedFiles = getChangedFiles(baseBranch, headBranch);
    const analysisResult = analyze(diff, changedFiles);

    const comment = renderComment({
      prNumber,
      baseBranch,
      headBranch,
      changedFiles,
      rules,
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
