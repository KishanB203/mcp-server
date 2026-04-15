/**
 * @module tools/ado/update-work-item
 *
 * Provides operations to mutate an existing Azure DevOps work item:
 *   - Update its workflow state (e.g. "To Do" → "In Progress" → "Done")
 *   - Append a comment visible in the Discussion section
 */

import { adoClient } from "../../infrastructure/ado-client.js";

/**
 * Updates the workflow state of a work item.
 *
 * Common states vary by process template:
 *   - Scrum: "To Do", "In Progress", "Done"
 *   - Agile: "Active", "Resolved", "Closed"
 *   - CMMI:  "Proposed", "Active", "Resolved", "Closed"
 *
 * @param {number|string} id      Work item ID
 * @param {string}        newState  Target state value
 * @returns {Promise<{id:number, title:string, newState:string, url:string}>}
 */
export async function updateWorkItemState(id, newState) {
  const response = await adoClient.patch(
    `/wit/workitems/${id}`,
    [{ op: "add", path: "/fields/System.State", value: newState }],
    { headers: { "Content-Type": "application/json-patch+json" } }
  );

  return {
    id: response.data.id,
    title: response.data.fields["System.Title"],
    newState: response.data.fields["System.State"],
    url: response.data._links?.html?.href,
  };
}

/**
 * Adds a comment to the Discussion section of a work item.
 * Supports plain text; Markdown is rendered by ADO if the project supports it.
 *
 * @param {number|string} id       Work item ID
 * @param {string}        comment  Comment body (plain text or Markdown)
 * @returns {Promise<{id:number, workItemId:number|string, text:string, createdBy:string, createdDate:string}>}
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

/**
 * Adds a predecessor dependency relation so `workItemId` depends on
 * `dependsOnId` (sequence enforcement).
 *
 * @param {number|string} workItemId
 * @param {number|string} dependsOnId
 * @returns {Promise<{id:number, linkedTo:number|string, relationType:string}>}
 */
export async function addWorkItemDependency(workItemId, dependsOnId) {
  const dependencyUrl = `https://dev.azure.com/${process.env.ADO_ORG}/${process.env.ADO_PROJECT}/_apis/wit/workItems/${dependsOnId}`;
  const response = await adoClient.patch(
    `/wit/workitems/${workItemId}`,
    [
      {
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Dependency-Reverse",
          url: dependencyUrl,
        },
      },
    ],
    { headers: { "Content-Type": "application/json-patch+json" } }
  );

  return {
    id: response.data.id,
    linkedTo: dependsOnId,
    relationType: "System.LinkTypes.Dependency-Reverse",
  };
}
