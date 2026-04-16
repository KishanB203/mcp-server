import { buildPR } from '../services/pr-template.js';
import { gitService } from '../services/gitService.js';
import { validationTool } from '../tools/validationTool.js';
import { ticketTool } from '../tools/ticketTool.js';

const createBranchAndValidate = async (task, options = {}) => {
  const baseBranch = options.baseBranch ?? process.env.BASE_BRANCH ?? 'main';
  const projectDir = options.projectDir;
  const branchName = options.branchName ?? gitService.planBranch(task.id, task.title);

  if (!options.skipCheckout) {
    gitService.checkoutFeatureBranch(branchName, baseBranch, projectDir);
  }

  const validation = validationTool.validateBranch(baseBranch, branchName, { projectDir });
  return { branchName, baseBranch, validation };
};

const createPullRequest = async (task, branchName, options = {}) => {
  const baseBranch = options.baseBranch ?? process.env.BASE_BRANCH ?? 'main';
  const projectDir = options.projectDir;
  const repo = {
    owner: process.env.REPO_OWNER,
    name: process.env.REPO_NAME,
  };

  const validation = validationTool.validateBranch(baseBranch, branchName, { projectDir });
  if (!validation.valid) {
    return {
      success: false,
      error: `Pre-PR checks failed (fix before opening a PR): ${validation.issues.join('; ')}`,
      validation,
    };
  }

  const { title, body } = buildPR(task, {
    branchName,
    ruleFiles: validation.ruleFiles,
    ...options,
  });
  const pr = await gitService.openPullRequest(repo, title, body, branchName, baseBranch);
  try {
    await ticketTool.updateState(task.id, 'Resolved');
  } catch {
    // Non-fatal: PR was created successfully even if state update fails.
  }
  await ticketTool.addComment(task.id, `Pull Request created:\n\n${pr.url}\n\nTitle: ${pr.title}`);

  return {
    success: true,
    prUrl: pr.url,
    title: pr.title,
    validation,
    /** Same automated signals ReviewerAgent will use after the PR exists (issues block merge review). */
    automatedReviewPreview: validation.automatedReviewPreview,
  };
};

export const prAgent = {
  createBranchAndValidate,
  createPullRequest,
};
