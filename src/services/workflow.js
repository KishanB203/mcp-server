/**
 * @module services/workflow
 *
 * Orchestrates the full automated DevOps pipeline for a single ADO task:
 *
 *   1.  Resolve task dependencies — abort if blockers exist
 *   2.  Fetch the ADO work item
 *   3.  Run ProductOwnerAgent analysis
 *   4.  Generate Figma wireframe (optional)
 *   5.  Scaffold clean architecture (optional)
 *   6.  Create a remote GitHub branch
 *   7.  Check out the branch locally
 *   8.  Mark the ADO task as "In Progress"
 *   9.  Commit and push the scaffold
 *   10. Create a GitHub pull request
 *   11. Run automated PR review
 *   12. Merge the PR if approved
 *   13. Mark the ADO task as "Done"
 *   14. Persist the task to project memory
 *
 * All steps that are non-fatal (Figma, ADO comments) are wrapped individually
 * so that a partial failure still allows the pipeline to continue.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

import { getWorkItem } from "../tools/ado/get-work-item.js";
import { updateWorkItemState, addWorkItemComment } from "../tools/ado/update-work-item.js";
import { createWorkItem } from "../tools/ado/create-work-item.js";
import { ticketAgent } from "../agents/ticketAgent.js";
import { codeAgent } from "../agents/codeAgent.js";
import { reviewAgent } from "../agents/reviewAgent.js";
import { runFigmaDesignWorkflow } from "../tools/figma/figma-tools.js";
import { validateFigmaConfig } from "../infrastructure/figma-client.js";
import { generateBranchName, validateBranchName } from "../tools/branch/branch-naming.js";
import { preflightCheck } from "../tools/branch/conflict-prevention.js";
import { buildPR } from "./pr-template.js";
import { createGitHubClient } from "../infrastructure/github-client.js";
import { taskDependencyResolver } from "./task-dependency.js";
import { appendTaskHistory, updateContext } from "../shared/memory.js";
import { createLogger } from "../shared/logger.js";
import { validateWorkflowConfig } from "../config/env.js";
import { validationTool } from "../tools/validationTool.js";
import { listMcpDocFiles, loadMcpDocsMarkdown } from "./mcp-docs.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerces a value to a finite integer or throws.
 *
 * @param {*}      value
 * @param {string} name   Variable name used in the error message
 * @returns {number}
 */
const mustInt = (value, name) => {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

/**
 * Converts a task title to a short URL-safe kebab-case slug (max 30 chars).
 *
 * @param {string} title
 * @returns {string}
 */
const slugFromTitle = (title = "") => {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

/**
 * Runs a git command with stdio inherited (output visible in terminal).
 *
 * @param {string} cmd
 * @param {{ projectDir?: string }} [options]
 */
const git = (cmd, options = {}) => {
  execSync(cmd, {
    stdio: "inherit",
    cwd: options.projectDir,
  });
}

/**
 * Runs a git command and returns trimmed stdout.
 *
 * @param {string} cmd
 * @param {{ projectDir?: string }} [options]
 * @returns {string}
 */
const gitOut = (cmd, options = {}) => {
  return execSync(cmd, {
    encoding: "utf8",
    cwd: options.projectDir,
  }).trim();
}

/**
 * Throws if the current working directory is not inside a git repository.
 */
const ensureGitRepo = (options = {}) => {
  try {
    gitOut("git rev-parse --is-inside-work-tree", options);
  } catch {
    throw new Error("Current directory is not a git repository");
  }
}

/**
 * Adds a comment to an ADO task without throwing on failure.
 * Used for informational updates that should not block the pipeline.
 *
 * @param {number} taskId
 * @param {string} comment
 */
async function safeAdoComment(taskId, comment) {
  try {
    await addWorkItemComment(taskId, comment);
  } catch {
    // Non-fatal — ADO comments are informational only.
  }
}

const extractScenariosFromAcceptanceCriteria = (criteriaText = "") => {
  const lines = String(criteriaText)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\-\*\u2022]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 0) return lines;
  return [
    "Validate expected happy-path behavior.",
    "Validate validation and error handling behavior.",
    "Validate role/permission and access-control behavior.",
  ];
}

const writeScenarioChecklistFile = ({ task, scenarios, projectDir }) => {
  const baseDir = projectDir ?? process.cwd();
  const dir = path.join(baseDir, "tmp", "review-checklists");
  fs.mkdirSync(dir, { recursive: true });
  const checklistPath = path.join(dir, `task-${task.id}-scenario-checklist.md`);
  const content = [
    `# Scenario Checklist — Task #${task.id}`,
    ``,
    `Title: ${task.title}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Scenarios to verify`,
    ...scenarios.map((s, idx) => `${idx + 1}. [ ] ${s}`),
    ``,
    `## Review sign-off`,
    `- [ ] Code-wise verified`,
    `- [ ] UI-wise verified`,
    `- [ ] Test-wise verified`,
  ].join("\n");
  fs.writeFileSync(checklistPath, content, "utf8");
  return checklistPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main workflow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full automated DevOps pipeline for one ADO task.
 *
 * @param {number|string} taskId  ADO work item ID
 * @param {object}  [options]
 * @param {import("../shared/logger.js").Logger} [options.logger]
 * @param {import("../infrastructure/github-client.js").GitHubClient} [options.githubClient]
 * @param {boolean} [options.skipFigma=false]
 * @param {boolean} [options.skipArch=false]
 * @param {boolean} [options.force=false]          Override conflict-preflight check
 * @param {string}  [options.baseBranch="main"]
 * @param {string}  [options.mergeMethod="squash"]
 * @param {string}  [options.commitMessage]
 * @returns {Promise<WorkflowResult>}
 *
 * @typedef {object} WorkflowResult
 * @property {boolean} success
 * @property {boolean} [blocked]
 * @property {string}  [reason]
 * @property {object}  [task]
 * @property {object}  [analysis]
 * @property {object}  [figma]
 * @property {object}  [architecture]
 * @property {string}  [branchName]
 * @property {boolean} [commitOk]
 * @property {object}  [pr]
 * @property {object}  [review]
 * @property {object}  [merge]
 */
export async function runWorkflow(taskId, options = {}) {
  const logger = options.logger ?? createLogger({ prefix: "workflow" });
  const github = options.githubClient ?? createGitHubClient();
  const projectDir = options.projectDir;

  const id = mustInt(taskId, "taskId");
  logger.logTaskStart(id);

  validateWorkflowConfig();
  ensureGitRepo({ projectDir });
  const mcpDocFiles = listMcpDocFiles({ projectDir });
  const mcpDocs = loadMcpDocsMarkdown({ projectDir });
  if (mcpDocFiles.length > 0) {
    logger.logAgentStep(
      "MCPDocs",
      `Loaded ${mcpDocFiles.length} file(s) from mcp_docs/`
    );
  }

  const repo = {
    owner: process.env.REPO_OWNER,
    name: process.env.REPO_NAME,
  };
  const baseBranch = options.baseBranch ?? process.env.BASE_BRANCH ?? "main";
  const autoCreateBugOnReviewFail = options.autoCreateBugOnReviewFail ?? true;

  // ── Step 1: Dependency resolution ────────────────────────────────────────
  const executionOrder = await taskDependencyResolver.resolveExecutionOrder(id);
  for (const execId of executionOrder) {
    if (execId === id) continue;
    const depCheck = await taskDependencyResolver.ensureDependenciesCompleted(execId);
    if (!depCheck.ok) {
      const blockerText = depCheck.blockedBy
        .map((b) => `#${b.id} [${b.state}] ${b.title}`)
        .join("\n");
      throw new Error(
        `Task #${id} cannot start because work is not in sequence.\n` +
          `Complete predecessor task(s) first:\n${blockerText}`
      );
    }
  }

  // ── Step 2: Fetch task ────────────────────────────────────────────────────
  const task = await getWorkItem(id);
  logger.logAgentStep("ADO", `Fetched work item "${task.title}"`);
  const checklistPath = writeScenarioChecklistFile({
    task,
    scenarios: extractScenariosFromAcceptanceCriteria(task.acceptanceCriteria),
    projectDir,
  });
  await safeAdoComment(
    id,
    `Scenario checklist generated for review and testing:\n\n${checklistPath}`
  );

  const depStatus = await taskDependencyResolver.ensureDependenciesCompleted(id);
  if (!depStatus.ok) {
    const blocked = depStatus.blockedBy
      .map((b) => `#${b.id} [${b.state}] ${b.title}`)
      .join("\n");
    await safeAdoComment(
      id,
      `Task cannot start because it is out of sequence.\n\n` +
        `Complete predecessor task(s) first:\n${blocked}`
    );
    throw new Error(
      `Task #${id} cannot start because it is out of sequence.\n` +
        `Complete predecessor task(s) first:\n${blocked}`
    );
  }

  // ── Step 3: PO analysis ───────────────────────────────────────────────────
  logger.logAgentStep("ProductOwnerAgent", "Analyze task");
  const po = await ticketAgent.analyzeTicket(id);

  // ── Step 4: Figma wireframe ───────────────────────────────────────────────
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

  // ── Step 5: Architecture scaffold ────────────────────────────────────────
  let architecture = null;
  const featureSlug = slugFromTitle(task.title) || `task-${task.id}`;
  if (!options.skipArch) {
    logger.logAgentStep("CodeAgent", `Generate scaffold "${featureSlug}"`);
    architecture = codeAgent.generateArchitecture(featureSlug, projectDir);
  }

  // ── Step 6: Branch planning ───────────────────────────────────────────────
  const branchName = generateBranchName(task.id, task.title);
  const nameCheck = validateBranchName(branchName);
  if (!nameCheck.valid) throw new Error(nameCheck.reason);

  const preflight = preflightCheck(task.id, branchName, { projectDir });
  if (!preflight.canProceed && !options.force) {
    await safeAdoComment(
      id,
      `Workflow blocked by conflicts:\n\n${preflight.warnings.join("\n")}`
    );
    return {
      success: false,
      blocked: true,
      reason: "conflict-preflight",
      preflight,
      branchName,
    };
  }

  // ── Step 7: Create remote branch ─────────────────────────────────────────
  logger.logAgentStep("GitHub", `Create remote branch ${branchName} from ${baseBranch}`);
  await github.createBranch(repo, baseBranch, branchName);

  // ── Step 8: Local checkout ────────────────────────────────────────────────
  logger.logAgentStep("Git", `Checkout ${baseBranch} and create ${branchName}`);
  git(`git fetch origin ${baseBranch}`, { projectDir });
  git(`git checkout ${baseBranch}`, { projectDir });
  git(`git pull origin ${baseBranch}`, { projectDir });
  try {
    git(`git checkout -b ${branchName}`, { projectDir });
  } catch {
    git(`git checkout ${branchName}`, { projectDir });
  }

  // ── Step 9: Mark In Progress ──────────────────────────────────────────────
  logger.logAgentStep("ADO", "Set state In Progress");
  try {
    await updateWorkItemState(task.id, "In Progress");
  } catch (e) {
    logger.warn(`ADO state update failed: ${e.message}`);
  }

  // ── Step 10: Commit and push ──────────────────────────────────────────────
  logger.logAgentStep("Git", "Commit and push");
  const commitMsg =
    options.commitMessage ?? `feat: implement ${task.title} [#${task.id}]`;
  let commitOk = false;
  try {
    git(`git add -A`, { projectDir });
    try {
      git(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { projectDir });
      commitOk = true;
    } catch {
      const status = gitOut("git status --porcelain", { projectDir });
      if (!status) {
        logger.warn("No changes to commit — scaffold already existed");
      } else {
        throw new Error("Commit failed");
      }
    }
    git(`git push -u origin ${branchName}`, { projectDir });
  } catch (e) {
    logger.warn(`Commit/push step failed: ${e.message}`);
  }

  // ── Step 11: Create PR ────────────────────────────────────────────────────
  const validation = validationTool.validateBranch(baseBranch, branchName, {
    projectDir,
  });
  if (!validation.valid) {
    await safeAdoComment(
      id,
      `Pre-PR checks failed before PR creation:\n${validation.issues.join("\n")}`
    );
    return {
      success: false,
      reason: "rules-validation",
      branchName,
      validation,
    };
  }

  logger.logAgentStep(
    "Validation",
    `Pre-PR checks passed (${validation.ruleFiles?.length ?? 0} rule file(s) under rules/)`
  );
  logger.logAgentStep("GitHub", "Create pull request");
  const prPayload = buildPR(task, {
    branchName,
    ruleFiles: validation.ruleFiles,
    figmaUrl: figma?.figmaFile?.url,
    summary: po?.analysis?.summary,
    changes:
      architecture?.structure?.files?.slice(0, 8)?.map((f) => `Created: ${f.path}`) ?? [],
    testCases: ["Unit tests pass", "Manual smoke test completed"],
  });

  const pr = await github.createPullRequest(
    repo,
    prPayload.title,
    prPayload.body,
    branchName,
    baseBranch
  );
  logger.logPRCreation(pr.url);
  await safeAdoComment(
    id,
    `Pull Request created:\n\n${pr.url}\n\nTitle: ${pr.title}`
  );
  try {
    await updateWorkItemState(task.id, "Resolved");
    await safeAdoComment(id, `PR #${pr.number} created and task moved to Resolved.`);
  } catch (e) {
    logger.warn(`ADO Resolved update failed: ${e.message}`);
  }

  // ── Step 12: PR review ────────────────────────────────────────────────────
  logger.logAgentStep("PRReviewer", `Review PR #${pr.number}`);
  const review = await reviewAgent.reviewPullRequest(pr.number, branchName, {
    baseBranch,
    projectDir,
  });

  if (!review.approved) {
    let createdBug = null;
    if (autoCreateBugOnReviewFail) {
      try {
        createdBug = await createWorkItem({
          type: "Bug",
          title: `Review gap: ${task.title}`,
          description:
            `Automated review found gaps for task #${task.id}.\n\n` +
            `Checklist file: ${checklistPath}\n\n` +
            `Please fix and re-run DeveloperAgent + ReviewAgent cycle.`,
          acceptanceCriteria: [
            "All review issues are resolved.",
            "All checklist scenarios pass (code/UI/test).",
            "No new review issues are reported in re-review.",
          ].join("\n"),
          sprint: task.iterationPath,
          areaPath: task.areaPath,
          parentId: task.id,
        });
      } catch (err) {
        logger.warn(`Failed to create bug ticket on review failure: ${err.message}`);
      }
    }
    await safeAdoComment(
      id,
      `PR review failed for ${pr.url}\n\n` +
        `Issues:\n${review.analysis.issues.join("\n")}\n\n` +
        `Checklist: ${checklistPath}\n` +
        (createdBug
          ? `Bug created for rework: #${createdBug.id} ${createdBug.url}\n`
          : "Bug ticket was not created automatically.\n") +
        `Please re-run development after fixing and then re-review.`
    );
    return {
      success: false,
      pr,
      review,
      merged: false,
      checklistPath,
      bug: createdBug,
    };
  }

  // ── Step 13: Merge ────────────────────────────────────────────────────────
  logger.logAgentStep("GitHub", `Merge PR #${pr.number}`);
  const merge = await github.mergePR(repo, pr.number, {
    mergeMethod: options.mergeMethod ?? "squash",
  });
  if (!merge.merged) {
    await safeAdoComment(
      id,
      `Merge failed for PR #${pr.number}: ${merge.message}`
    );
    return { success: false, pr, review, merge, merged: false };
  }
  logger.logMerge(pr.number);

  // ── Step 14: Mark Done ────────────────────────────────────────────────────
  logger.logAgentStep("ADO", "Set state Done");
  try {
    await updateWorkItemState(task.id, "Done");
    await safeAdoComment(id, `Merged PR #${pr.number} and marked task Done.`);
  } catch (e) {
    logger.warn(`ADO Done update failed: ${e.message}`);
  }

  // ── Persist to project memory ─────────────────────────────────────────────
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
    mcpDocs: {
      files: mcpDocFiles,
      markdown: mcpDocs,
    },
  };
}
