/**
 * @module tools/ado/list-work-items
 *
 * Lists Azure DevOps work items using a WIQL query.
 * Supports optional filters for sprint, state, work-item type, and assignee.
 * Results are batch-fetched in a single ADO API call after the WIQL query.
 */

import { adoClient } from "../../infrastructure/ado/ado-client.js";

/**
 * Lists work items from the configured ADO project.
 *
 * @param {object} [filters]
 * @param {string} [filters.sprint]     Iteration path to restrict the query (e.g. "MyProject\\Sprint 1")
 * @param {string} [filters.state]      Work item state (e.g. "In Progress", "To Do")
 * @param {string} [filters.type]       Work item type (e.g. "Task", "Bug", "User Story")
 * @param {string} [filters.assignedTo] Assignee display name or email
 * @param {number} [filters.limit=20]   Maximum number of results returned
 * @returns {Promise<WorkItemSummary[]>}
 *
 * @typedef {object} WorkItemSummary
 * @property {number}       id
 * @property {string}       type
 * @property {string}       title
 * @property {string}       state
 * @property {string}       assignedTo
 * @property {number|string} priority
 * @property {number|string} storyPoints
 * @property {string}       iterationPath
 * @property {string}       tags
 */
export async function listWorkItems({
  sprint,
  state,
  type,
  assignedTo,
  limit = 20,
} = {}) {
  const conditions = [`[System.TeamProject] = @project`];

  if (type) {
    conditions.push(`[System.WorkItemType] = '${type}'`);
  } else {
    conditions.push(
      `[System.WorkItemType] IN ('Task', 'Product Backlog Item', 'User Story', 'Bug', 'Feature')`
    );
  }

  if (state) {
    conditions.push(`[System.State] = '${state}'`);
  } else {
    // Exclude terminal states by default so the list stays actionable.
    conditions.push(`[System.State] NOT IN ('Done', 'Removed', 'Closed')`);
  }

  if (assignedTo) {
    conditions.push(`[System.AssignedTo] = '${assignedTo}'`);
  }

  if (sprint) {
    conditions.push(`[System.IterationPath] UNDER '${sprint}'`);
  }

  const wiql = {
    query: `
      SELECT
        [System.Id], [System.Title], [System.WorkItemType],
        [System.State], [System.AssignedTo],
        [Microsoft.VSTS.Common.Priority]
      FROM WorkItems
      WHERE ${conditions.join(" AND ")}
      ORDER BY [System.ChangedDate] DESC
    `,
  };

  const queryResponse = await adoClient.post(`/wit/wiql`, wiql, {
    params: { $top: limit },
  });

  const workItemRefs = queryResponse.data.workItems ?? [];
  if (workItemRefs.length === 0) return [];

  // Batch-fetch full field values for all returned IDs in one request.
  const ids = workItemRefs.map((w) => w.id).join(",");
  const detailsResponse = await adoClient.get(`/wit/workitems`, {
    params: {
      ids,
      fields: [
        "System.Id",
        "System.Title",
        "System.WorkItemType",
        "System.State",
        "System.AssignedTo",
        "Microsoft.VSTS.Common.Priority",
        "Microsoft.VSTS.Scheduling.StoryPoints",
        "System.IterationPath",
        "System.Tags",
      ].join(","),
    },
  });

  return (detailsResponse.data.value ?? []).map((item) => ({
    id: item.id,
    type: item.fields["System.WorkItemType"],
    title: item.fields["System.Title"],
    state: item.fields["System.State"],
    assignedTo: item.fields["System.AssignedTo"]?.displayName ?? "Unassigned",
    priority: item.fields["Microsoft.VSTS.Common.Priority"] ?? "-",
    storyPoints: item.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? "-",
    iterationPath: item.fields["System.IterationPath"],
    tags: item.fields["System.Tags"] ?? "",
  }));
}
