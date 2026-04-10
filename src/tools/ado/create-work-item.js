/**
 * @module tools/ado/create-work-item
 *
 * Creates a new Azure DevOps work item using the JSON Patch protocol
 * required by the ADO REST API.
 *
 * Supported work-item types depend on the project's process template
 * (Scrum, Agile, or CMMI).  Common values: Task, Bug, User Story, Feature.
 */

import { adoClient } from "../../infrastructure/ado-client.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a plain type string to the ADO "$Type" route-segment format.
 * ADO requires the work-item type to be prefixed with "$" in the URL.
 *
 * @param {string} type  e.g. "Task", "Bug"
 * @returns {string}     e.g. "$Task"
 */
const toWorkItemTypeRef = (type) => {
  const trimmed = String(type ?? "").trim();
  if (!trimmed) return "$Task";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

/**
 * Conditionally pushes a JSON Patch "add" operation onto `patch`.
 * Skips `undefined`, `null`, and empty-string values to avoid sending
 * no-op field updates.
 *
 * @param {Array}  patch      Mutable patch array
 * @param {string} fieldName  ADO field reference name (e.g. "System.Title")
 * @param {*}      value
 */
const addFieldPatch = (patch, fieldName, value) => {
  if (value === undefined || value === null) return;
  if (typeof value === "string" && value.trim() === "") return;
  patch.push({ op: "add", path: `/fields/${fieldName}`, value });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an Azure DevOps work item.
 *
 * @param {object}  options
 * @param {string}  options.title               Work item title (required)
 * @param {string}  [options.type="Task"]        Work item type
 * @param {string}  [options.description]        HTML or plain-text description
 * @param {string}  [options.acceptanceCriteria] HTML or plain-text acceptance criteria
 * @param {string}  [options.state]              Initial workflow state
 * @param {string}  [options.assignedTo]         Assignee display name or email
 * @param {string}  [options.sprint]             Iteration path (e.g. "Project\\Sprint 1")
 * @param {string}  [options.tags]               Semicolon-separated tags
 * @param {number}  [options.priority]           Priority (1 = highest)
 * @param {number}  [options.storyPoints]        Story points estimate
 * @returns {Promise<CreatedWorkItem>}
 * @throws {Error} if `title` is missing or ADO rejects the request
 *
 * @typedef {object} CreatedWorkItem
 * @property {number} id
 * @property {string} url
 * @property {string} type
 * @property {string} title
 * @property {string} [state]
 * @property {string} [assignedTo]
 * @property {string} [iterationPath]
 * @property {string} [sprint]
 */
export async function createWorkItem({
  title,
  type = "Task",
  description,
  acceptanceCriteria,
  state,
  assignedTo,
  sprint,
  tags,
  priority,
  storyPoints,
} = {}) {
  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  if (!trimmedTitle) throw new Error("title is required");

  const patch = [];
  addFieldPatch(patch, "System.Title", trimmedTitle);
  addFieldPatch(patch, "System.Description", description);
  addFieldPatch(patch, "Microsoft.VSTS.Common.AcceptanceCriteria", acceptanceCriteria);
  addFieldPatch(patch, "System.State", state);
  addFieldPatch(patch, "System.AssignedTo", assignedTo);
  addFieldPatch(patch, "System.IterationPath", sprint);
  addFieldPatch(patch, "System.Tags", tags);
  addFieldPatch(patch, "Microsoft.VSTS.Common.Priority", priority);
  addFieldPatch(patch, "Microsoft.VSTS.Scheduling.StoryPoints", storyPoints);

  try {
    const response = await adoClient.post(
      `/wit/workitems/${toWorkItemTypeRef(type)}`,
      patch,
      { headers: { "Content-Type": "application/json-patch+json" } }
    );

    const fields = response.data?.fields ?? {};
    return {
      id: response.data?.id,
      url: response.data?._links?.html?.href,
      type: fields["System.WorkItemType"] ?? String(type),
      title: fields["System.Title"] ?? trimmedTitle,
      state: fields["System.State"],
      assignedTo:
        fields["System.AssignedTo"]?.displayName ?? fields["System.AssignedTo"],
      iterationPath: fields["System.IterationPath"],
      sprint: fields["System.IterationPath"],
    };
  } catch (err) {
    const message =
      err?.response?.data?.message ??
      err?.response?.data?.error?.message ??
      err?.message ??
      "Failed to create work item";
    throw new Error(message);
  }
}
