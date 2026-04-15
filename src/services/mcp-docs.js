/**
 * @module services/mcp-docs
 *
 * Loads project-level guidance documents from `mcp_docs/` in the target
 * project root. These documents are intended to shape AI behavior.
 */

import fs from "fs";
import path from "path";
import { getRepoRoot } from "./project-rules.js";

/**
 * Absolute path to the target project's `mcp_docs/` directory.
 *
 * @param {{ projectDir?: string }} [options]
 * @returns {string}
 */
export const getMcpDocsDir = (options = {}) =>
  path.join(getRepoRoot(options.projectDir), "mcp_docs");

/**
 * Checks whether file name matches `.env*` style.
 *
 * @param {string} name
 * @returns {boolean}
 */
const isEnvFile = (name) => {
  if (!String(name || "").startsWith(".env")) return false;
  if (/\.bak$/i.test(name)) return false;
  return true;
};

/**
 * Sorted list of env files from target project's `mcp_docs/` folder only.
 * `displayName` is used in UI/output, `fullPath` is used for reading keys.
 *
 * @param {{ projectDir?: string }} [options]
 * @returns {Array<{ displayName: string, fullPath: string, source: "mcp_docs" }>}
 */
export const listProjectEnvFiles = (options = {}) => {
  const docsDir = getMcpDocsDir(options);
  try {
    return fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isEnvFile(entry.name))
      .map((entry) => ({
        displayName: `mcp_docs/${entry.name}`,
        fullPath: path.join(docsDir, entry.name),
        source: "mcp_docs",
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch {
    return [];
  }
};

/**
 * Parses env variable keys from one env file.
 * Values are intentionally not returned so secret values are not leaked
 * into prompt context.
 *
 * @param {string} fullPath
 * @returns {string[]}
 */
const readEnvKeys = (fullPath) => {
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.replace(/^export\s+/, ""))
      .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] ?? null)
      .filter(Boolean);
  } catch {
    return [];
  }
};

/**
 * Sorted list of files in `mcp_docs/` (non-recursive), plus discovered env files.
 *
 * @param {{ projectDir?: string }} [options]
 * @returns {string[]}
 */
export const listMcpDocFiles = (options = {}) => {
  const docsDir = getMcpDocsDir(options);
  const envFiles = listProjectEnvFiles(options).map(
    (envFile) => `[env] ${envFile.displayName}`
  );
  try {
    const docFiles = fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !isEnvFile(entry.name))
      .map((entry) => entry.name)
      .sort();
    return [...docFiles, ...envFiles];
  } catch {
    return envFiles;
  }
};

/**
 * Loads all file contents under `mcp_docs/` and concatenates them.
 *
 * @param {{ projectDir?: string }} [options]
 * @returns {string}
 */
export const loadMcpDocsMarkdown = (options = {}) => {
  const docsDir = getMcpDocsDir(options);
  const envFiles = listProjectEnvFiles(options);
  try {
    const docsText = fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !isEnvFile(entry.name))
      .map((entry) => entry.name)
      .sort()
      .map((fileName) => {
        const fullPath = path.join(docsDir, fileName);
        try {
          const content = fs.readFileSync(fullPath, "utf8").trim();
          return content ? `# ${fileName}\n\n${content}` : "";
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .join("\n\n");

    const envText = envFiles
      .map((envFile) => {
        const fullPath = envFile.fullPath;
        const keys = [...new Set(readEnvKeys(fullPath))].sort();
        if (!keys.length) return "";
        return (
          `# [env] ${envFile.displayName}\n\n` +
          `Environment keys loaded from ${envFile.source} (${envFile.displayName}).\n` +
          `Values are redacted; keys are provided for runtime/context awareness.\n\n` +
          keys.map((key) => `- ${key}`).join("\n")
        );
      })
      .filter(Boolean)
      .join("\n\n");

    return [docsText, envText].filter(Boolean).join("\n\n");
  } catch {
    const envText = envFiles
      .map((envFile) => {
        const fullPath = envFile.fullPath;
        const keys = [...new Set(readEnvKeys(fullPath))].sort();
        if (!keys.length) return "";
        return (
          `# [env] ${envFile.displayName}\n\n` +
          `Environment keys loaded from ${envFile.source} (${envFile.displayName}).\n` +
          `Values are redacted; keys are provided for runtime/context awareness.\n\n` +
          keys.map((key) => `- ${key}`).join("\n")
        );
      })
      .filter(Boolean)
      .join("\n\n");
    return envText;
  }
};
