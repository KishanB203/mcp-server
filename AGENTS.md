# Multi-Agent Architecture
# ─────────────────────────────────────────────────────────────
# This file instructs AI agents on the full DevOps workflow.

## Agent Pipeline

```
Requirement → PBI Analysis → Design → Architecture → Code → PR → Review → Merge
```

## Agents & Responsibilities

### ProductOwnerAgent (`src/agents/product-owner-agent.js`)
- Fetch and validate ADO tasks
- Check description, acceptance criteria, story points
- Detect scope: UI required? API required?
- Post analysis as ADO comment

### ArchitectAgent (`src/agents/architect-agent.js`)
- Generate clean architecture folder structure
- Create domain entities, repository interfaces
- Create use cases and DTOs
- Create React components and pages
- Create test file stubs

### DeveloperAgent (`src/agents/developer-agent.js`)
- Run conflict preflight check (one branch per task)
- Create branch: `feature/{id}-{name}`
- Mark ADO task as "In Progress"
- Commit scaffold code
- Create GitHub PR with standard template

### ReviewerAgent (`src/agents/reviewer-agent.js`)
- Diff the PR branch vs main
- Check: naming conventions, console.log, test presence
- Check: architecture layer violations
- Check: hardcoded credentials
- Post review comment to GitHub PR

### DevOpsAgent (`src/agents/devops-agent.js`)
- Validate PR is open and not conflicted
- Merge PR (squash by default)
- Delete feature branch
- Mark ADO task as "Done"
- Add merge comment to ADO task

### SolutionRequirementsAgent (`src/agents/solution-requirements-agent.js`)
- Convert Figma/screen input + raw client requirements into implementation-ready docs
- Generate context.md, modular frontend/*.md UI specs, and backend/*.md (API surface, data model, services/integrations, security/auth)
- Create structured documentation for full-stack features

## MCP Tools (use via Claude Code)

Call `agent_full_workflow(taskId)` to run the complete pipeline.

Or call agents individually:
1. `agent_analyze_task(taskId)`
2. `figma_generate_wireframe(taskId)`
3. `agent_generate_architecture(featureName)`
4. `agent_generate_solution_requirements(featureName, businessRequirements)`
5. `agent_start_development(taskId)`
6. `agent_create_pr(taskId, branchName)`
7. `agent_review_pr(prNumber, branchName)`
8. `agent_merge_pr(prNumber)`

## Branch Convention
`feature/{task-id}-{kebab-case-title}`
Example: `feature/123-add-employee-form`

## Commit Convention
`feat: {title} [#{id}]`
Example: `feat: Add employee form [#123]`
