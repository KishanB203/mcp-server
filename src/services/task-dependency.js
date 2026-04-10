/**
 * @module services/task-dependency
 *
 * Resolves the dependency graph of Azure DevOps work items before the pipeline
 * starts executing.  Ensures that all blocking tasks are completed before work
 * on the requested task begins.
 *
 * Dependency detection uses the `relations` array returned by the ADO API.
 * Supported relation types:
 *   - Dependency / Depends-on / Predecessor / Successor
 *   - Parent → Child (hierarchy-reverse = child depends on parent)
 *
 * Cycle detection is performed via DFS.  A cycle causes an immediate error.
 */

import { getWorkItem } from "../tools/ado/get-work-item.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a work item ID from an ADO relation URL.
 *
 * @param {string} url  e.g. "https://dev.azure.com/org/project/_apis/wit/workItems/42"
 * @returns {number|null}
 */
const extractWorkItemIdFromUrl = (url = "") => {
  const match =
    String(url).match(/workitems\/(\d+)/i) ||
    String(url).match(/\/(\d+)(\?|$)/);
  return match ? Number(match[1]) : null;
}

/**
 * Returns `true` if `relType` represents a blocking dependency.
 *
 * @param {string} relType  ADO relation type string
 * @returns {boolean}
 */
const isDependencyRelation = (relType = "") => {
  const t = String(relType).toLowerCase();
  return (
    t.includes("dependency") ||
    t.includes("depends") ||
    t.includes("predecessor") ||
    t.includes("successor")
  );
}

/**
 * Returns `true` if `relType` is a parent-child hierarchy relation.
 *
 * @param {string} relType
 * @returns {boolean}
 */
const isParentChildRelation = (relType = "") => {
  const t = String(relType).toLowerCase();
  return t.includes("hierarchy-forward") || t.includes("hierarchy-reverse");
}

/**
 * Returns `true` if the work item state indicates it is complete.
 *
 * @param {string} state
 * @returns {boolean}
 */
const isCompletedState = (state = "") => {
  const s = String(state).toLowerCase();
  return s === "done" || s === "closed" || s === "resolved" || s === "completed";
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDependencyResolver
// ─────────────────────────────────────────────────────────────────────────────

export class TaskDependencyResolver {
  /**
   * Returns the IDs of all work items that `taskId` directly depends on,
   * as determined by its ADO relation links.
   *
   * @param {number|string} taskId
   * @returns {Promise<{taskId:number, dependencyIds:number[]}>}
   */
  async detectDependencies(taskId) {
    const item = await getWorkItem(taskId);
    const deps = new Set();

    for (const rel of item.relations ?? []) {
      if (!rel?.url) continue;
      const relatedId = extractWorkItemIdFromUrl(rel.url);
      if (!relatedId || relatedId === taskId) continue;

      if (isDependencyRelation(rel.type)) {
        deps.add(relatedId);
      }
      // A child work item depends on its parent (hierarchy-reverse = child side).
      if (
        isParentChildRelation(rel.type) &&
        String(rel.type).toLowerCase().includes("reverse")
      ) {
        deps.add(relatedId);
      }
    }

    return { taskId: Number(taskId), dependencyIds: [...deps] };
  }

  /**
   * Verifies that all dependencies of `taskId` are in a completed state.
   *
   * @param {number|string} taskId
   * @returns {Promise<{ok:boolean, blockedBy:Array<{id:number,state:string,title:string,url:string}>, dependencyOrder:number[]}>}
   */
  async ensureDependenciesCompleted(taskId) {
    const { dependencyIds } = await this.detectDependencies(taskId);
    if (dependencyIds.length === 0) {
      return { ok: true, blockedBy: [], dependencyOrder: [] };
    }

    const blockedBy = [];
    for (const depId of dependencyIds) {
      const dep = await getWorkItem(depId);
      if (!isCompletedState(dep.state)) {
        blockedBy.push({
          id: dep.id,
          state: dep.state,
          title: dep.title,
          url: dep.url,
        });
      }
    }

    return {
      ok: blockedBy.length === 0,
      blockedBy,
      dependencyOrder: dependencyIds,
    };
  }

  /**
   * Produces a topologically-sorted execution order (dependencies first) using
   * a depth-first search.  Throws on cyclic dependencies.
   *
   * @param {number|string} taskId
   * @returns {Promise<number[]>}  Ordered list of work item IDs to process
   * @throws {Error} when a dependency cycle is detected
   */
  async resolveExecutionOrder(taskId) {
    const visiting = new Set();
    const visited = new Set();
    const order = [];

    const dfs = async (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Dependency cycle detected at task ${id}`);
      }

      visiting.add(id);
      const { dependencyIds } = await this.detectDependencies(id);
      for (const depId of dependencyIds) {
        await dfs(depId);
      }
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    await dfs(Number(taskId));
    return order;
  }
}

/** Singleton instance used by the workflow and MCP handlers. */
export const taskDependencyResolver = new TaskDependencyResolver();
