import { adoClient } from "../ado-client.js";

function toWorkItemTypeRef(type) {
  const trimmed = String(type || "").trim();
  if (!trimmed) return "$Task";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

function addFieldPatch(patch, fieldName, value) {
  if (value === undefined || value === null) return;
  if (typeof value === "string" && value.trim() === "") return;
  patch.push({ op: "add", path: `/fields/${fieldName}`, value });
}

/**
 * Creates an Azure DevOps work item (ticket) using JSON Patch.
 *
 * @param {object} options
 * @param {string} options.title - Work item title (required)
 * @param {string} [options.type] - Work item type (Task, Bug, User Story, Feature, ...)
 * @param {string} [options.description] - HTML or plain text description
 * @param {string} [options.acceptanceCriteria] - HTML or plain text acceptance criteria
 * @param {string} [options.state] - Initial state (process dependent)
 * @param {string} [options.assignedTo] - Assignee display name/email (must match ADO identity)
 * @param {string} [options.sprint] - Iteration path (e.g. "Project\\Sprint 1")
 * @param {string} [options.tags] - Semicolon-separated tags string
 * @param {number} [options.priority] - Priority (process dependent)
 * @param {number} [options.storyPoints] - Story points (process dependent)
 * @returns {Promise<{id:number,title:string,type:string,state?:string,assignedTo?:string,iterationPath?:string,sprint?:string,url?:string}>}
 * @throws {Error} when title is missing or Azure DevOps rejects the request
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
    const response = await adoClient.post(`/wit/workitems/${toWorkItemTypeRef(type)}`, patch, {
      headers: { "Content-Type": "application/json-patch+json" },
    });

    const fields = response.data?.fields ?? {};
    return {
      id: response.data?.id,
      url: response.data?._links?.html?.href,
      type: fields["System.WorkItemType"] ?? String(type),
      title: fields["System.Title"] ?? trimmedTitle,
      state: fields["System.State"],
      assignedTo: fields["System.AssignedTo"]?.displayName ?? fields["System.AssignedTo"],
      iterationPath: fields["System.IterationPath"],
      sprint: fields["System.IterationPath"],
    };
  } catch (err) {
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error?.message ||
      err?.message ||
      "Failed to create work item";
    throw new Error(message);
  }
}

