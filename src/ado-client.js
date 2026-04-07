import axios from "axios";
import dotenv from "dotenv";
dotenv.config({
  path: new URL("../.env", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
});

const {
  ADO_ORG,
  ADO_PROJECT,
  ADO_PAT,
  AZURE_DEVOPS_TOKEN,
  ADO_API_VERSION = "7.1",
} = process.env;

const effectivePat = ADO_PAT || AZURE_DEVOPS_TOKEN;

// Base64-encoded PAT for Basic Auth (ADO standard)
const authToken = Buffer.from(`:${effectivePat || ""}`).toString("base64");

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
 * Validates that all required env vars are present
 */
export function validateConfig() {
  const missing = [];
  if (!ADO_ORG) missing.push("ADO_ORG");
  if (!ADO_PROJECT) missing.push("ADO_PROJECT");
  if (!effectivePat) missing.push("ADO_PAT (or AZURE_DEVOPS_TOKEN)");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please copy .env.example to .env and fill in your values.`
    );
  }
}

export const config = { ADO_ORG, ADO_PROJECT, ADO_API_VERSION };
