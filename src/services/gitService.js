import { generateBranchName, validateBranchName } from '../tools/branch/branch-naming.js';
import { gitTool } from '../tools/gitTool.js';
import { prTool } from '../tools/prTool.js';

const planBranch = (taskId, taskTitle) => {
  const branchName = generateBranchName(taskId, taskTitle);
  const validation = validateBranchName(branchName);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  return branchName;
};

const checkoutFeatureBranch = (branchName, baseBranch, projectDir) => {
  gitTool.ensureRepository({ projectDir });
  gitTool.checkoutBranch(branchName, baseBranch, { projectDir });
};

const commitAndPush = (commitMessage, branchName, projectDir) => {
  gitTool.commitAll(commitMessage, { projectDir });
  gitTool.pushUpstream(branchName, { projectDir });
};

const openPullRequest = async (repo, title, body, head, base) =>
  prTool.createPullRequest(repo, title, body, head, base);

export const gitService = {
  planBranch,
  checkoutFeatureBranch,
  commitAndPush,
  openPullRequest,
};
