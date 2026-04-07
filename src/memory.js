import fs from "fs";
import path from "path";

const DEFAULT_CONTEXT_PATH = path.resolve(process.cwd(), "memory", "project-context.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

export function readContext(contextPath = DEFAULT_CONTEXT_PATH) {
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
}

/**
 * Update context by applying a pure function updater.
 * @param {(ctx:any)=>any} updater
 */
export function updateContext(updater, contextPath = DEFAULT_CONTEXT_PATH) {
  const current = readContext(contextPath);
  const next = updater ? updater(structuredCloneSafe(current)) : current;
  writeJson(contextPath, next);
  return next;
}

export function appendTaskHistory(taskEntry, contextPath = DEFAULT_CONTEXT_PATH) {
  return updateContext((ctx) => {
    const entry = {
      ...taskEntry,
      at: taskEntry?.at || nowIso(),
    };
    ctx.previousTasks = Array.isArray(ctx.previousTasks) ? ctx.previousTasks : [];
    ctx.previousTasks.push(entry);
    return ctx;
  }, contextPath);
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

