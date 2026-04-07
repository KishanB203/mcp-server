import { getWorkItem } from "./tools/get-ticket.js";

function extractWorkItemIdFromUrl(url = "") {
  const match = String(url).match(/workitems\/(\d+)/i) || String(url).match(/\/(\d+)(\?|$)/);
  return match ? Number(match[1]) : null;
}

function isDependencyRelation(relType = "") {
  const t = String(relType).toLowerCase();
  return (
    t.includes("dependency") ||
    t.includes("depends") ||
    t.includes("predecessor") ||
    t.includes("successor")
  );
}

function isParentChildRelation(relType = "") {
  const t = String(relType).toLowerCase();
  return t.includes("hierarchy-forward") || t.includes("hierarchy-reverse");
}

function isCompletedState(state = "") {
  const s = String(state).toLowerCase();
  return s === "done" || s === "closed" || s === "resolved" || s === "completed";
}

export class TaskDependencyResolver {
  /**
   * Detect dependency IDs for an ADO work item.
   * Uses relation links when available.
   * @returns {Promise<{taskId:number, dependencyIds:number[]}>}
   */
  async detectDependencies(taskId) {
    const item = await getWorkItem(taskId);
    const deps = new Set();

    for (const rel of item.relations || []) {
      if (!rel?.url) continue;
      const relatedId = extractWorkItemIdFromUrl(rel.url);
      if (!relatedId || relatedId === taskId) continue;

      if (isDependencyRelation(rel.type)) deps.add(relatedId);
      if (isParentChildRelation(rel.type) && String(rel.type).toLowerCase().includes("reverse")) {
        deps.add(relatedId);
      }
    }

    return { taskId, dependencyIds: [...deps] };
  }

  /**
   * Ensures all dependencies are completed before proceeding.
   * @returns {Promise<{ok:boolean, blockedBy?:Array<{id:number,state:string,title:string,url:string}>, dependencyOrder:number[]}>}
   */
  async ensureDependenciesCompleted(taskId) {
    const { dependencyIds } = await this.detectDependencies(taskId);
    if (dependencyIds.length === 0) return { ok: true, blockedBy: [], dependencyOrder: [] };

    const blockedBy = [];
    for (const depId of dependencyIds) {
      const dep = await getWorkItem(depId);
      if (!isCompletedState(dep.state)) {
        blockedBy.push({ id: dep.id, state: dep.state, title: dep.title, url: dep.url });
      }
    }

    return { ok: blockedBy.length === 0, blockedBy, dependencyOrder: dependencyIds };
  }

  /**
   * Builds an execution plan that runs dependencies first (depth-first).
   * Cycles are detected and cause an error.
   * @returns {Promise<number[]>} ordered list of work item IDs
   */
  async resolveExecutionOrder(taskId) {
    const visiting = new Set();
    const visited = new Set();
    const order = [];

    const dfs = async (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`Dependency cycle detected at task ${id}`);
      visiting.add(id);

      const { dependencyIds } = await this.detectDependencies(id);
      for (const depId of dependencyIds) await dfs(depId);

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    await dfs(taskId);
    return order;
  }
}

export const taskDependencyResolver = new TaskDependencyResolver();

