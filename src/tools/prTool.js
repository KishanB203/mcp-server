import { createGitHubClient } from '../infrastructure/github-client.js';

const githubClient = createGitHubClient();

export const prTool = {
  createBranch: async (repo, baseBranch, branchName) =>
    githubClient.createBranch(repo, baseBranch, branchName),
  createPullRequest: async (repo, title, body, head, base) =>
    githubClient.createPullRequest(repo, title, body, head, base),
  mergePullRequest: async (repo, prNumber, options = {}) =>
    githubClient.mergePR(repo, prNumber, options),
  addComment: async (repo, prNumber, body) =>
    githubClient.addPRComment(repo, prNumber, body),
};
