import { gitTool } from './gitTool.js';
import { analyzeDiffStatic } from '../services/diff-static-analysis.js';
import { loadMcpDocsMarkdown, listMcpDocFiles } from '../services/mcp-docs.js';
import {
  loadProjectRulesMarkdown,
  listProjectRuleMarkdownFiles,
} from '../services/project-rules.js';

const readRulesSummary = (projectDir) =>
  loadProjectRulesMarkdown({ projectDir });
const readMcpDocsSummary = (projectDir) =>
  loadMcpDocsMarkdown({ projectDir });

/**
 * @param {string} diff
 * @param {string[]} changedFiles
 * @returns {object}
 */
const validateDiff = (diff, changedFiles, options = {}) => {
  const projectDir = options.projectDir;
  const strict = analyzeDiffStatic(diff, changedFiles, {
    consoleAsIssue: true,
    trackLargeChangeSet: true,
  });
  const automatedReviewPreview = analyzeDiffStatic(diff, changedFiles, {
    consoleAsIssue: false,
    trackLargeChangeSet: true,
  });

  return {
    valid: strict.issues.length === 0,
    issues: strict.issues,
    warnings: strict.warnings,
    passed: strict.passed,
    /** Same checks ReviewerAgent uses after PR exists (console.log = warning). */
    automatedReviewPreview,
    ruleFiles: listProjectRuleMarkdownFiles({ projectDir }),
    rulesSummary: readRulesSummary(projectDir),
    mcpDocFiles: listMcpDocFiles({ projectDir }),
    mcpDocsSummary: readMcpDocsSummary(projectDir),
  };
}

export const validationTool = {
  validateBranch(baseBranch, headBranch, options = {}) {
    const projectDir = options.projectDir;
    const diff = gitTool.diff(baseBranch, headBranch, { projectDir });
    const changedFiles = gitTool.changedFiles(baseBranch, headBranch, { projectDir });
    return validateDiff(diff, changedFiles, { projectDir });
  },
  validateDiff,
};
