import { adoClient } from "../ado-client.js";

/**
 * Updates the state of a work item (e.g., To Do → In Progress → Done)
 * Common states: "To Do", "In Progress", "Done", "Active", "Resolved", "Closed"
 */
export async function updateWorkItemState(id, newState) {
  const response = await adoClient.patch(
    `/wit/workitems/${id}`,
    [
      {
        op: "add",
        path: "/fields/System.State",
        value: newState,
      },
    ],
    {
      headers: {
        "Content-Type": "application/json-patch+json",
      },
    }
  );

  return {
    id: response.data.id,
    title: response.data.fields["System.Title"],
    newState: response.data.fields["System.State"],
    url: response.data._links?.html?.href,
  };
}

/**
 * Adds a comment to a work item
 */
export async function addWorkItemComment(id, comment) {
  const response = await adoClient.post(
    `/wit/workitems/${id}/comments`,
    { text: comment }
  );

  return {
    id: response.data.id,
    workItemId: id,
    text: response.data.text,
    createdBy: response.data.createdBy?.displayName,
    createdDate: response.data.createdDate,
  };
}
