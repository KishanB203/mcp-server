#!/usr/bin/env node
/**
 * Claude MCP Automation — CLI
 *
 * Commands:
 *   claude work-on-task <id>         Full autonomous workflow for a task
 *   claude create-project <name>     Scaffold a new clean-architecture project
 *   claude review-pr <pr-number>     Run automated PR review
 *   claude generate-design <id>      Generate Figma wireframe for a task
 *   claude list-tasks [--sprint]     List ADO tasks
 *   claude merge-pr <pr-number>      Merge a PR and close ADO ticket
 */

import { program } from "commander";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getWorkItem } from "../src/tools/get-ticket.js";
import { listWorkItems } from "../src/tools/list-tickets.js";
import architectAgent from "../src/agents/architect-agent.js";
import devopsAgent from "../src/agents/devops-agent.js";
import { runFigmaDesignWorkflow } from "../src/figma-tools.js";
import { validateFigmaConfig } from "../src/figma-client.js";
import { runWorkflow } from "../src/workflow.js";
import { prReviewer } from "../src/pr-reviewer.js";
import { createGitHubClient } from "../src/github-client.js";
import { createLogger } from "../src/logger.js";

program
  .name("claude")
  .description("Claude MCP Automation CLI — AI-powered DevOps pipeline")
  .version("2.0.0");

// ─── work-on-task ──────────────────────────────────────────────
program
  .command("work-on-task <id>")
  .description(
    "FULL autonomous workflow: task → design → architecture/code → branch → commit → PR → review → merge"
  )
  .option("--skip-figma", "Skip Figma design generation")
  .option("--skip-arch", "Skip architecture scaffold generation")
  .option("--force", "Override conflict detection (proceed even if branch/PR exists)")
  .option("--base-branch <name>", "Base branch (default: main)")
  .option("--merge-method <method>", "Merge method: squash|merge|rebase", "squash")
  .action(async (id, opts) => {
    const taskId = parseInt(id, 10);
    console.log(`\n🚀 Starting autonomous workflow for task #${taskId}...\n`);

    try {
      const logger = createLogger({ prefix: "cli" });
      const result = await runWorkflow(taskId, {
        logger,
        githubClient: createGitHubClient(),
        skipFigma: Boolean(opts.skipFigma),
        skipArch: Boolean(opts.skipArch),
        force: Boolean(opts.force),
        baseBranch: opts.baseBranch,
        mergeMethod: opts.mergeMethod,
      });

      if (!result.success) {
        console.error("\n❌ Workflow did not complete successfully.");
        if (result.blocked) {
          console.error(`Blocked: ${result.reason}`);
          if (result.preflight?.warnings?.length) {
            result.preflight.warnings.forEach((w) => console.error(`- ${w}`));
          }
        }
        process.exit(1);
      }

      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  WORKFLOW COMPLETE — Task #${taskId}: ${result.task.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Branch:  ${result.branchName}
   PR:      ${result.pr.url}
   ADO:     ${result.task.url}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    } catch (err) {
      console.error(`\n❌ Workflow failed: ${err.message}`);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

// ─── create-project ────────────────────────────────────────────
program
  .command("create-project <name>")
  .description("Scaffold a new clean-architecture project structure")
  .option("--dir <directory>", "Target directory (default: current)")
  .action((name, opts) => {
    const targetDir = opts.dir ? path.resolve(opts.dir) : process.cwd();
    console.log(`\n🏗️  Creating project architecture: "${name}"\n`);

    try {
      const result = architectAgent.generateArchitecture(name, targetDir);
      console.log(result.message);
      console.log(`\nDirectories created: ${result.structure.directories.length}`);
      console.log(`Files created:       ${result.structure.files.length}`);
      console.log(`\nProject structure:`);
      result.structure.directories.forEach((d) =>
        console.log(`  📁 ${path.relative(targetDir, d)}`)
      );
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
      process.exit(1);
    }
  });

// ─── review-pr ─────────────────────────────────────────────────
program
  .command("review-pr <pr-number>")
  .description("Run automated code review on a PR (ReviewerAgent)")
  .option("--branch <branch>", "Branch name (auto-detected if not provided)")
  .action(async (prNumber, opts) => {
    console.log(`\n🔍 Reviewing PR #${prNumber}...\n`);

    try {
      // Auto-detect branch if not provided
      let branch = opts.branch;
      if (!branch) {
        try {
          const { execSync } = await import("child_process");
          const prInfo = JSON.parse(
            execSync(`gh pr view ${prNumber} --json headRefName`, {
              encoding: "utf8",
            })
          );
          branch = prInfo.headRefName;
        } catch {
          branch = `pr-${prNumber}`;
        }
      }

      const repo = { owner: process.env.REPO_OWNER, name: process.env.REPO_NAME };
      const result = await prReviewer.reviewPR({
        repo,
        prNumber: parseInt(prNumber, 10),
        baseBranch: process.env.BASE_BRANCH || "main",
        headBranch: branch,
      });

      console.log(result.comment);
      console.log(`\n✅ Review posted to PR #${prNumber}`);

      if (!result.approved) process.exit(1);
    } catch (err) {
      console.error(`❌ Review failed: ${err.message}`);
      process.exit(1);
    }
  });

// ─── generate-design ───────────────────────────────────────────
program
  .command("generate-design <id>")
  .description("Generate Figma wireframe for an Azure DevOps task")
  .action(async (id) => {
    const taskId = parseInt(id, 10);
    console.log(`\n🎨 Generating Figma design for task #${taskId}...\n`);

    try {
      validateFigmaConfig();
      const task = await getWorkItem(taskId);
      console.log(`   Task: "${task.title}"`);

      const result = await runFigmaDesignWorkflow(task);
      console.log(`\n✅ Figma design workflow complete:`);
      console.log(`   Figma URL: ${result.figmaFile?.url}`);
      console.log(`   Wireframe: ${result.wireframe?.message || "Spec generated"}`);
      console.log(`   ADO update: ${result.adoUpdate?.message || "Skipped"}`);
    } catch (err) {
      console.error(`❌ Design generation failed: ${err.message}`);
      if (err.message.includes("FIGMA_TOKEN")) {
        console.error("   Set FIGMA_TOKEN and FIGMA_FILE_KEY in your .env file.");
      }
      process.exit(1);
    }
  });

// ─── list-tasks ────────────────────────────────────────────────
program
  .command("list-tasks")
  .description("List Azure DevOps tasks")
  .option("--sprint <sprint>", "Filter by sprint path")
  .option("--state <state>", "Filter by state (To Do, In Progress, Done)")
  .option("--type <type>", "Filter by type (Task, Bug, User Story)")
  .option("--limit <n>", "Max results", "20")
  .action(async (opts) => {
    console.log("\n📋 Fetching Azure DevOps tasks...\n");
    try {
      const items = await listWorkItems({
        sprint: opts.sprint,
        state: opts.state,
        type: opts.type,
        limit: parseInt(opts.limit, 10),
      });

      if (items.length === 0) {
        console.log("No tasks found matching your filters.");
        return;
      }

      console.log(`Found ${items.length} task(s):\n`);
      items.forEach((item) => {
        console.log(
          `  #${item.id.toString().padEnd(6)} [${item.state.padEnd(12)}] ${item.title}`
        );
      });
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
      process.exit(1);
    }
  });

// ─── merge-pr ──────────────────────────────────────────────────
program
  .command("merge-pr <pr-number>")
  .description("Merge a PR and close the associated ADO task (DevOpsAgent)")
  .option("--strategy <strategy>", "Merge strategy: --squash, --merge, --rebase", "--squash")
  .option("--task-id <id>", "ADO task ID to close (auto-detected from branch)")
  .action(async (prNumber, opts) => {
    console.log(`\n🔀 Merging PR #${prNumber}...\n`);
    try {
      const result = await devopsAgent.mergePR(parseInt(prNumber, 10), {
        strategy: opts.strategy,
        taskId: opts.taskId ? parseInt(opts.taskId, 10) : undefined,
        repo: { owner: process.env.REPO_OWNER, name: process.env.REPO_NAME },
      });

      result.log.forEach((l) => console.log(`   ${l}`));

      if (result.success) {
        console.log(`\n✅ PR #${prNumber} merged successfully.`);
        if (result.taskId) {
          console.log(`✅ ADO task #${result.taskId} marked as Done.`);
        }
      } else {
        console.error(`\n❌ Merge failed: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
      process.exit(1);
    }
  });

program.showHelpAfterError();
program.showSuggestionAfterError();
program.parseAsync(process.argv);
