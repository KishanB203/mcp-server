# MCP Automation v2.0

> AI-powered DevOps pipeline: Azure DevOps → Figma → Clean Architecture → GitHub PR → Code Review → Merge

One command automates your entire development workflow:

```bash
mcp work-on-task 123
```

mcp will:
1. 📋 Fetch and analyze the Azure DevOps task
2. 🎨 Generate a Figma wireframe (for UI tasks)
3. 🏗️ Generate clean architecture + runnable base code (domain/application/infrastructure/ui)
4. 🌿 Create branch (`feature/{id}-{slug}`) locally + remotely
5. 📤 Commit, push, and create a PR (GitHub REST API)
6. 🔍 Run AI PR review and post comments (GitHub REST API)
7. ✅ Merge PR (GitHub REST API) and close the ADO ticket

---

## Architecture

```
mcp-automation/
├── src/
│   ├── index.js                    ← MCP Server (17 tools)
│   ├── ado-client.js               ← Azure DevOps API client
│   ├── figma-client.js             ← Figma API client
│   ├── figma-tools.js              ← Figma workflow tools
│   ├── github-client.js            ← GitHub REST API client
│   ├── workflow.js                 ← Fully autonomous orchestrator
│   ├── task-dependency.js          ← Dependency detection/execution ordering
│   ├── architecture-generator.js   ← Clean architecture code generator
│   ├── pr-reviewer.js              ← AI PR review + comment posting
│   ├── memory.js                   ← Persistent project memory
│   ├── logger.js                   ← Timestamped logging
│   ├── branch-naming.js            ← Branch name enforcement
│   ├── pr-template.js              ← PR title/body builder
│   ├── conflict-prevention.js      ← Duplicate branch/PR detection
│   ├── agents/
│   │   ├── product-owner-agent.js  ← Task analysis & validation
│   │   ├── architect-agent.js      ← Clean arch scaffold generator
│   │   ├── developer-agent.js      ← Branch, commit, PR creation
│   │   ├── reviewer-agent.js       ← Automated code review
│   │   └── devops-agent.js         ← PR merge & ticket closure
│   └── tools/
│       ├── get-ticket.js
│       ├── list-tickets.js
│       └── update-ticket.js
├── cli/
│   └── index.js                    ← CLI commands
├── memory/
│   └── project-context.json        ← Persistent project context/history
├── .github/
│   └── PULL_REQUEST_TEMPLATE/
│       └── pull_request_template.md
├── .env.example                    ← Environment variable template
└── README.md
```

---

## Prerequisites

- **Node.js** 18+
- **Azure DevOps** account with a Personal Access Token
- **Git** (local repo with `origin` remote configured)
- **Figma** account with a Personal Access Token (optional)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Azure DevOps (required)
ADO_ORG=your-org-name
ADO_PROJECT=your-project-name
ADO_PAT=your-personal-access-token
# or
AZURE_DEVOPS_TOKEN=your-personal-access-token

# Figma (optional — enables wireframe generation)
FIGMA_TOKEN=your-figma-token
FIGMA_FILE_KEY=your-figma-file-key

# GitHub (required for autonomous workflow)
GITHUB_TOKEN=your-github-token
REPO_OWNER=your-org-or-user
REPO_NAME=your-repo
BASE_BRANCH=main
```

#### Getting your Azure DevOps PAT
1. Go to `https://dev.azure.com/{org}/_usersSettings/tokens`
2. Click **New Token**
3. Scopes needed: **Work Items → Read, Write & Manage**

#### Getting your Figma Token
1. Go to `https://www.figma.com/settings`
2. Scroll to **Personal access tokens**
3. Click **Create a new token**

#### Getting your Figma File Key
From the Figma URL: `https://www.figma.com/file/{FILE_KEY}/...`

### 3. Configure Code MCP

Add to your `desktop_config.json` (or Code config):

```json
{
  "mcpServers": {
    "mcp-automation": {
      "command": "node",
      "args": ["/path/to/mcp-automation/src/index.js"]
    }
  }
}
```

---

## CLI Usage

Install globally for convenience:

```bash
npm link
# or
npm install -g .
```

### Commands

#### `work-on-task` — Full automated workflow

```bash
mcp work-on-task 123
mcp work-on-task 123 --skip-figma
mcp work-on-task 123 --skip-arch
mcp work-on-task 123 --force  # override conflict detection
```

**What it does:**
1. Fetches and analyzes ADO task #123
2. Generates Figma wireframe (if `FIGMA_TOKEN` is set)
3. Scaffolds clean architecture under `src/`
4. Creates `feature/123-task-name` branch
5. Marks ADO task as "In Progress"
6. Commits scaffold and creates GitHub PR

---

#### `create-project` — Scaffold a new clean-architecture project/feature

```bash
mcp create-project "employee management"
mcp create-project "order-tracking" --dir ./my-app
```

**Creates:**
```
src/
├── domain/employee-management/
│   ├── EmployeeManagement.js
│   ├── IEmployeeManagementRepository.js
│   └── EmployeeManagement.test.js
├── application/employee-management/
│   ├── use-cases/GetEmployeeManagementUseCase.js
│   └── dtos/EmployeeManagementDTO.js
├── infrastructure/employee-management/
│   └── EmployeeManagementRepository.js
└── ui/employee-management/
    ├── pages/EmployeeManagementPage.jsx
    └── components/
        ├── EmployeeManagementList.jsx
        └── EmployeeManagementForm.jsx
```

---

#### `review-pr` — Automated PR review

```bash
mcp review-pr 42
mcp review-pr 42 --branch feature/123-add-employee
```

**Checks:**
- ✅ File naming conventions (PascalCase for components)
- ✅ No `console.log()` calls
- ✅ Test files present for changed source files
- ✅ Architecture layer separation
- ✅ No hardcoded credentials
- ✅ PR size (warns if >500 lines)

Posts review comment directly to GitHub PR via the GitHub REST API.

---

#### `generate-design` — Generate Figma wireframe

```bash
mcp generate-design 123
```

**What it does:**
- Fetches ADO task #123
- Generates a detailed wireframe specification
- Posts spec as annotation in your Figma file
- Adds Figma link back to ADO task as a comment

---

#### `list-tasks` — List ADO tasks

```bash
mcp list-tasks
mcp list-tasks --state "In Progress"
mcp list-tasks --type "Bug" --limit 10
mcp list-tasks --sprint "MyProject\\Sprint 3"
```

---

#### `merge-pr` — Merge PR and close ticket

```bash
mcp merge-pr 42
mcp merge-pr 42 --strategy --squash
mcp merge-pr 42 --task-id 123
```

**What it does:**
- Validates PR is open and not conflicted
- Merges using specified strategy (default: squash)
- Deletes feature branch
- Marks ADO task as "Done"
- Adds merge comment to ADO task

---

## MCP Tools Reference

When using mcp Code, these tools are available:

| Tool | Description |
|------|-------------|
| `ado_get_work_item` | Fetch ADO task details |
| `ado_list_work_items` | List/filter ADO tasks |
| `ado_update_work_item_state` | Update task state |
| `ado_add_comment` | Add ADO comment |
| `figma_get_file` | Check Figma connection |
| `figma_generate_wireframe` | Generate wireframe for task |
| `figma_add_ado_link` | Link Figma to ADO task |
| `branch_generate_name` | Generate branch name |
| `conflict_preflight_check` | Check for conflicts |
| `agent_analyze_task` | PO Agent: task analysis |
| `agent_generate_architecture` | Architect: scaffold features |
| `agent_start_development` | Dev: create branch |
| `agent_create_pr` | Dev: create GitHub PR |
| `agent_review_pr` | Reviewer: code review |
| `agent_merge_pr` | DevOps: merge + close |
| `agent_full_workflow` | **Run entire pipeline** |

---

## Branch Naming Convention

All branches follow:
```
feature/{task-id}-{kebab-case-task-name}
```

Examples:
| ADO Task | Branch |
|----------|--------|
| `#123 Add employee form` | `feature/123-add-employee-form` |
| `#456 Fix login redirect` | `feature/456-fix-login-redirect` |
| `#789 API rate limiting` | `feature/789-api-rate-limiting` |

---

## PR Template

Every PR is auto-generated with:

```
[123] Add employee management form
```

Body includes:
- Summary
- Azure DevOps task link
- Figma design link
- Changes made
- Screenshots section
- Test case checklist
- Coding standard checklist

---

## Clean Architecture

Generated code follows Clean Architecture:

```
Domain (pure business logic, no dependencies)
    ↑
Application (use cases, orchestration)
    ↑
Infrastructure (DB, API adapters)

UI (React) → Application → Domain
```

**Rules enforced:**
- Domain has zero external dependencies
- UI cannot import from Infrastructure directly
- Use cases have one responsibility
- Repository interfaces defined in Domain, implemented in Infrastructure

---

## Multi-Agent Flow

```
User: "work on task 123"
          │
          ▼
┌─────────────────────┐
│  ProductOwnerAgent  │  → Analyze task, validate completeness
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   Figma Design      │  → Generate wireframe spec, add to ADO
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   ArchitectAgent    │  → Scaffold domain/application/infra/ui
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   DeveloperAgent    │  → Create branch, mark In Progress, create PR
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   ReviewerAgent     │  → Check standards, post review comments
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   DevOpsAgent       │  → Merge PR, delete branch, mark Done
└─────────────────────┘
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADO_ORG` | ✅ | Azure DevOps organization slug from `dev.azure.com/{ORG}` |
| `ADO_PROJECT` | ✅ | Azure DevOps project name |
| `ADO_PAT` | ✅ | ADO Personal Access Token (or `AZURE_DEVOPS_TOKEN`) |
| `AZURE_DEVOPS_TOKEN` | ✅ | Alternate name for `ADO_PAT` |
| `ADO_API_VERSION` | No | API version (default: 7.1) |
| `FIGMA_TOKEN` | No | Figma Personal Access Token |
| `FIGMA_FILE_KEY` | No | Figma file key from URL |
| `FIGMA_PROJECT_ID` | No | Figma project ID for creating new files |
| `GITHUB_TOKEN` | ✅ | GitHub token used for REST automation |
| `REPO_OWNER` | ✅ | Repository owner (org/user) |
| `REPO_NAME` | ✅ | Repository name |
| `BASE_BRANCH` | No | Base branch for PRs (default: main) |

---

## Development

```bash
# Start MCP server (stdio mode)
npm start

# Start with auto-reload
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

---

## Changelog

### v2.0.0
- ✨ Added Figma integration (wireframe generation, ADO linking)
- ✨ Added multi-agent architecture (5 agents)
- ✨ Added CLI with 6 commands
- ✨ Added clean architecture scaffold generator
- ✨ Added automated PR reviewer
- ✨ Added branch naming enforcement
- ✨ Added conflict prevention
- ✨ Added PR template builder
- ✨ Added GitHub PR template

### v1.0.0
- Initial release: ADO MCP tools (get, list, update, comment)
