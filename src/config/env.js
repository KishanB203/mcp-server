/**
 * @module config/env
 *
 * Central environment configuration.
 * Loads `.env` exactly once at process startup and exports typed constants.
 *
 * Every other module MUST import its env vars from here instead of reading
 * `process.env` directly, so that:
 *   - dotenv is called in a single, predictable location.
 *   - Missing-variable errors surface early, with clear messages.
 *   - Tests can stub env vars by overriding exports from this module.
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Resolve the project-root .env regardless of how deep this file is nested.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

// ── Azure DevOps ──────────────────────────────────────────────────────────────

export const ADO_ORG = process.env.ADO_ORG ?? "";
export const ADO_PROJECT = process.env.ADO_PROJECT ?? "";
export const ADO_PAT = process.env.ADO_PAT ?? "";
export const AZURE_DEVOPS_TOKEN = process.env.AZURE_DEVOPS_TOKEN ?? "";
export const ADO_API_VERSION = process.env.ADO_API_VERSION ?? "7.1";

/** Resolved PAT — prefers `ADO_PAT`, falls back to `AZURE_DEVOPS_TOKEN`. */
export const EFFECTIVE_ADO_PAT = ADO_PAT || AZURE_DEVOPS_TOKEN;

// ── Figma ─────────────────────────────────────────────────────────────────────

export const FIGMA_TOKEN = process.env.FIGMA_TOKEN ?? "";
export const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY ?? "";
export const FIGMA_PROJECT_ID = process.env.FIGMA_PROJECT_ID ?? "";

// ── GitHub ────────────────────────────────────────────────────────────────────

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
export const GITHUB_API_BASE_URL =
  process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";
export const GITHUB_API_VERSION =
  process.env.GITHUB_API_VERSION ?? "2022-11-28";
export const REPO_OWNER = process.env.REPO_OWNER ?? "";
export const REPO_NAME = process.env.REPO_NAME ?? "";
export const BASE_BRANCH = process.env.BASE_BRANCH ?? "main";

// ── Logging / Debug ───────────────────────────────────────────────────────────

export const LOG_TO_FILE = Boolean(process.env.LOG_TO_FILE);
export const LOG_FILE = process.env.LOG_FILE ?? "";
export const DEBUG = Boolean(process.env.DEBUG);

// ── MCP Server ────────────────────────────────────────────────────────────────

export const MCP_PORT = process.env.MCP_PORT ?? "3000";

// ─────────────────────────────────────────────────────────────────────────────
// Validators — throw early with actionable messages when vars are absent.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the Azure DevOps configuration.
 * Called at MCP server startup via `validateConfig()`.
 *
 * @throws {Error} listing every missing variable.
 */
export const validateAdoConfig = () => {
  const missing = [];
  if (!ADO_ORG) missing.push("ADO_ORG");
  if (!ADO_PROJECT) missing.push("ADO_PROJECT");
  if (!EFFECTIVE_ADO_PAT) missing.push("ADO_PAT (or AZURE_DEVOPS_TOKEN)");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please copy .env.example to .env and fill in your values.`
    );
  }
};

/**
 * Validates that Figma env vars are set before any Figma API call is made.
 *
 * @throws {Error} listing every missing variable.
 */
export const validateFigmaConfig = () => {
  const missing = [];
  if (!FIGMA_TOKEN) missing.push("FIGMA_TOKEN");
  if (!FIGMA_FILE_KEY) missing.push("FIGMA_FILE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing Figma environment variables: ${missing.join(", ")}\n` +
        `Please add them to your .env file.`
    );
  }
};

/**
 * Validates every variable required for the full automated DevOps workflow
 * (ADO + GitHub branch + PR + merge).
 *
 * @throws {Error} listing every missing variable.
 */
export const validateWorkflowConfig = () => {
  const missing = [];
  if (!GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!ADO_ORG) missing.push("ADO_ORG");
  if (!ADO_PROJECT) missing.push("ADO_PROJECT");
  if (!REPO_OWNER) missing.push("REPO_OWNER");
  if (!REPO_NAME) missing.push("REPO_NAME");
  if (!EFFECTIVE_ADO_PAT) missing.push("ADO_PAT (or AZURE_DEVOPS_TOKEN)");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};
