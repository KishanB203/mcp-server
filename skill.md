# Skills Guide (Simple and Complete)

This file explains how work happens in this project in very simple words.
Anyone can follow this, even without deep technical knowledge.

---

## What this project does

This project helps teams do software work faster using agents (automated helpers).
It moves work from task to finished code using this flow:

`Task -> Analysis -> Design -> Code -> PR -> Review -> Merge`

---

## Main idea in one line

Give a task ID, and the system can run most steps automatically.

---

## Tools used in this project

- Azure DevOps: where tasks/work items are managed.
- Figma: where UI/wireframe design can be generated.
- GitHub: where code branches and pull requests are created.
- Agents: automated roles that do each part of the work.

---

## Agents and their jobs

### 1) ProductOwnerAgent

- Reads the task.
- Checks if task details are clear.
- Checks acceptance criteria and scope.
- Adds analysis comments back to the task.

### 2) ArchitectAgent

- Creates clean folder structure.
- Adds domain, application, infrastructure, and UI scaffolding.
- Adds basic file templates and test stubs.

### 3) DeveloperAgent

- Checks if branch/PR already exists for the task.
- Creates branch using naming rules.
- Marks task as "In Progress".
- Commits scaffold/code and creates PR.

### 4) ReviewerAgent

- Reviews PR changes.
- Checks code quality, naming, tests, and risky patterns.
- Adds review comments.

### 5) DevOpsAgent

- Verifies PR can be merged.
- Merges PR and deletes feature branch.
- Marks task as "Done" in Azure DevOps.

### 6) SolutionRequirementsAgent

- Converts raw requirements and screen/Figma input into clear docs.
- Produces implementation-ready docs for frontend and backend.

---

## Easiest way to do full work

Use one command/tool call:

`agent_full_workflow(taskId)`

This can handle:

- getting task details,
- analysis,
- optional design generation,
- architecture/scaffold creation,
- branch setup,
- task status update,
- PR creation.

---

## Standard step-by-step workflow

If doing work manually step by step:

1. Analyze task
  `agent_analyze_task(taskId)`
2. Generate wireframe (if UI needed)
  `figma_generate_wireframe(taskId)`
3. Generate architecture scaffold
  `agent_generate_architecture(featureName)`
4. (Optional but useful) generate solution docs
  `agent_generate_solution_requirements(featureName, businessRequirements, ...)`
5. Start development flow
  `agent_start_development(taskId)`
6. Create PR
  `agent_create_pr(taskId, branchName)`
7. Review PR
  `agent_review_pr(prNumber, branchName)`
8. Merge PR
  `agent_merge_pr(prNumber)`

---

## Important naming rules (do not skip)

### Branch name

Use:

`feature/{task-id}-{kebab-case-title}`

Example:

`feature/123-add-employee-form`

Do not create random branch names.

### PR title

Use:

`[Task-ID] Task Title`

Example:

`[123] Add employee management form`

### Commit message

Use:

`feat: {title} [#{id}]`

Example:

`feat: Add employee management form [#123]`

---

## Simple quality checklist (before merge)

Make sure these are true:

- Task acceptance criteria are covered.
- PR has clear description.
- Tests pass.
- No obvious security issues (like hardcoded credentials).
- No architecture layer violations.
- No unresolved review comments.

---

## For non-technical team members

You can still track progress easily:

- "Task analyzed?" -> check task comments.
- "Design ready?" -> check Figma link.
- "Code ready?" -> check PR status.
- "Reviewed?" -> check reviewer comments.
- "Done?" -> task state should be "Done".

---

## One quick example

If task `456` says: "Add login screen validation"

Typical flow:

- Run full workflow for `456`.
- Scaffold is created.
- Developer fills validation logic and tests.
- PR is created and reviewed.
- PR merged.
- Task becomes Done.

---

## Final note

If you want fastest execution with least manual work, start with:

`agent_full_workflow(taskId)`

Then only add business-specific logic and tests where needed.

---

---

# Skill: End-to-End Software Delivery Automation

## Overview

This skill enables automatic transformation of a business requirement into production-ready software like a complete software development lifecycle (SDLC), including requirement analysis, ticket generation, implementation, code review, and deployment readiness.

---

## Objectives

- Convert business requirements into structured development tasks
- Automate implementation with high-quality, maintainable code
- Ensure code quality through review and validation
- Deliver production-ready artifacts

---

## Input

- Business Requirement (BRD, user story, or plain text)

---

## Output

- Product Backlog Items (PBIs) / Tickets
- Implemented Code
- Pull Request (PR)
- Reviewed & Approved Code
- Production-ready build artifacts

---

## Workflow

### 1. Requirement Analysis

- Parse and understand the business requirement
- Identify:
  - Functional requirements
  - Non-functional requirements
  - Edge cases
- Generate acceptance criteria

---

### 2. PBI / Ticket Generation

- Break down requirement into PBIs:
  - Feature tickets
  - Subtasks
  - Technical tasks
- Include:
  - Title
  - Description
  - Acceptance Criteria
  - Priority
  - Dependencies

---

### 3. System Design

- Define:
  - Architecture
  - APIs / Contracts
  - Data models
- Ensure scalability and maintainability

---

### 4. Code Implementation

- Generate production-grade code:
  - Clean architecture
  - Proper naming conventions
  - Modular structure
- Include:
  - Unit tests
  - Error handling
  - Logging

---

### 5. Pull Request Creation

- Create PR with:
  - Summary of changes
  - Linked PBIs
  - Testing notes
- Follow repository contribution guidelines

---

### 6. Code Review

- Perform automated + rule-based review:
  - Code quality
  - Security checks
  - Performance considerations
- Suggest improvements
- Ensure all checks pass

---

### 7. Validation & Testing

- Run:
  - Unit tests
  - Integration tests
  - Regression checks
- Validate acceptance criteria

---

### 8. Production Readiness

- Ensure:
  - Build passes
  - No critical issues
  - Configurations are environment-safe
- Prepare deployment artifacts

---

## Constraints

- Follow coding standards and best practices
- Maintain test coverage > 80%

---

## Quality Gates

- All acceptance criteria met
- PR approved
- Tests passing
- No high/critical vulnerabilities

---

## Tools & Integrations

- Issue Tracking: Jira / Azure DevOps
- Version Control: GitHub / GitLab
- CI/CD: Jenkins / GitHub Actions
- Code Quality: SonarQube

---

## Example Flow

### Input

"Users should be able to reset their password via email"

### Output

1. PBIs:
  - Create reset password API
  - Email service integration
  - UI for reset form
2. Code:
  - Backend API
  - Email handler
  - Frontend form
3. PR:
  - Includes implementation + tests
4. Review:
  - Security validation (token expiry, encryption)
5. Production Ready:
  - Deployed with CI/CD pipeline

---

## Success Criteria

- Zero manual intervention required
- High-quality, maintainable code
- Faster delivery cycle
- Reduced human errors

---

## Notes

This skill is designed for autonomous or semi-autonomous software engineering systems and should be integrated with CI/CD and issue tracking systems for full effectiveness.