/**
 * @module infrastructure/ado/ado-client
 *
 * Pre-configured Axios instance for the Azure DevOps REST API.
 * Uses HTTP Basic authentication with a Base64-encoded PAT,
 * which is the standard mechanism supported by all ADO plans.
 *
 * Usage:
 *   import { adoClient } from "../../infrastructure/ado-client.js";
 *   const res = await adoClient.get("/wit/workitems/42", { params: { "$expand": "all" } });
 */

import axios from "axios";
import {
  ADO_ORG,
  ADO_PROJECT,
  ADO_API_VERSION,
  EFFECTIVE_ADO_PAT,
  validateAdoConfig,
} from "../config/env.js";

// ADO requires Base64-encoded ":PAT" (colon-prefixed) for Basic auth.
const authToken = Buffer.from(`:${EFFECTIVE_ADO_PAT}`).toString("base64");

/**
 * Axios instance scoped to the configured ADO organisation and project.
 * The `api-version` query param is appended automatically to every request.
 */
export const adoClient = axios.create({
  baseURL: `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis`,
  headers: {
    Authorization: `Basic ${authToken}`,
    "Content-Type": "application/json",
  },
  params: {
    "api-version": ADO_API_VERSION,
  },
});

/**
 * Validates required ADO environment variables at startup.
 * Re-exported so callers don't need to import from config/env directly.
 *
 * @throws {Error} if any required variable is missing.
 */
export { validateAdoConfig as validateConfig };

/** Read-only snapshot of resolved ADO configuration values. */
export const adoConfig = {
  org: ADO_ORG,
  project: ADO_PROJECT,
  apiVersion: ADO_API_VERSION,
};
