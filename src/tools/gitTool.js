import { execSync } from 'child_process';

/**
 * Executes git commands and returns raw command output.
 */
const run = (command, options = {}) => {
  return execSync(command, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
}

export const gitTool = {
  ensureRepository() {
    try {
      run('git rev-parse --is-inside-work-tree');
    } catch {
      throw new Error('Current directory is not a git repository');
    }
  },
  checkoutBranch(branchName, baseBranch = 'main') {
    run(`git fetch origin ${baseBranch}`);
    run(`git checkout ${baseBranch}`);
    run(`git pull origin ${baseBranch}`);
    try {
      run(`git checkout -b ${branchName}`);
    } catch {
      run(`git checkout ${branchName}`);
    }
  },
  commitAll(message) {
    run('git add -A');
    run(`git commit -m "${String(message).replace(/"/g, '\\"')}"`);
  },
  pushUpstream(branchName) {
    run(`git push -u origin ${branchName}`);
  },
  diff(baseBranch, headBranch) {
    return run(`git diff ${baseBranch}...${headBranch}`);
  },
  changedFiles(baseBranch, headBranch) {
    const output = run(`git diff --name-only ${baseBranch}...${headBranch}`).trim();
    return output ? output.split('\n') : [];
  },
};
