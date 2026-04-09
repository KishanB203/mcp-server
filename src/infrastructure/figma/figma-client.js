/**
 * @module infrastructure/figma/figma-client
 *
 * Pre-configured Axios instance for the Figma REST API (v1).
 * Authentication is via a personal access token passed in the
 * `X-Figma-Token` header.
 *
 * Usage:
 *   import { figmaClient, figmaConfig } from "../../infrastructure/figma/figma-client.js";
 *   const res = await figmaClient.get(`/files/${figmaConfig.fileKey}`);
 */

import axios from "axios";
import {
  FIGMA_TOKEN,
  FIGMA_FILE_KEY,
  FIGMA_PROJECT_ID,
  validateFigmaConfig,
} from "../../config/env.js";

/**
 * Axios instance scoped to the Figma v1 API.
 */
export const figmaClient = axios.create({
  baseURL: "https://api.figma.com/v1",
  headers: {
    "X-Figma-Token": FIGMA_TOKEN,
    "Content-Type": "application/json",
  },
});

/**
 * Validates required Figma environment variables.
 * Re-exported so callers don't need to import from config/env directly.
 *
 * @throws {Error} if FIGMA_TOKEN or FIGMA_FILE_KEY is missing.
 */
export { validateFigmaConfig };

/** Read-only snapshot of resolved Figma configuration values. */
export const figmaConfig = {
  token: FIGMA_TOKEN,
  fileKey: FIGMA_FILE_KEY,
  projectId: FIGMA_PROJECT_ID,
  /** @deprecated Use figmaConfig.fileKey — kept for backward compatibility. */
  FIGMA_FILE_KEY,
};
