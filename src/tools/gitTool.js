import { execSync } from 'child_process';

/**
 * Executes git commands and returns raw command output.
 */
const run = (command, options = {}) => {
  return execSync(command, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    cwd: options.cwd,
  });
}

export const gitTool = {
  ensureRepository(options = {}) {
    try {
      run('git rev-parse --is-inside-work-tree', { cwd: options.projectDir });
    } catch {
      throw new Error('Current directory is not a git repository');
    }
  },
  checkoutBranch(branchName, baseBranch = 'main', options = {}) {
    const cwd = options.projectDir;
    run(`git fetch origin ${baseBranch}`, { cwd });
    run(`git checkout ${baseBranch}`, { cwd });
    run(`git pull origin ${baseBranch}`, { cwd });
    try {
      run(`git checkout -b ${branchName}`, { cwd });
    } catch {
      run(`git checkout ${branchName}`, { cwd });
    }
  },
  commitAll(message, options = {}) {
    const cwd = options.projectDir;
    run('git add -A', { cwd });
    run(`git commit -m "${String(message).replace(/"/g, '\\"')}"`, { cwd });
  },
  pushUpstream(branchName, options = {}) {
    run(`git push -u origin ${branchName}`, { cwd: options.projectDir });
  },
  diff(baseBranch, headBranch, options = {}) {
    return run(`git diff ${baseBranch}...${headBranch}`, { cwd: options.projectDir });
  },
  changedFiles(baseBranch, headBranch, options = {}) {
    const output = run(`git diff --name-only ${baseBranch}...${headBranch}`, {
      cwd: options.projectDir,
    }).trim();
    return output ? output.split('\n') : [];
  },
};
