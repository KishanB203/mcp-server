/**
 * @module tools/ado/get-work-item
 *
 * Fetches a single Azure DevOps work item by ID and returns a clean,
 * MCP-friendly object that includes all key fields, comments, and relations.
 */

import { adoClient } from "../../infrastructure/ado-client.js";

/**
 * Fetches a work item (Task, PBI, User Story, Bug, …) by its numeric ID.
 *
 * @param {number|string} id  Work item ID
 * @returns {Promise<WorkItem>}
 *
 * @typedef {object} WorkItem
 * @property {number}   id
 * @property {string}   url
 * @property {string}   type
 * @property {string}   title
 * @property {string}   state
 * @property {string}   assignedTo
 * @property {number|string} priority
 * @property {number|string} storyPoints
 * @property {string}   iterationPath
 * @property {string}   areaPath
 * @property {string}   tags
 * @property {string}   description    HTML stripped to plain text
 * @property {string}   acceptanceCriteria
 * @property {string|null} reproductionSteps
 * @property {Comment[]} comments
 * @property {Relation[]} relations
 * @property {string}   createdBy
 * @property {string}   createdDate
 * @property {string}   changedDate
 */
export async function getWorkItem(id) {
  const response = await adoClient.get(`/wit/workitems/${id}`, {
    params: { $expand: "all" },
  });

  const item = response.data;
  const fields = item.fields;

  // Comments live on a separate endpoint and may be unavailable on some plans.
  let comments = [];
  try {
    const commentsRes = await adoClient.get(`/wit/workitems/${id}/comments`);
    comments = (commentsRes.data.comments ?? []).map((c) => ({
      author: c.createdBy?.displayName,
      date: c.createdDate,
      text: c.text,
    }));
  } catch {
    // Non-fatal — comments endpoint not available on all ADO tiers.
  }

  const relations = (item.relations ?? []).map((rel) => ({
    type: rel.rel,
    url: rel.url,
    title: rel.attributes?.name ?? "",
  }));

  return {
    id: item.id,
    url:
      item._links?.html?.href ??
      `https://dev.azure.com/${process.env.ADO_ORG}/${process.env.ADO_PROJECT}/_workitems/edit/${item.id}`,
    type: fields["System.WorkItemType"],
    title: fields["System.Title"],
    state: fields["System.State"],
    assignedTo: fields["System.AssignedTo"]?.displayName ?? "Unassigned",
    priority: fields["Microsoft.VSTS.Common.Priority"] ?? "Not set",
    storyPoints: fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? "Not set",
    iterationPath: fields["System.IterationPath"],
    areaPath: fields["System.AreaPath"],
    tags: fields["System.Tags"] ?? "",
    description: fields["System.Description"]
      ? stripHtml(fields["System.Description"])
      : "No description provided.",
    acceptanceCriteria: fields["Microsoft.VSTS.Common.AcceptanceCriteria"]
      ? stripHtml(fields["Microsoft.VSTS.Common.AcceptanceCriteria"])
      : "No acceptance criteria provided.",
    reproductionSteps: fields["Microsoft.VSTS.TCM.ReproSteps"]
      ? stripHtml(fields["Microsoft.VSTS.TCM.ReproSteps"])
      : null,
    comments,
    relations,
    createdBy: fields["System.CreatedBy"]?.displayName,
    createdDate: fields["System.CreatedDate"],
    changedDate: fields["System.ChangedDate"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips HTML tags from ADO rich-text fields and normalises whitespace.
 * Converts `<br>`, `</p>`, and `<li>` into readable newlines/bullets.
 *
 * @param {string} html
 * @returns {string}
 */
const stripHtml = (html) => {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
