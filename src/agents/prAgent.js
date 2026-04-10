import { buildPR } from '../services/pr-template.js';
import { gitService } from '../services/gitService.js';
import { validationTool } from '../tools/validationTool.js';
import { ticketTool } from '../tools/ticketTool.js';

const createBranchAndValidate = async (task, options = {}) => {
  const baseBranch = options.baseBranch ?? process.env.BASE_BRANCH ?? 'main';
  const branchName = options.branchName ?? gitService.planBranch(task.id, task.title);

  if (!options.skipCheckout) {
    gitService.checkoutFeatureBranch(branchName, baseBranch);
  }

  const validation = validationTool.validateBranch(baseBranch, branchName);
  return { branchName, baseBranch, validation };
};

const createPullRequest = async (task, branchName, options = {}) => {
  const baseBranch = options.baseBranch ?? process.env.BASE_BRANCH ?? 'main';
  const repo = {
    owner: process.env.REPO_OWNER,
    name: process.env.REPO_NAME,
  };

  const validation = validationTool.validateBranch(baseBranch, branchName);
  if (!validation.valid) {
    return {
      success: false,
      error: `Rules validation failed: ${validation.issues.join('; ')}`,
      validation,
    };
  }

  const { title, body } = buildPR(task, { branchName, ...options });
  const pr = await gitService.openPullRequest(repo, title, body, branchName, baseBranch);
  await ticketTool.addComment(task.id, `Pull Request created:\n\n${pr.url}\n\nTitle: ${pr.title}`);

  return {
    success: true,
    prUrl: pr.url,
    title: pr.title,
    validation,
  };
};

export const prAgent = {
  createBranchAndValidate,
  createPullRequest,
};
