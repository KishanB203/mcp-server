import fs from "fs";
import path from "path";

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toTitle(slug = "") {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function extractItems(text = "") {
  return String(text)
    .split(/\r?\n|,|;/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferUiModules(rawText = "") {
  const lines = extractItems(rawText);
  const modules = [];
  const seen = new Set();

  for (const line of lines) {
    const normalized = line.toLowerCase();
    const directMatches = [
      "navbar",
      "sidebar",
      "content area",
      "content",
      "profile dropdown",
      "dropdown",
      "header",
      "footer",
      "search bar",
      "filter panel",
      "list",
      "table",
      "form",
      "modal",
      "tabs",
      "card",
      "pagination",
      "breadcrumb",
    ];

    for (const candidate of directMatches) {
      if (normalized.includes(candidate)) {
        const moduleSlug = slugify(candidate.replace(/\s+/g, " "));
        if (!seen.has(moduleSlug)) {
          seen.add(moduleSlug);
          modules.push({
            slug: moduleSlug,
            title: toTitle(moduleSlug),
            sourceText: line,
          });
        }
      }
    }
  }

  if (modules.length === 0) {
    return [
      { slug: "header", title: "Header", sourceText: "Inferred from screen-level layout" },
      { slug: "main-content", title: "Main Content", sourceText: "Inferred from core task intent" },
      { slug: "primary-actions", title: "Primary Actions", sourceText: "Inferred from expected user actions" },
    ];
  }

  return modules;
}

function buildRequirementConversion(requirements = "") {
  const lines = extractItems(requirements);
  if (lines.length === 0) {
    return "- No structured requirements provided; inferred from design and common full-stack patterns.";
  }

  const bullets = [];
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (normalized.includes("navbar")) {
      bullets.push("- Navbar is required and should contain clearly labeled navigation items.");
      continue;
    }
    if (normalized.includes("profile")) {
      bullets.push("- Profile entry should open a dropdown menu with user-level options.");
      continue;
    }
    if (normalized.includes("tab")) {
      bullets.push("- Tabs should switch visible content instantly and highlight active tab.");
      continue;
    }
    if (normalized.includes("api") || normalized.includes("endpoint")) {
      bullets.push(`- ${line.charAt(0).toUpperCase()}${line.slice(1)} (backend exposure must be specified in backend/api-surface.md).`);
      continue;
    }
    bullets.push(`- ${line.charAt(0).toUpperCase()}${line.slice(1)}`);
  }

  return bullets.join("\n");
}

function buildSolutionContextMd({ featureName, figmaInput, requirements, uiModules }) {
  const featureLabel = featureName || "Feature";
  const moduleList = uiModules.map((m) => `- ${m.title}`).join("\n");
  const assumptions = [
    "UI copy and labels follow product language from the design or stakeholder input.",
    "When timing is unspecified, UI reflects successful operations after the server acknowledges the action (optimistic UI only if explicitly required).",
    "When requirements are ambiguous, choose predictable, secure, and accessible defaults.",
    "Backend contracts (APIs, persistence) are defined at the requirements level; implementation technology stack is project-specific.",
  ];

  return `# ${featureLabel} — Full-stack requirements context

## Feature / product overview
- This documentation set covers **frontend UX** and **backend capabilities** for **${featureLabel}**.
- Design input: ${figmaInput ? `"${figmaInput}"` : "No Figma link provided; use written screen description and requirements."}.

## Business purpose
- Deliver end-to-end value: users interact via the UI; the system enforces rules and persists state via backend services and data stores.

## User goals (experience)
- Complete primary tasks with minimal friction.
- See accurate data and clear feedback (success, validation, system errors).
- Trust that sensitive actions are authorized and auditable where applicable.

## UI structure summary (high-level)
${moduleList}

## Backend scope summary (high-level)
- **API surface:** Operations the client needs to read/write domain data — see \`backend/api-surface.md\`.
- **Data:** Entities, relationships, and persistence expectations — see \`backend/data-model.md\`.
- **Services & integrations:** Server-side rules and external systems — see \`backend/services-and-integrations.md\`.
- **Security & auth:** Authentication, authorization, and cross-cutting policies — see \`backend/security-and-auth.md\`.

## Assumptions
${assumptions.map((a) => `- ${a}`).join("\n")}

## Cross-cutting quality
- **Consistency:** Same business rules enforced in API and reflected in UI validation where both exist.
- **Idempotency / safety:** Mutations that repeat (retries, double-submit) should be safe or explicitly documented.
- **Observability:** Log-worthy events and error surfaces for operators (requirements-level; no vendor lock-in).

## Experience-level states (full stack)
- **Loading:** UI shows progress; backend may be processing; avoid duplicate submits.
- **Empty:** UI empty state; backend may return empty collections — not an error.
- **Error:** UI shows actionable message; backend returns structured error contract (see api-surface).
- **Conflict:** Concurrent edits or stale data — resolution flow documented in API and UI behavior.

## Standardized requirement conversion (raw → structured)
${buildRequirementConversion(requirements)}

## Documentation layout
- \`context.md\` (this file) — umbrella context
- \`frontend/*.md\` — per-UI-module specs
- \`backend/*.md\` — API, data, services, security
`;
}

function frontendModuleTemplate({ module }) {
  return `# ${module.title} (frontend)

## 1. Business purpose
- Supports a distinct part of the user journey and keeps the screen composable.

## 2. UI description (from Figma / design)
- **Layout:** Match design for ${module.title}.
- **Elements:** All visible controls (buttons, tabs, icons, text, inputs) in this region.
- **Visual hierarchy:** Primary actions are visually stronger than secondary.

## 3. Functional behavior
- **Primary action:** Triggers the main flow (may invoke client → API per feature contract).
- **Selection:** Updates active item and dependent UI; highlights selection.
- **Input:** Local state on change; validation before submit; block invalid submits.

## 4. User interactions
- Click, hover, focus, keyboard (Tab order, Enter/Space on controls).

## 5. State handling
- **Default, active, disabled, loading, empty, error** — including mapping from API outcomes where applicable (no implementation code here).

## 6. Validation (UI + contract alignment)
- Required fields, lengths, formats; messages must align with API validation errors where both exist.

## 7. Component structure
- Container + presentational pieces; props/callbacks; optional loading/error props from parent or data layer.

## 8. Styling notes
- Spacing, alignment, breakpoints (mobile / tablet / desktop), interactive states.
`;
}

function backendApiSurfaceTemplate(featureLabel) {
  return `# API surface — ${featureLabel}

## 1. Purpose
- Define **what** the client calls, not **how** it is coded (framework-agnostic requirements).

## 2. Resource / operation list
- List each capability as a named operation (e.g. list, get by id, create, update, delete, custom actions).
- For each: **HTTP method + path pattern** (or message/event name if async), **auth requirement**, **idempotency** expectation.

## 3. Request / response (requirements level)
- Required fields, optional fields, enumerations, pagination/filter/sort parameters.
- Success body shape (fields and meaning); list vs single resource rules.

## 4. Error contract
- Validation errors (field-level if applicable), not found, conflict, authorization failure, rate limit.
- **Do not** invent specific HTTP codes beyond generic guidance unless product mandates — document expected categories.

## 5. Versioning and compatibility
- Breaking vs additive changes; deprecation expectations.

## 6. Relation to UI
- Map each major UI action to the operation(s) it depends on (table in implementation phase).
`;
}

function backendDataModelTemplate(featureLabel) {
  return `# Data model — ${featureLabel}

## 1. Domain entities
- Name each entity, its business meaning, and identifier strategy.

## 2. Attributes
- Per entity: fields, types at conceptual level, required/optional, uniqueness, defaults.

## 3. Relationships
- One-to-many, many-to-many, ownership, cascade/delete rules at requirement level.

## 4. Persistence expectations
- What must be durable vs derived; retention if mentioned in requirements.

## 5. Constraints & invariants
- Business rules that must hold in storage (e.g. status transitions, totals).

## 6. Migration / seed (if applicable)
- Initial reference data or feature flags mentioned by stakeholders.
`;
}

function backendServicesTemplate(featureLabel) {
  return `# Services & integrations — ${featureLabel}

## 1. Application / domain services
- Orchestration steps that are not a single CRUD call (e.g. “submit order”, “approve request”).

## 2. Business rules on the server
- Rules that must not be bypassed by clients; duplicates of UI validation where both apply.

## 3. External integrations
- Third-party systems, webhooks, email/SMS/payment providers — inputs, outputs, failure handling at spec level.

## 4. Background / async work (if any)
- Jobs, queues, scheduled tasks — triggers and expected user-visible effects.

## 5. Caching & performance (requirements)
- What may be cached, TTL expectations, staleness acceptable to users.
`;
}

function backendSecurityTemplate(featureLabel) {
  return `# Security & auth — ${featureLabel}

## 1. Authentication
- How users prove identity for this feature (session, token, SSO) — requirement-level only.

## 2. Authorization
- Roles or permissions needed per operation; row-level or resource-level rules if applicable.

## 3. Data protection
- PII/sensitive fields; masking in UI; encryption at rest/in transit expectations if stated.

## 4. Threat considerations
- CSRF (for cookie sessions), injection, mass assignment, IDOR — mitigation expectations at spec level.

## 5. Audit & compliance
- Who did what, when — if required by business or regulation.
`;
}

export class SolutionRequirementsAgent {
  constructor() {
    this.name = "SolutionRequirementsAgent";
    this.role = "Senior Solution Architect + Product Analyst";
  }

  /**
   * Generates implementation-ready requirement docs: frontend modules + backend capability specs.
   */
  generateDocs({
    featureName,
    figmaInput,
    businessRequirements,
    outputDir = process.cwd(),
  }) {
    const safeFeature = featureName?.trim() || "feature";
    const featureSlug = slugify(safeFeature) || "feature";
    const docsRoot = path.join(outputDir, "docs", featureSlug);
    const frontendDir = path.join(docsRoot, "frontend");
    const backendDir = path.join(docsRoot, "backend");
    ensureDir(frontendDir);
    ensureDir(backendDir);

    const uiModules = inferUiModules(`${figmaInput || ""}\n${businessRequirements || ""}`);

    const contextPath = path.join(docsRoot, "context.md");
    fs.writeFileSync(
      contextPath,
      buildSolutionContextMd({
        featureName: safeFeature,
        figmaInput,
        requirements: businessRequirements,
        uiModules,
      }),
      "utf8"
    );

    const createdFiles = [{ role: "context", name: "context.md", path: contextPath }];

    for (const module of uiModules) {
      const filePath = path.join(frontendDir, `${module.slug}.md`);
      fs.writeFileSync(filePath, frontendModuleTemplate({ module }), "utf8");
      createdFiles.push({ role: "frontend", name: module.title, path: filePath });
    }

    const backendSpecs = [
      { file: "api-surface.md", content: backendApiSurfaceTemplate(safeFeature) },
      { file: "data-model.md", content: backendDataModelTemplate(safeFeature) },
      { file: "services-and-integrations.md", content: backendServicesTemplate(safeFeature) },
      { file: "security-and-auth.md", content: backendSecurityTemplate(safeFeature) },
    ];

    for (const spec of backendSpecs) {
      const filePath = path.join(backendDir, spec.file);
      fs.writeFileSync(filePath, spec.content, "utf8");
      createdFiles.push({ role: "backend", name: spec.file, path: filePath });
    }

    return {
      agent: this.name,
      role: this.role,
      featureName: safeFeature,
      outputDir: docsRoot,
      contextFile: contextPath,
      frontendDir,
      backendDir,
      files: createdFiles,
      note:
        "Solution requirement documentation generated: frontend modular MD + backend API/data/services/security templates. Fill in domain specifics from client input.",
    };
  }
}

export default new SolutionRequirementsAgent();
