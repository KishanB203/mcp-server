import { adoClient } from "../ado-client.js";

/**
 * Lists work items from a sprint or by state/type using WIQL query
 * Supports filtering by: sprint, state, type, assignedTo
 */
export async function listWorkItems({ sprint, state, type, assignedTo, limit = 20 } = {}) {
  // Build WIQL (Work Item Query Language) query
  const conditions = [
    `[System.TeamProject] = @project`,
  ];

  if (type) {
    conditions.push(`[System.WorkItemType] = '${type}'`);
  } else {
    // Default: Tasks, PBIs, User Stories, Bugs
    conditions.push(
      `[System.WorkItemType] IN ('Task', 'Product Backlog Item', 'User Story', 'Bug', 'Feature')`
    );
  }

  if (state) {
    conditions.push(`[System.State] = '${state}'`);
  } else {
    // Exclude done/removed items by default
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
      SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], 
             [System.AssignedTo], [Microsoft.VSTS.Common.Priority]
      FROM WorkItems
      WHERE ${conditions.join(" AND ")}
      ORDER BY [System.ChangedDate] DESC
    `,
  };

  const queryResponse = await adoClient.post(`/wit/wiql`, wiql, {
    params: { "$top": limit },
  });

  const workItemRefs = queryResponse.data.workItems ?? [];
  if (workItemRefs.length === 0) return [];

  // Batch-fetch full details for the returned IDs
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
