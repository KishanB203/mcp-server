import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const { FIGMA_TOKEN, FIGMA_FILE_KEY } = process.env;

export const figmaClient = axios.create({
  baseURL: "https://api.figma.com/v1",
  headers: {
    "X-Figma-Token": FIGMA_TOKEN,
    "Content-Type": "application/json",
  },
});

/**
 * Validates Figma env vars are present
 */
export function validateFigmaConfig() {
  const missing = [];
  if (!FIGMA_TOKEN) missing.push("FIGMA_TOKEN");
  if (!FIGMA_FILE_KEY) missing.push("FIGMA_FILE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing Figma environment variables: ${missing.join(", ")}\n` +
        `Please add them to your .env file.`
    );
  }
}

export const figmaConfig = { FIGMA_TOKEN, FIGMA_FILE_KEY };
