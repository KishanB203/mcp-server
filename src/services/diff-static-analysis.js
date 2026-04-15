/**
 * @module services/diff-static-analysis
 *
 * Single implementation of automated diff checks used for:
 * - Pre-PR gate (stricter: e.g. console.log blocks PR creation)
 * - PR review comments (lenient: console.log is a warning only)
 *
 * Keeps "validation before create PR" and "ReviewerAgent" aligned on the same rules.
 */

/**
 * @param {string} diff
 * @param {string[]} changedFiles
 * @param {{ consoleAsIssue?: boolean, trackLargeChangeSet?: boolean }} [options]
 * @returns {{ issues: string[], warnings: string[], passed: string[] }}
 */
export const analyzeDiffStatic = (diff, changedFiles, options = {}) => {
  const consoleAsIssue = options.consoleAsIssue !== false;
  const trackLargeChangeSet = options.trackLargeChangeSet !== false;

  const issues = [];
  const warnings = [];
  const passed = [];

  if (trackLargeChangeSet) {
    const addedLines = (diff.match(/^\+(?!\+\+).*/gm) ?? []).length;
    if (addedLines > 1200) {
      warnings.push(`Large change set: ${addedLines} lines added — consider splitting`);
    }
  }

  const todoCount = (diff.match(/^\+.*\b(TODO|FIXME|HACK|XXX)\b/gm) ?? []).length;
  if (todoCount > 0) {
    issues.push(`TODO/FIXME present: ${todoCount} occurrence(s) — address or track in ADO`);
  } else {
    passed.push("No TODO/FIXME markers");
  }

  const consoleCount = (diff.match(/^\+.*\bconsole\.log\b/gm) ?? []).length;
  if (consoleCount > 0) {
    const msg = `console.log present: ${consoleCount} occurrence(s) — remove before merge`;
    if (consoleAsIssue) {
      issues.push(msg);
    } else {
      warnings.push(msg);
    }
  } else {
    passed.push("No console.log in additions");
  }

  const secretPatterns = [
    /^\+.*(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/im,
    /^\+.*BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/im,
  ];
  if (secretPatterns.some((p) => p.test(diff))) {
    issues.push("Possible hardcoded secret detected — use environment variables");
  } else {
    passed.push("No obvious hardcoded secrets");
  }

  const srcFiles = changedFiles.filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
  const testFiles = changedFiles.filter((f) => /\.(test|spec)\./.test(f));
  if (srcFiles.length > 0 && testFiles.length === 0) {
    warnings.push("No test files detected in change set — add tests before merge");
  } else if (testFiles.length > 0) {
    passed.push(`Tests included: ${testFiles.length} file(s)`);
  }

  return { issues, warnings, passed };
};
