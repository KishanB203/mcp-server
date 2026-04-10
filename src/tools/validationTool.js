import fs from 'fs';
import path from 'path';

import { gitTool } from './gitTool.js';

const readRulesSummary = () => {
  const rulesPath = path.resolve(process.cwd(), 'src/config/rules.md');
  if (!fs.existsSync(rulesPath)) {
    return '';
  }
  return fs.readFileSync(rulesPath, 'utf8');
}

const validateDiff = (diff, changedFiles) => {
  const issues = [];
  const warnings = [];
  const passed = [];

  const todoCount = (diff.match(/^\+.*\b(TODO|FIXME|HACK|XXX)\b/gm) ?? []).length;
  if (todoCount > 0) {
    issues.push(`TODO/FIXME markers found: ${todoCount}`);
  } else {
    passed.push('No TODO/FIXME markers');
  }

  const consoleCount = (diff.match(/^\+.*\bconsole\.log\b/gm) ?? []).length;
  if (consoleCount > 0) {
    issues.push(`console.log usage found: ${consoleCount}`);
  } else {
    passed.push('No console.log in additions');
  }

  const secretPattern =
    /^\+.*(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/im;
  if (secretPattern.test(diff)) {
    issues.push('Possible hardcoded secret detected');
  } else {
    passed.push('No obvious hardcoded secrets');
  }

  const sourceFiles = changedFiles.filter((filePath) => /\.(js|jsx|ts|tsx)$/.test(filePath));
  const testFiles = changedFiles.filter((filePath) => /\.(test|spec)\./.test(filePath));
  if (sourceFiles.length > 0 && testFiles.length === 0) {
    warnings.push('No test files detected for source changes');
  } else if (testFiles.length > 0) {
    passed.push(`Test files detected: ${testFiles.length}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    passed,
    rulesSummary: readRulesSummary(),
  };
}

export const validationTool = {
  validateBranch(baseBranch, headBranch) {
    const diff = gitTool.diff(baseBranch, headBranch);
    const changedFiles = gitTool.changedFiles(baseBranch, headBranch);
    return validateDiff(diff, changedFiles);
  },
  validateDiff,
};
