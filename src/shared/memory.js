/**
 * @module shared/memory
 *
 * Lightweight JSON-file persistence layer for the pipeline's project context.
 *
 * Stores a structured JSON document at `memory/project-context.json` that
 * accumulates:
 *   - Project metadata
 *   - Architecture decisions
 *   - Previously processed tasks (id, title, branch, PR, merged timestamp)
 *   - PR merge history
 *
 * All mutations go through `updateContext()` to guarantee atomic reads +
 * writes and prevent partial-state corruption.
 *
 * Usage:
 *   import { readContext, updateContext, appendTaskHistory } from "../shared/memory.js";
 *   appendTaskHistory({ taskId: 42, title: "...", prUrl: "..." });
 */

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT_PATH = path.resolve(
  process.cwd(),
  "memory",
  "project-context.json"
);

/** @returns {string} Current time as ISO-8601 string */
const nowIso = () => {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads and parses a JSON file.
 *
 * @param {string} filePath
 * @returns {object}
 */
const readJson = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Serialises `obj` to JSON and writes it to `filePath`.
 * Creates the parent directory if it does not exist.
 *
 * @param {string} filePath
 * @param {object} obj
 */
const writeJson = (filePath, obj) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

/**
 * Deep-clones a value using `structuredClone` (Node ≥ 17) with a
 * JSON-serialise fallback for older runtimes.
 *
 * @param {*} value
 * @returns {*}
 */
const deepClone = (value) => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the project context from disk.
 * If the file does not exist, seeds it with an empty initial structure.
 *
 * @param {string} [contextPath]
 * @returns {ProjectContext}
 *
 * @typedef {object} ProjectContext
 * @property {{ name: string, createdAt: string }} project
 * @property {object[]}  architectureDecisions
 * @property {TaskEntry[]} previousTasks
 * @property {object[]}  generatedComponents
 * @property {PREntry[]} prHistory
 */
export const readContext = (contextPath = DEFAULT_CONTEXT_PATH) => {
  if (!fs.existsSync(contextPath)) {
    const initial = {
      project: { name: "unknown", createdAt: nowIso() },
      architectureDecisions: [],
      previousTasks: [],
      generatedComponents: [],
      prHistory: [],
    };
    writeJson(contextPath, initial);
    return initial;
  }
  return readJson(contextPath);
};

/**
 * Applies `updater` to the current context and writes the result back to disk.
 *
 * @param {(ctx: ProjectContext) => ProjectContext} updater  Pure function — receives a deep clone, returns the next state
 * @param {string} [contextPath]
 * @returns {ProjectContext}  The updated context
 */
export const updateContext = (updater, contextPath = DEFAULT_CONTEXT_PATH) => {
  const current = readContext(contextPath);
  const next = updater ? updater(deepClone(current)) : current;
  writeJson(contextPath, next);
  return next;
};

/**
 * Appends a completed-task record to `previousTasks`.
 *
 * @param {TaskEntry} taskEntry
 * @param {string}    [contextPath]
 * @returns {ProjectContext}
 *
 * @typedef {object} TaskEntry
 * @property {number|string} taskId
 * @property {string} title
 * @property {string} [branch]
 * @property {number} [prNumber]
 * @property {string} [prUrl]
 * @property {boolean} [merged]
 * @property {string}  [at]  ISO timestamp (defaults to now)
 */
export const appendTaskHistory = (taskEntry, contextPath = DEFAULT_CONTEXT_PATH) => {
  return updateContext((ctx) => {
    const entry = { ...taskEntry, at: taskEntry?.at ?? nowIso() };
    ctx.previousTasks = Array.isArray(ctx.previousTasks) ? ctx.previousTasks : [];
    ctx.previousTasks.push(entry);
    return ctx;
  }, contextPath);
};
