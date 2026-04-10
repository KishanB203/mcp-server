import { createWorkItem } from './ado/create-work-item.js';
import { getWorkItem } from './ado/get-work-item.js';
import { listWorkItems } from './ado/list-work-items.js';
import { addWorkItemComment, updateWorkItemState } from './ado/update-work-item.js';

/**
 * Executes Azure DevOps ticket operations.
 */
export const ticketTool = {
  create: async (payload) => createWorkItem(payload),
  getById: async (id) => getWorkItem(id),
  list: async (filters) => listWorkItems(filters),
  updateState: async (id, state) => updateWorkItemState(id, state),
  addComment: async (id, comment) => addWorkItemComment(id, comment),
};
