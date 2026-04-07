import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createGitHubClient } from "./github-client.js";

function readRule(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function getRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function getDiff(baseBranch, headBranch) {
  try {
    return execSync(`git diff ${baseBranch}...${headBranch}`, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function getChangedFiles(baseBranch, headBranch) {
  try {
    const out = execSync(`git diff --name-only ${baseBranch}...${headBranch}`, {
      encoding: "utf8",
    }).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function analyze(diff, changedFiles) {
  const issues = [];
  const warnings = [];
  const passed = [];

  const addedLines = (diff.match(/^\+(?!\+\+).*/gm) || []).length;
  if (addedLines > 1200) warnings.push(`⚠️ Large change set: ${addedLines} lines added`);

  const todoCount = (diff.match(/^\+.*\b(TODO|FIXME|HACK|XXX)\b/gm) || []).length;
  if (todoCount > 0) issues.push(`❌ TODO/FIXME present: ${todoCount} occurrence(s)`);
  else passed.push("✅ No TODO/FIXME markers");

  const consoleCount = (diff.match(/^\+.*\bconsole\.log\b/gm) || []).length;
  if (consoleCount > 0) warnings.push(`⚠️ console.log present: ${consoleCount} occurrence(s)`);
  else passed.push("✅ No console.log in additions");

  const secretLike = [
    /^\+.*(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/im,
    /^\+.*BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/im,
  ];
  if (secretLike.some((p) => p.test(diff))) issues.push("❌ Possible hardcoded secret detected");
  else passed.push("✅ No obvious hardcoded secrets");

  const srcLike = changedFiles.filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
  const tests = changedFiles.filter((f) => /\.(test|spec)\./.test(f));
  if (srcLike.length > 0 && tests.length === 0) warnings.push("⚠️ No test files detected in change set");
  else if (tests.length > 0) passed.push(`✅ Tests included: ${tests.length} file(s)`);

  return { issues, warnings, passed };
}

function renderComment({ prNumber, baseBranch, headBranch, changedFiles, rules, analysis }) {
  const status = analysis.issues.length === 0 ? "✅ APPROVED" : "❌ CHANGES REQUESTED";
  const lines = [
    `## 🤖 AI PR Review — #${prNumber}`,
    `**Status:** ${status}`,
    `**Compare:** \`${baseBranch}...${headBranch}\``,
    `**Files:** ${changedFiles.length}`,
    ``,
  ];

  if (analysis.passed.length) lines.push("### ✅ Passed", ...analysis.passed, "");
  if (analysis.warnings.length) lines.push("### ⚠️ Warnings", ...analysis.warnings, "");
  if (analysis.issues.length) lines.push("### ❌ Issues", ...analysis.issues, "");

  if (rules.trim()) {
    lines.push("### 📐 Rules considered", "```", rules.trim().slice(0, 2000), "```", "");
  }

  lines.push("---", "_Automated PR review by claude-mcp-automation_");
  return lines.join("\n");
}

export class PRReviewer {
  constructor(options = {}) {
    this.github = options.githubClient || createGitHubClient();
  }

  async reviewPR({ repo, prNumber, baseBranch = "main", headBranch }) {
    if (!prNumber) throw new Error("prNumber is required");
    if (!headBranch) throw new Error("headBranch is required");

    const repoRoot = getRepoRoot();
    const rulesDir = path.join(repoRoot, "rules");
    const rules = [
      readRule(path.join(rulesDir, "coding-standard.md")),
      readRule(path.join(rulesDir, "architecture.md")),
      readRule(path.join(rulesDir, "naming-rule.md")),
      readRule(path.join(rulesDir, "testing-rule.md")),
    ]
      .filter(Boolean)
      .join("\n\n");

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

export const prReviewer = new PRReviewer();

