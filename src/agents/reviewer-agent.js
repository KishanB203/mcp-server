import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Reviewer Agent
 * Responsibilities:
 *   - Fetch PR diff
 *   - Check coding standards (rules/coding-standard.md)
 *   - Check architecture compliance (rules/architecture.md)
 *   - Check naming conventions (rules/naming-rule.md)
 *   - Check test coverage (rules/testing-rule.md)
 *   - Post review comments on GitHub PR
 */

export class ReviewerAgent {
  constructor() {
    this.name = "ReviewerAgent";
    this.role = "Code Reviewer";
    this.rulesDir = path.resolve(process.cwd(), "rules");
  }

  /**
   * Load a rule file as text
   */
  loadRule(filename) {
    try {
      const p = path.join(this.rulesDir, filename);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
    } catch {
      return "";
    }
  }

  /**
   * Get the diff for a PR branch vs main
   */
  getPRDiff(branchName) {
    try {
      return execSync(`git diff main...${branchName} 2>/dev/null`, {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      try {
        return execSync(`git diff HEAD~1 2>/dev/null`, { encoding: "utf8" });
      } catch {
        return "";
      }
    }
  }

  /**
   * Get list of changed files in a PR
   */
  getChangedFiles(branchName) {
    try {
      const output = execSync(
        `git diff --name-only main...${branchName} 2>/dev/null`,
        { encoding: "utf8" }
      ).trim();
      return output ? output.split("\n") : [];
    } catch {
      return [];
    }
  }

  /**
   * Run static analysis checks on changed files
   */
  analyzeCode(diff, changedFiles) {
    const issues = [];
    const warnings = [];
    const passed = [];

    // ── Naming Convention Checks ────────────────────────
    const badFileNames = changedFiles.filter((f) => {
      const base = path.basename(f, path.extname(f));
      // Components should be PascalCase, utilities camelCase
      const isComponent = f.includes("/components/") || f.includes("/pages/");
      if (isComponent) return !/^[A-Z][a-zA-Z0-9]*$/.test(base);
      return false;
    });
    if (badFileNames.length > 0) {
      issues.push(`❌ Naming: Component files must be PascalCase — ${badFileNames.join(", ")}`);
    } else {
      passed.push("✅ Naming: File naming conventions OK");
    }

    // ── Console.log Check ───────────────────────────────
    const consoleMatches = (diff.match(/^\+.*console\.log/gm) || []).length;
    if (consoleMatches > 0) {
      warnings.push(`⚠️  ${consoleMatches} console.log() call(s) found — remove before merge`);
    } else {
      passed.push("✅ Code Quality: No console.log() calls found");
    }

    // ── TODO/FIXME Check ────────────────────────────────
    const todoCount = (diff.match(/^\+.*(TODO|FIXME|HACK|XXX)/gm) || []).length;
    if (todoCount > 0) {
      warnings.push(`⚠️  ${todoCount} TODO/FIXME comment(s) found — address or track in ADO`);
    }

    // ── Test File Check ─────────────────────────────────
    const srcFiles = changedFiles.filter(
      (f) => f.endsWith(".js") || f.endsWith(".jsx") || f.endsWith(".ts") || f.endsWith(".tsx")
    );
    const testFiles = changedFiles.filter(
      (f) => f.includes(".test.") || f.includes(".spec.")
    );
    const nonTestSrcFiles = srcFiles.filter(
      (f) => !f.includes(".test.") && !f.includes(".spec.")
    );

    if (nonTestSrcFiles.length > 0 && testFiles.length === 0) {
      issues.push(
        `❌ Testing: No test files found. Add tests for: ${nonTestSrcFiles.slice(0, 3).join(", ")}`
      );
    } else if (testFiles.length > 0) {
      passed.push(`✅ Testing: ${testFiles.length} test file(s) included`);
    }

    // ── Architecture Layer Check ─────────────────────────
    const uiImportsDomain = changedFiles.some((f) => {
      if (!f.includes("/ui/")) return false;
      try {
        const content = fs.readFileSync(f, "utf8");
        return content.includes("from '../infrastructure/") ||
               content.includes("from \"../infrastructure/");
      } catch {
        return false;
      }
    });
    if (uiImportsDomain) {
      issues.push(
        "❌ Architecture: UI layer must not import directly from infrastructure layer"
      );
    } else {
      passed.push("✅ Architecture: Layer separation OK");
    }

    // ── Large File Check ─────────────────────────────────
    const largeAdditions = (diff.match(/^(\+[^\+])/gm) || []).length;
    if (largeAdditions > 500) {
      warnings.push(
        `⚠️  Large PR: ${largeAdditions} lines added — consider splitting into smaller PRs`
      );
    }

    // ── Hardcoded Credentials Check ─────────────────────
    const credentialPatterns = [
      /^\+.*password\s*=\s*["'][^"']{4,}/im,
      /^\+.*api_key\s*=\s*["'][^"']{4,}/im,
      /^\+.*secret\s*=\s*["'][^"']{4,}/im,
    ];
    for (const pattern of credentialPatterns) {
      if (pattern.test(diff)) {
        issues.push("❌ Security: Possible hardcoded credential detected — use environment variables");
        break;
      }
    }

    return { issues, warnings, passed };
  }

  /**
   * Run a full PR review
   * @param {number|string} prNumber
   * @param {string} branchName
   */
  async reviewPR(prNumber, branchName) {
    console.error(`[${this.name}] Reviewing PR #${prNumber} (branch: ${branchName})...`);

    const diff = this.getPRDiff(branchName);
    const changedFiles = this.getChangedFiles(branchName);
    const analysis = this.analyzeCode(diff, changedFiles);

    const reviewBody = this.buildReviewComment(analysis, changedFiles, prNumber);

    // Post review comment via gh CLI
    let posted = false;
    try {
      const escaped = reviewBody.replace(/'/g, "'\\''");
      execSync(`gh pr review ${prNumber} --comment --body '${escaped}'`, {
        stdio: "inherit",
      });
      posted = true;
    } catch (err) {
      // gh CLI not available or not in a repo
    }

    return {
      agent: this.name,
      prNumber,
      branchName,
      changedFiles,
      analysis,
      reviewBody,
      posted,
      approved: analysis.issues.length === 0,
    };
  }

  buildReviewComment(analysis, changedFiles, prNumber) {
    const { issues, warnings, passed } = analysis;
    const status = issues.length === 0 ? "✅ APPROVED" : "❌ CHANGES REQUESTED";

    const sections = [
      `## 🤖 Automated Code Review — PR #${prNumber}`,
      `**Status:** ${status}`,
      `**Files reviewed:** ${changedFiles.length}`,
      "",
    ];

    if (passed.length > 0) {
      sections.push("### ✅ Checks Passed", ...passed, "");
    }

    if (warnings.length > 0) {
      sections.push("### ⚠️ Warnings", ...warnings, "");
    }

    if (issues.length > 0) {
      sections.push("### ❌ Issues (must fix before merge)", ...issues, "");
    }

    sections.push(
      "---",
      "_Automated review by ReviewerAgent — Claude MCP Automation_"
    );

    return sections.join("\n");
  }
}

export default new ReviewerAgent();
