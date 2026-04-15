import { generateBranchName, validateBranchName } from '../tools/branch/branch-naming.js';
import { preflightCheck } from '../tools/branch/conflict-prevention.js';
import { ticketTool } from '../tools/ticketTool.js';
import { gitService } from '../services/gitService.js';
import {
  listProjectRuleMarkdownFiles,
  loadProjectRulesMarkdown,
} from '../services/project-rules.js';
import { prAgent } from './prAgent.js';

/**
 * Developer Agent
 * Responsibilities:
 *   - Create feature branch (one per task)
 *   - Generate code scaffold based on architecture
 *   - Commit changes
 *   - Push branch
 *   - Create GitHub PR using gh CLI
 */
const AGENT_NAME = 'DeveloperAgent';
const AGENT_ROLE = 'Developer';

/**
 * Full development workflow for a task.
 */
const workOnTask = async (task, options = {}) => {
  const { force = false } = options;
  const baseBranch = options.baseBranch ?? process.env.BASE_BRANCH ?? 'main';
  const projectDir = options.projectDir;
  console.error(`[${AGENT_NAME}] Starting work on task #${task.id}: ${task.title}`);
  const log = [];

  const branchName = generateBranchName(task.id, task.title);
  log.push(`Branch name: ${branchName}`);

  const nameCheck = validateBranchName(branchName);
  if (!nameCheck.valid) {
    throw new Error(nameCheck.reason);
  }

  const preflight = preflightCheck(task.id, branchName, { projectDir });
  if (!preflight.canProceed && !force) {
    log.push(...preflight.warnings);
    return {
      agent: AGENT_NAME,
      success: false,
      branchName,
      log,
      warning: 'Task already has an open branch/PR. Use --force to override.',
      preflight,
      projectRules: {
        files: listProjectRuleMarkdownFiles({ projectDir }),
        markdown: loadProjectRulesMarkdown({ projectDir }),
      },
    };
  }
  if (preflight.warnings.length > 0) {
    log.push(...preflight.warnings);
  }

  try {
    gitService.checkoutFeatureBranch(branchName, baseBranch, projectDir);
    const action = preflight.existingBranch ? 'Checked out existing branch' : 'Created branch';
    log.push(`${action}: ${branchName}`);
  } catch (err) {
    log.push(`Could not create branch (may be in detached state): ${err.message}`);
  }

  try {
    await ticketTool.updateState(task.id, 'In Progress');
    log.push(`ADO task #${task.id} marked as "In Progress"`);
  } catch (err) {
    log.push(`Could not update ADO state: ${err.message}`);
  }

  return {
    agent: AGENT_NAME,
    success: true,
    branchName,
    task,
    log,
    projectRules: {
      files: listProjectRuleMarkdownFiles({ projectDir }),
      markdown: loadProjectRulesMarkdown({ projectDir }),
    },
  };
};

/**
 * Commit and push current changes.
 */
const commitAndPush = (task, branchName, message) => {
  const projectDir = task?.projectDir;
  const commitMsg = message || `feat: ${task.title} [#${task.id}]`;
  try {
    gitService.commitAndPush(commitMsg, branchName, projectDir);
    return { success: true, commitMsg };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Create a GitHub PR using the configured PR agent.
 */
const createPR = async (task, branchName, options = {}) =>
  prAgent.createPullRequest(task, branchName, options);

export const developerAgent = {
  name: AGENT_NAME,
  role: AGENT_ROLE,
  workOnTask,
  commitAndPush,
  createPR,
};

export default developerAgent;
