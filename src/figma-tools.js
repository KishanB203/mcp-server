import { figmaClient, figmaConfig } from "./figma-client.js";
import { adoClient } from "./ado-client.js";

/**
 * Get an existing Figma file's metadata
 */
export async function getFigmaFile(fileKey = figmaConfig.FIGMA_FILE_KEY) {
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
 * Create a new Figma file for a project/task via the Figma API
 * Note: Figma's REST API supports creating files in a project (team drafts).
 * Requires a team project ID.
 */
export async function createFigmaFile(name, projectId) {
  if (!projectId) {
    // Fall back to returning a draft URL if no project ID provided
    return {
      name,
      url: `https://www.figma.com/file/${figmaConfig.FIGMA_FILE_KEY}`,
      note: "Using existing file key — set FIGMA_PROJECT_ID in .env to create new files automatically.",
    };
  }

  const response = await figmaClient.post(`/projects/${projectId}/files`, {
    name,
  });

  return {
    key: response.data.key,
    name: response.data.name,
    url: `https://www.figma.com/file/${response.data.key}`,
  };
}

/**
 * Add a comment to a Figma file (acts as wireframe annotation)
 */
export async function addFigmaComment(fileKey, message, x = 0, y = 0) {
  const response = await figmaClient.post(`/files/${fileKey}/comments`, {
    message,
    client_meta: {
      x,
      y,
      node_offset: { x: 0, y: 0 },
    },
  });

  return {
    id: response.data.id,
    message: response.data.message,
    createdAt: response.data.created_at,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
  };
}

/**
 * List comments on a Figma file (read wireframe annotations)
 */
export async function listFigmaComments(fileKey = figmaConfig.FIGMA_FILE_KEY) {
  const response = await figmaClient.get(`/files/${fileKey}/comments`);
  return response.data.comments?.map((c) => ({
    id: c.id,
    message: c.message,
    author: c.user?.handle,
    createdAt: c.created_at,
  }));
}

/**
 * Generate a wireframe specification from a task description.
 * Creates structured Figma annotations describing the UI design.
 */
export async function generateWireframeSpec(task) {
  const fileKey = figmaConfig.FIGMA_FILE_KEY;

  const wireframeSpec = buildWireframeSpec(task);

  // Post the wireframe spec as a comment/annotation on the Figma file
  const comment = await addFigmaComment(
    fileKey,
    wireframeSpec,
    100,
    100
  );

  return {
    fileKey,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
    wireframeSpec,
    commentId: comment.id,
    message: `Wireframe specification added to Figma file for task #${task.id}: ${task.title}`,
  };
}

/**
 * Build a structured wireframe specification string from a task
 */
function buildWireframeSpec(task) {
  const kebab = slugify(task.title);
  return `
=== WIREFRAME SPEC — Task #${task.id}: ${task.title} ===
Generated: ${new Date().toISOString()}

SCREEN: ${task.title}
Route: /${kebab}

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
   Based on task: ${task.description?.substring(0, 200) || "No description"}
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
   - Mobile:  < 768px  → single column, stacked layout
   - Tablet:  768–1024px → 2 columns
   - Desktop: > 1024px → 3 columns

ACCEPTANCE CRITERIA:
${task.acceptanceCriteria?.substring(0, 300) || "See Azure DevOps task"}

DESIGN TOKENS:
   - Primary:   #0078D4  (Azure blue)
   - Secondary: #605E5C
   - Success:   #107C10
   - Error:     #A4262C
   - Surface:   #FFFFFF
   - Background:#F3F2F1
   - Font:      Segoe UI, 14px base
=== END WIREFRAME SPEC ===
`.trim();
}

/**
 * Add a Figma link as a comment on an Azure DevOps work item
 */
export async function addFigmaLinkToAdo(adoTaskId, figmaUrl, figmaFileName) {
  const comment = `🎨 **Figma Design created**

**File:** ${figmaFileName || "UI Design"}
**Link:** ${figmaUrl}

The wireframe specification has been added to the Figma file. 
Please review the design before implementation begins.`;

  const response = await adoClient.post(
    `/wit/workitems/${adoTaskId}/comments`,
    { text: comment }
  );

  // Also update the task with a hyperlink field if available
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
  } catch (_) {
    // Non-fatal — description update may fail due to field permissions
  }

  return {
    adoTaskId,
    figmaUrl,
    commentId: response.data.id,
    message: `Figma link added to ADO task #${adoTaskId}`,
  };
}

/**
 * Full Figma design workflow: task → wireframe → ADO update
 */
export async function runFigmaDesignWorkflow(task) {
  const results = {};

  // Step 1: Get existing Figma file info
  try {
    results.figmaFile = await getFigmaFile();
  } catch (err) {
    results.figmaFile = {
      url: `https://www.figma.com/file/${figmaConfig.FIGMA_FILE_KEY}`,
      note: `Could not fetch Figma file: ${err.message}`,
    };
  }

  // Step 2: Generate wireframe spec as annotation
  try {
    results.wireframe = await generateWireframeSpec(task);
  } catch (err) {
    results.wireframe = { error: err.message };
  }

  // Step 3: Add Figma link back to ADO
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

// ─── Helpers ──────────────────────────────────────────────────
function slugify(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}
