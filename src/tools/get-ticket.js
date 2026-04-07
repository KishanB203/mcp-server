import { adoClient } from "../ado-client.js";

/**
 * Fetches a single work item (Task, PBI, User Story, Bug) by ID
 * Returns a clean, Claude-friendly summary of all key fields
 */
export async function getWorkItem(id) {
  // Fetch the work item with all fields expanded
  const response = await adoClient.get(`/wit/workitems/${id}`, {
    params: {
      "$expand": "all",
    },
  });

  const item = response.data;
  const fields = item.fields;

  // Fetch comments separately
  let comments = [];
  try {
    const commentsRes = await adoClient.get(`/wit/workitems/${id}/comments`);
    comments = commentsRes.data.comments?.map((c) => ({
      author: c.createdBy?.displayName,
      date: c.createdDate,
      text: c.text,
    })) ?? [];
  } catch (_) {
    // Comments endpoint may not be available in all ADO plans
  }

  // Fetch linked PRs / relations
  const relations = (item.relations ?? []).map((rel) => ({
    type: rel.rel,
    url: rel.url,
    title: rel.attributes?.name ?? "",
  }));

  return {
    id: item.id,
    url: item._links?.html?.href ?? `https://dev.azure.com/${process.env.ADO_ORG}/${process.env.ADO_PROJECT}/_workitems/edit/${item.id}`,
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

/**
 * Strips HTML tags from ADO rich-text fields
 */
function stripHtml(html) {
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
