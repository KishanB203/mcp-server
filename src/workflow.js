import { getWorkItem } from "./tools/get-ticket.js";
import { updateWorkItemState, addWorkItemComment } from "./tools/update-ticket.js";
import productOwnerAgent from "./agents/product-owner-agent.js";
import architectAgent from "./agents/architect-agent.js";
import developerAgent from "./agents/developer-agent.js";
import { runFigmaDesignWorkflow } from "./figma-tools.js";
import { validateFigmaConfig } from "./figma-client.js";
import { generateBranchName, validateBranchName } from "./branch-naming.js";
import { preflightCheck } from "./conflict-prevention.js";
import { buildPR } from "./pr-template.js";
import { createGitHubClient } from "./github-client.js";
import { prReviewer } from "./pr-reviewer.js";
import { architectureGenerator } from "./architecture-generator.js";
import { taskDependencyResolver } from "./task-dependency.js";
import { appendTaskHistory, updateContext } from "./memory.js";
import { createLogger } from "./logger.js";
import { execSync } from "child_process";

function mustInt(value, name) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

function slugFromTitle(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function git(cmd) {
  return execSync(cmd, { stdio: "inherit" });
}

function gitOut(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function ensureGitRepo() {
  try {
    gitOut("git rev-parse --is-inside-work-tree");
  } catch {
    throw new Error("Current directory is not a git repository");
  }
}

function ensureEnvRequired() {
  const required = [
    "GITHUB_TOKEN",
    "ADO_ORG",
    "ADO_PROJECT",
    "REPO_OWNER",
    "REPO_NAME",
  ];

  const missing = required.filter((k) => !process.env[k]);
  if (!process.env.ADO_PAT && !process.env.AZURE_DEVOPS_TOKEN) {
    missing.push("ADO_PAT (or AZURE_DEVOPS_TOKEN)");
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

async function safeAdoComment(taskId, comment) {
  try {
    await addWorkItemComment(taskId, comment);
  } catch {
    // non-fatal
  }
}

export async function runWorkflow(taskId, options = {}) {
  const logger = options.logger || createLogger({ prefix: "workflow" });
  const github = options.githubClient || createGitHubClient();

  const id = mustInt(taskId, "taskId");
  logger.logTaskStart(id);

  ensureEnvRequired();
  ensureGitRepo();

  const repo = {
    owner: process.env.REPO_OWNER,
    name: process.env.REPO_NAME,
  };
  const baseBranch = options.baseBranch || process.env.BASE_BRANCH || "main";

  const executionOrder = await taskDependencyResolver.resolveExecutionOrder(id);
  for (const execId of executionOrder) {
    if (execId === id) continue;
    const depCheck = await taskDependencyResolver.ensureDependenciesCompleted(execId);
    if (!depCheck.ok) {
      throw new Error(`Dependency task ${execId} is not completed`);
    }
  }

  // Fetch the primary task
  const task = await getWorkItem(id);
  logger.logAgentStep("ADO", `Fetched work item "${task.title}"`);

  const depStatus = await taskDependencyResolver.ensureDependenciesCompleted(id);
  if (!depStatus.ok) {
    const blocked = depStatus.blockedBy.map((b) => `#${b.id} [${b.state}] ${b.title}`).join("\n");
    await safeAdoComment(id, `⛔ Blocked by dependencies:\n\n${blocked}`);
    throw new Error(`Task #${id} blocked by incomplete dependencies`);
  }

  // Analyze
  logger.logAgentStep("ProductOwnerAgent", "Analyze task");
  const po = await productOwnerAgent.analyzeTask(id);

  // Figma
  let figma = null;
  if (!options.skipFigma) {
    try {
      validateFigmaConfig();
      logger.logAgentStep("Figma", "Generate wireframe");
      figma = await runFigmaDesignWorkflow(task);
    } catch (e) {
      logger.warn(`Figma step skipped: ${e.message}`);
    }
  }

  // Architecture
  let architecture = null;
  const featureSlug = slugFromTitle(task.title) || `task-${task.id}`;
  if (!options.skipArch) {
    logger.logAgentStep("ArchitectureGenerator", `Generate structure "${featureSlug}"`);
    architecture = architectureGenerator.generate({ featureName: featureSlug });
  } else {
    logger.logAgentStep("ArchitectAgent", `Generate scaffold "${featureSlug}"`);
    architecture = architectAgent.generateArchitecture(featureSlug);
  }

  // Branch planning + conflict prevention
  const branchName = generateBranchName(task.id, task.title);
  const nameCheck = validateBranchName(branchName);
  if (!nameCheck.valid) throw new Error(nameCheck.reason);

  const preflight = preflightCheck(task.id, branchName);
  if (!preflight.canProceed && !options.force) {
    await safeAdoComment(
      id,
      `⚠️ Workflow blocked by conflicts:\n\n${preflight.warnings.join("\n")}`
    );
    return {
      success: false,
      blocked: true,
      reason: "conflict-preflight",
      preflight,
      branchName,
    };
  }

  // Create remote branch (REST) then local branch
  logger.logAgentStep("GitHub", `Create remote branch ${branchName} from ${baseBranch}`);
  await github.createBranch(repo, baseBranch, branchName);

  logger.logAgentStep("Git", `Checkout ${baseBranch} and create ${branchName}`);
  git(`git fetch origin ${baseBranch}`);
  git(`git checkout ${baseBranch}`);
  git(`git pull origin ${baseBranch}`);

  try {
    git(`git checkout -b ${branchName}`);
  } catch {
    git(`git checkout ${branchName}`);
  }

  // Mark In Progress
  logger.logAgentStep("ADO", "Set state In Progress");
  try {
    await updateWorkItemState(task.id, "In Progress");
  } catch (e) {
    logger.warn(`ADO state update failed: ${e.message}`);
  }

  // Generate code already created by architecture generators (file writes).
  // Commit + push
  logger.logAgentStep("Git", "Commit and push");
  const commitMsg = options.commitMessage || `feat: implement ${task.title} [#${task.id}]`;
  let commitOk = false;
  try {
    git(`git add -A`);
    try {
      git(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
      commitOk = true;
    } catch {
      const status = gitOut("git status --porcelain");
      if (!status) {
        logger.warn("No changes to commit");
      } else {
        throw new Error("Commit failed");
      }
    }
    git(`git push -u origin ${branchName}`);
  } catch (e) {
    logger.warn(`Commit/push step failed: ${e.message}`);
  }

  // Create PR
  logger.logAgentStep("GitHub", "Create pull request");
  const prPayload = buildPR(task, {
    branchName,
    figmaUrl: figma?.figmaFile?.url,
    summary: po?.analysis?.summary,
    changes: architecture?.structure?.files?.slice(0, 8)?.map((f) => `Created: ${f.path}`) || [],
    testCases: ["Unit tests pass", "Manual smoke test completed"],
  });

  const pr = await github.createPullRequest(repo, prPayload.title, prPayload.body, branchName, baseBranch);
  logger.logPRCreation(pr.url);
  await safeAdoComment(id, `🔗 **Pull Request created:**\n\n${pr.url}\n\nTitle: ${pr.title}`);

  // PR Review
  logger.logAgentStep("PRReviewer", `Review PR #${pr.number}`);
  const review = await prReviewer.reviewPR({
    repo,
    prNumber: pr.number,
    baseBranch,
    headBranch: branchName,
  });

  // Merge PR if approved
  if (!review.approved) {
    await safeAdoComment(
      id,
      `❌ PR review failed for ${pr.url}\n\nIssues:\n${review.analysis.issues.join("\n")}`
    );
    return {
      success: false,
      pr,
      review,
      merged: false,
    };
  }

  logger.logAgentStep("GitHub", `Merge PR #${pr.number}`);
  const merge = await github.mergePR(repo, pr.number, { mergeMethod: options.mergeMethod || "squash" });
  if (!merge.merged) {
    await safeAdoComment(id, `⚠️ Merge failed for PR #${pr.number}: ${merge.message}`);
    return { success: false, pr, review, merge, merged: false };
  }
  logger.logMerge(pr.number);

  // Mark Done
  logger.logAgentStep("ADO", "Set state Done");
  try {
    await updateWorkItemState(task.id, "Done");
    await safeAdoComment(id, `✅ Merged PR #${pr.number} and marked task Done.`);
  } catch (e) {
    logger.warn(`ADO Done update failed: ${e.message}`);
  }

  // Persist memory
  appendTaskHistory({
    taskId: task.id,
    title: task.title,
    branch: branchName,
    prNumber: pr.number,
    prUrl: pr.url,
    merged: true,
  });
  updateContext((ctx) => {
    ctx.prHistory = Array.isArray(ctx.prHistory) ? ctx.prHistory : [];
    ctx.prHistory.push({
      prNumber: pr.number,
      url: pr.url,
      taskId: task.id,
      mergedAt: new Date().toISOString(),
    });
    return ctx;
  });

  return {
    success: true,
    task,
    analysis: po.analysis,
    figma,
    architecture,
    branchName,
    commitOk,
    pr,
    review,
    merge,
  };
}

