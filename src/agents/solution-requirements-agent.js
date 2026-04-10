import fs from "fs/promises";
import path from "path";
import { figmaClient, validateFigmaConfig } from "../infrastructure/figma-client.js";

/**
 * Fixed structure + mandatory depth so Codex output is implementation-ready for a full-stack team.
 * Tables and schema are required where applicable so outputs are not only narrative bullets.
 */
const STANDARD_OUTPUT_FORMAT = `### Standard output format (Markdown). Use these **top-level sections**, in this order. Be exhaustive: a senior engineer should be able to start implementation without guesswork. Prefer **Markdown tables** wherever they clarify roles, fields, APIs, rules, or comparisons.

1. **Overview**
   - Feature name, purpose, in-scope / out-of-scope (short).
   - **Actors & permissions matrix** (table): Actor | Goal | Allowed actions | Forbidden actions | Data visibility.
   - Key user journeys in 1–2 lines each (Admin vs others).

2. **Business requirements**
   - Goals, KPIs or success criteria if inferable.
   - **Business rules** as numbered rules; where a rule is conditional, add a **decision-style table** (Condition | Outcome | Exception).
   - Org/process constraints, compliance, audit expectations if mentioned or strongly implied.

3. **Functional / logical (end-to-end behavior)**
   - Per major capability: user-visible behavior, validations, empty/loading/error states.
   - **Screen / flow inventory** (table): Screen or flow | Primary actor | Entry | Exit | Critical validations | Notes.
   - **State machines or step flows** (table or bullet steps): e.g. draft → published, Step 1 → Step 2, with allowed transitions and what resets on cancel/back.
   - **Authorization matrix** (table): Operation (CRUD, export, assign, etc.) | Admin | Normal User | Enforcement layer (UI only / API mandatory).
   - Edge cases, idempotency, concurrency (e.g. double submit), bulk actions, deletion cascades.

4. **Technical requirements — full stack**
   - **Architecture** (1 short paragraph): suggested layering (e.g. SPA + BFF + service + DB + object storage), and where business rules MUST be enforced (always server-side for authz and sensitive invariants).

   - **Database schema (mandatory)**  
     Provide concrete relational (or documented NoSQL) schema, not just a prose list of entities:
     - **Table / collection list** (table): Name | Purpose | Key relationships.
     - **Per table**: columns with **SQL-oriented types** (or BSON/JSON field types for document DB), **PK/FK**, **unique constraints**, **NOT NULL**, defaults, **check constraints** where useful.
     - **Indexes** for listing, search, and FK lookups; note partial indexes if filtering soft-deleted rows.
     - **Enums / lookup** tables or allowed values inline.
     - **Audit fields** (created_at, updated_at, created_by, etc.) and **soft delete** strategy if applicable.
     - **Referential integrity** on delete/update (RESTRICT, CASCADE, SET NULL) for policies, files, assignments.
     - Optional: **example DDL** snippet (CREATE TABLE …) for core tables if it reduces ambiguity.

   - **Domain model & business logic on the server**
     - Entities, aggregates, invariants (what must never happen in DB).
     - Services / use-cases: inputs, outputs, side effects (emails, files, audit logs).
     - **Cross-field rules** (table): Rule | Trigger | Validation error code/message.

   - **API contract**
     - **Endpoint summary** (table): Method | Path | Purpose | Authz | Idempotent? | Main query/body params | Success response | Error cases.
     - Request/response **JSON shapes** (field name, type, required, constraints) for non-trivial endpoints.
     - **Pagination, sorting, filtering** contract; standard error envelope and **HTTP status** usage (401/403/404/409/422).
     - File upload: max size, MIME whitelist, virus scan hook if relevant, storage key pattern.

   - **Frontend / client**
     - Route map or view list tied to roles; what is client-only vs server-validated.
     - State to persist (draft forms, query params), accessibility and responsive notes if designs imply.
     - Caching, optimistic UI only where safe; CSRF/session cookie vs bearer token model.

   - **Integrations & async** — Webhooks, jobs, email, third-party libs — only if required by spec or screenshots.

   - **Non-functional** — Security (authn/z, OWASP-relevant), performance (SLAs, N+1 avoidance), observability (logs, metrics, traces), backups for files + DB.

5. **Design alignment** — For each major screen/area: what **screenshots** show vs **requirement.md**; gaps, conflicts, recommended resolution.

6. **Traceability** — Table: Requirement ID or short name | Statement | Source (\`requirement.md\` heading and/or screenshot filename).

7. **Assumptions & open questions** — Numbered; call out spec/design conflicts explicitly.

**Density & style:** Use subheadings, bullet lists, and **many Markdown tables**. Avoid vague phrases like "handle appropriately" — specify behavior, limits, and failure modes. If the written spec is silent on a topic, state a **reasonable assumption** in section 7 rather than omitting the topic entirely.

**Examples (tone, not content):**
- Business rule table row: *Duplicate category name → block create → show validation on name field.*
- API row: *GET /documents* | list | Bearer + role | filters: categoryId, q, deptId | 200 + pagination object | 403 if role cannot see dept.*`;

function extractFigmaFileKey(figmaInput = "") {
  const text = String(figmaInput || "").trim();
  if (!text) return null;

  const urlMatch = text.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];

  if (/^[a-zA-Z0-9]{10,}$/.test(text)) return text;
  return null;
}

function collectNodeNames(nodes = [], out = []) {
  for (const node of nodes) {
    if (!node) continue;
    const name = String(node.name || "").trim();
    if (
      name &&
      name.length >= 3 &&
      name.length <= 80 &&
      /[a-zA-Z]/.test(name) &&
      !/^(frame|group|page|component)$/i.test(name)
    ) {
      out.push(name);
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      collectNodeNames(node.children, out);
    }
  }
  return out;
}

async function collectFigmaUiHints(figmaInput = "") {
  const fileKey = extractFigmaFileKey(figmaInput);
  if (!fileKey) return { fileKey: null, hints: [], error: null };

  try {
    validateFigmaConfig();
    const response = await figmaClient.get(`/files/${fileKey}`, {
      params: { depth: 4 },
    });

    const pageNames = (response.data.document?.children ?? [])
      .map((p) => p?.name)
      .filter(Boolean)
      .slice(0, 20);
    const nodeNames = collectNodeNames(response.data.document?.children ?? [])
      .slice(0, 100);

    return {
      fileKey,
      hints: [...pageNames, ...nodeNames],
      error: null,
    };
  } catch (error) {
    return {
      fileKey,
      hints: [],
      error: error.message,
    };
  }
}

async function readTextFile(absPath) {
  try {
    const text = await fs.readFile(absPath, "utf8");
    return text.trim();
  } catch {
    return "";
  }
}

function toPosixPath(p) {
  return String(p).split(path.sep).join("/");
}

async function listImageFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function buildFigmaApiLines(figmaInsight) {
  const lines = [];
  if (figmaInsight?.fileKey) {
    lines.push(
      `Optional Figma file key from link: ${figmaInsight.fileKey} — use if you open the file in Figma; screenshots remain the primary UI reference.`
    );
  }
  if (figmaInsight?.hints?.length) {
    lines.push(`Layer/page name hints: ${figmaInsight.hints.slice(0, 20).join(", ")}`);
  }
  if (figmaInsight?.error) {
    lines.push(`Figma API unavailable (${figmaInsight.error}). Rely on screenshot folder + requirement.md.`);
  }
  return lines;
}

function buildCodexSolutionPrompt({
  featureName,
  figmaInput,
  requirementBody,
  requirementDocDisplayPath,
  figmaImagesDirDisplayPath,
  imageFiles,
  figmaInsight,
}) {
  const figmaLink = (figmaInput || "").trim();
  const figmaApiLines = buildFigmaApiLines(figmaInsight);

  const imageNote =
    imageFiles.length > 0
      ? `Screenshots found (${imageFiles.length}): ${imageFiles.join(", ")}`
      : "No image files found in this folder yet — add PNG/JPEG/WebP/GIF exports from Figma.";

  const lines = [
    `Feature: ${featureName}`,
    "",
    "You have two inputs to combine:",
    `1) **Written requirements** — file path: \`${requirementDocDisplayPath}\` (content below).`,
    `2) **Figma design exports** — study every image in folder: \`${figmaImagesDirDisplayPath}\`. ${imageNote}`,
    "",
    "Produce **feature-based Markdown files** in one folder (not a single combined file).",
    "",
    "Output packaging (mandatory):",
    "- Create folder: `./solution-requirements/` (relative to the current working directory where Codex is running).",
    "- Create one file per major feature/module discovered from the requirements + screenshots.",
    "- File naming: kebab-case, e.g. `auth-login.md`, `category-management.md`, `policy-listing.md`, `policy-create-flow.md`, `access-control.md`.",
    "- Also create `./solution-requirements/index.md` with a table of contents: Feature | File | Scope summary.",
    "- Avoid duplication: if a rule is shared across features, keep canonical detail in one file and link to it from others.",
    "- Every feature file must still follow the standard section format below.",
    "",
    "Write behavior (mandatory to avoid shell/OS output limits):",
    "- Generate and write files **incrementally**: complete one feature file, write it to disk immediately, then continue to the next file.",
    "- Do **not** build all file contents in memory and write everything at the end.",
    "- Update `./solution-requirements/index.md` after each new feature file is written.",
    "- If generation is interrupted, already-written files must remain usable.",
    "",
    "Content goals for each feature file:",
    "- **Full-stack technical depth**: backend (API + domain rules + persistence), database **schema with tables/columns/constraints/indexes**, file/storage behavior, and frontend (routes, role-gated UI, validation split client/server).",
    "- **Business logic**: every authorization rule, visibility rule, validation, and lifecycle transition spelled out; use **tables** for matrices (actors × actions, screens × rules, API summary, cross-field rules).",
    "- **Tabular layout**: use Markdown tables anywhere they improve clarity (not only in Traceability). Narrative bullets alone are insufficient for sections 3–4.",
    "- Merge **written spec + screenshots**; where they conflict, document both and add an explicit resolution or open question in Assumptions.",
    "- Include database impact for that feature (tables touched, columns, constraints, indexes). If a shared schema spans features, split ownership clearly and cross-link.",
    "- Include API endpoints per feature and identify dependencies on other feature files.",
    "",
    STANDARD_OUTPUT_FORMAT,
    "",
    "---",
    "",
    "### Optional Figma link (extra context)",
    figmaLink || "(Not provided.)",
  ];
  for (const line of figmaApiLines) {
    if (line) lines.push(line);
  }
  lines.push(
    "",
    "---",
    "",
    "### Written requirements (`requirement.md` and any pasted additions)",
    requirementBody
  );
  return lines.join("\n");
}

async function mergeRequirementText(absDocPath, businessRequirements) {
  const fromFile = await readTextFile(absDocPath);
  const extra = String(businessRequirements || "").trim();
  if (fromFile && extra) {
    return `${fromFile}\n\n---\n\n### Additional notes (from tool)\n\n${extra}`;
  }
  if (fromFile) return fromFile;
  if (extra) return extra;
  return "";
}

export class SolutionRequirementsAgent {
  constructor() {
    this.name = "SolutionRequirementsAgent";
    this.role = "Senior Solution Architect + Product Analyst";
  }

  /**
   * Builds a Codex prompt from ./requirement.md + ./figma screenshots + optional Figma link.
   */
  async generateDocs({
    featureName,
    figmaInput,
    businessRequirements,
    outputDir = process.cwd(),
    requirementDocPath = "requirement.md",
    figmaImagesDir = "figma",
  }) {
    const safeFeature = featureName?.trim() || "feature";
    const base = path.resolve(outputDir);
    const requirementAbs = path.join(base, requirementDocPath);
    const figmaImagesAbs = path.join(base, figmaImagesDir);

    const requirementBody = await mergeRequirementText(requirementAbs, businessRequirements);
    const resolvedBody =
      requirementBody.trim() ||
      "(No requirement text yet: add content to requirement.md and/or pass businessRequirements.)";

    const imageFiles = await listImageFiles(figmaImagesAbs);
    const figmaInsight = await collectFigmaUiHints(figmaInput);

    const codexPrompt = buildCodexSolutionPrompt({
      featureName: safeFeature,
      figmaInput,
      requirementBody: resolvedBody,
      requirementDocDisplayPath: toPosixPath(path.relative(base, requirementAbs) || requirementDocPath),
      figmaImagesDirDisplayPath: toPosixPath(path.relative(base, figmaImagesAbs) || figmaImagesDir),
      imageFiles,
      figmaInsight,
    });

    return {
      agent: this.name,
      role: this.role,
      featureName: safeFeature,
      codexPrompt,
      sources: {
        requirementFile: requirementAbs,
        figmaImagesDir: figmaImagesAbs,
        imageFileCount: imageFiles.length,
        imageFiles,
      },
      figmaAnalysis: {
        fileKey: figmaInsight.fileKey,
        analyzedNodes: figmaInsight.hints.length,
        warning: figmaInsight.error || null,
      },
      note:
        "Paste codexPrompt into Codex. It uses requirement.md + Figma screenshot folder. Expected output: feature-based docs inside ./solution-requirements/ (with index.md) at Codex current working directory, written incrementally file-by-file (not all at once), plus full-stack technical requirements per feature including Markdown tables, DB schema impact, API contracts, and explicit business/authorization logic.",
    };
  }
}

export default new SolutionRequirementsAgent();
