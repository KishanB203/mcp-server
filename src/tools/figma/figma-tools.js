/**
 * @module tools/figma/figma-tools
 *
 * High-level Figma operations used by the MCP tool handlers and agents:
 *   - Fetch file metadata
 *   - Create files (in a team project)
 *   - Add / list comments (used as wireframe annotations)
 *   - Generate a structured wireframe specification from an ADO task
 *   - Link Figma files back to ADO tasks
 *   - Run the full Figma design workflow (generate + annotate + link to ADO)
 */

import { figmaClient, figmaConfig } from "../../infrastructure/figma-client.js";
import { adoClient } from "../../infrastructure/ado-client.js";

// ─────────────────────────────────────────────────────────────────────────────
// File operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches metadata for a Figma file.
 *
 * @param {string} [fileKey]  Figma file key (defaults to `FIGMA_FILE_KEY` env var)
 * @returns {Promise<FigmaFileMeta>}
 *
 * @typedef {object} FigmaFileMeta
 * @property {string}   key
 * @property {string}   name
 * @property {string}   lastModified
 * @property {string}   thumbnailUrl
 * @property {string}   url
 * @property {Array<{id:string,name:string}>} pages
 */
export async function getFigmaFile(fileKey = figmaConfig.fileKey) {
  const response = await figmaClient.get(`/files/${fileKey}`);
  return {
    key: fileKey,
    name: response.data.name,
    lastModified: response.data.lastModified,
    thumbnailUrl: response.data.thumbnailUrl,
    url: `https://www.figma.com/file/${fileKey}`,
    pages: response.data.document?.children?.map((p) => ({
      id: p.id,
      name: p.name,
    })),
  };
}

/**
 * Creates a new Figma file inside a team project.
 * Falls back to the existing configured file if no `projectId` is provided.
 *
 * @param {string} name        Display name for the new file
 * @param {string} [projectId] Figma project ID (from `FIGMA_PROJECT_ID` env var)
 * @returns {Promise<{key?:string, name:string, url:string, note?:string}>}
 */
export async function createFigmaFile(name, projectId) {
  if (!projectId) {
    return {
      name,
      url: `https://www.figma.com/file/${figmaConfig.fileKey}`,
      note:
        "Using existing file key — set FIGMA_PROJECT_ID in .env to create new files automatically.",
    };
  }

  const response = await figmaClient.post(`/projects/${projectId}/files`, { name });
  return {
    key: response.data.key,
    name: response.data.name,
    url: `https://www.figma.com/file/${response.data.key}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment / annotation operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a comment (used as a wireframe annotation) to a Figma file.
 *
 * @param {string} fileKey
 * @param {string} message  Comment text (plain text or structured spec)
 * @param {number} [x=0]    Canvas X position
 * @param {number} [y=0]    Canvas Y position
 * @returns {Promise<{id:string, message:string, createdAt:string, fileUrl:string}>}
 */
export async function addFigmaComment(fileKey, message, x = 0, y = 0) {
  const response = await figmaClient.post(`/files/${fileKey}/comments`, {
    message,
    client_meta: { x, y, node_offset: { x: 0, y: 0 } },
  });

  return {
    id: response.data.id,
    message: response.data.message,
    createdAt: response.data.created_at,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
  };
}

/**
 * Lists all comments on a Figma file.
 *
 * @param {string} [fileKey]
 * @returns {Promise<Array<{id:string,message:string,author:string,createdAt:string}>>}
 */
export async function listFigmaComments(fileKey = figmaConfig.fileKey) {
  const response = await figmaClient.get(`/files/${fileKey}/comments`);
  return (response.data.comments ?? []).map((c) => ({
    id: c.id,
    message: c.message,
    author: c.user?.handle,
    createdAt: c.created_at,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Wireframe generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a structured wireframe specification from an ADO task and
 * posts it as a Figma annotation.
 *
 * @param {import("../../tools/ado/get-work-item.js").WorkItem} task
 * @returns {Promise<{fileKey:string,fileUrl:string,wireframeSpec:string,commentId:string,message:string}>}
 */
export async function generateWireframeSpec(task) {
  const fileKey = figmaConfig.fileKey;
  const wireframeSpec = buildWireframeSpec(task);

  const comment = await addFigmaComment(fileKey, wireframeSpec, 100, 100);

  return {
    fileKey,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
    wireframeSpec,
    commentId: comment.id,
    message: `Wireframe specification added to Figma file for task #${task.id}: ${task.title}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADO ↔ Figma linking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Posts a Figma URL as a comment on an Azure DevOps work item and
 * optionally appends the URL to the item's Description field.
 *
 * @param {number|string} adoTaskId
 * @param {string}        figmaUrl
 * @param {string}        [figmaFileName]
 * @returns {Promise<{adoTaskId:number|string,figmaUrl:string,commentId:number,message:string}>}
 */
export async function addFigmaLinkToAdo(adoTaskId, figmaUrl, figmaFileName) {
  const commentText = `🎨 **Figma Design created**

**File:** ${figmaFileName ?? "UI Design"}
**Link:** ${figmaUrl}

The wireframe specification has been added to the Figma file.
Please review the design before implementation begins.`;

  const response = await adoClient.post(
    `/wit/workitems/${adoTaskId}/comments`,
    { text: commentText }
  );

  // Append the Figma URL to the Description field (non-fatal if it fails).
  try {
    await adoClient.patch(
      `/wit/workitems/${adoTaskId}`,
      [
        {
          op: "add",
          path: "/fields/System.Description",
          value: `<p><strong>🎨 Figma Design:</strong> <a href="${figmaUrl}">${figmaUrl}</a></p>`,
        },
      ],
      { headers: { "Content-Type": "application/json-patch+json" } }
    );
  } catch {
    // Description update may be refused due to field-level permissions.
  }

  return {
    adoTaskId,
    figmaUrl,
    commentId: response.data.id,
    message: `Figma link added to ADO task #${adoTaskId}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full workflow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the complete Figma design workflow for a task:
 *   1. Fetch the configured Figma file's metadata
 *   2. Generate + post a wireframe spec as a Figma annotation
 *   3. Link the Figma file back to the ADO task
 *
 * Each step is wrapped in its own try/catch so a partial failure
 * still returns whatever succeeded.
 *
 * @param {import("../../tools/ado/get-work-item.js").WorkItem} task
 * @returns {Promise<{figmaFile:object, wireframe:object, adoUpdate:object}>}
 */
export async function runFigmaDesignWorkflow(task) {
  const results = {};

  try {
    results.figmaFile = await getFigmaFile();
  } catch (err) {
    results.figmaFile = {
      url: `https://www.figma.com/file/${figmaConfig.fileKey}`,
      note: `Could not fetch Figma file: ${err.message}`,
    };
  }

  try {
    results.wireframe = await generateWireframeSpec(task);
  } catch (err) {
    results.wireframe = { error: err.message };
  }

  try {
    results.adoUpdate = await addFigmaLinkToAdo(
      task.id,
      results.figmaFile.url,
      `Task #${task.id} — ${task.title}`
    );
  } catch (err) {
    results.adoUpdate = { error: err.message };
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a plain-text wireframe specification from a task.
 * The spec is posted as a Figma annotation so designers can see the
 * requirements without leaving Figma.
 *
 * @param {import("../../tools/ado/get-work-item.js").WorkItem} task
 * @returns {string}
 */
const buildWireframeSpec = (task) => {
  const route = slugify(task.title);
  return `
=== WIREFRAME SPEC — Task #${task.id}: ${task.title} ===
Generated: ${new Date().toISOString()}

SCREEN: ${task.title}
Route: /${route}

COMPONENTS:
─────────────────────────────────────────
1. PAGE HEADER
   - Title: "${task.title}"
   - Breadcrumb: Home > ${task.title}
   - Actions: Primary CTA button (right-aligned)

2. MAIN CONTENT AREA
   - Layout: Single column, max-width 1200px
   - Padding: 24px all sides
   - Background: Surface (#FFFFFF)

3. DATA SECTION
   Based on task: ${task.description?.substring(0, 200) ?? "No description"}
   - Display items in card grid (3 columns desktop, 1 mobile)
   - Each card: title, description, status badge, action button

4. FORM ELEMENTS (if applicable)
   - Input fields with labels and validation states
   - Submit / Cancel buttons
   - Error / Success toast notifications

5. EMPTY STATE
   - Illustration placeholder
   - Message: "No items found"
   - CTA to create first item

6. LOADING STATE
   - Skeleton loaders for all cards
   - Spinner on submit buttons

RESPONSIVE BREAKPOINTS:
   - Mobile:  < 768px   → single column, stacked layout
   - Tablet:  768–1024px → 2 columns
   - Desktop: > 1024px  → 3 columns

ACCEPTANCE CRITERIA:
${task.acceptanceCriteria?.substring(0, 300) ?? "See Azure DevOps task"}

DESIGN TOKENS:
   - Primary:    #0078D4  (Azure blue)
   - Secondary:  #605E5C
   - Success:    #107C10
   - Error:      #A4262C
   - Surface:    #FFFFFF
   - Background: #F3F2F1
   - Font:       Segoe UI, 14px base
=== END WIREFRAME SPEC ===
`.trim();
}

/**
 * Converts a task title to a URL-safe kebab-case slug.
 *
 * @param {string} text
 * @returns {string}
 */
const slugify = (text = "") => {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}
