import { prReviewer } from '../services/pr-reviewer.js';

const reviewPullRequest = async (prNumber, branchName, options = {}) => {
  const repo = {
    owner: process.env.REPO_OWNER,
    name: process.env.REPO_NAME,
  };

  const result = await prReviewer.reviewPR({
    repo,
    prNumber: Number(prNumber),
    baseBranch: options.baseBranch ?? process.env.BASE_BRANCH ?? 'main',
    headBranch: branchName,
  });

  return {
    reviewBody: result.comment,
    posted: Boolean(result.posted),
    approved: result.approved,
    analysis: result.analysis,
  };
};

export const reviewAgent = {
  reviewPullRequest,
};
