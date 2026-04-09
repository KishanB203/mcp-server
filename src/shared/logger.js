/**
 * @module shared/logger
 *
 * Structured, prefix-aware logger for the MCP automation pipeline.
 *
 * Features:
 *   - Timestamps every line with an ISO-8601 timestamp
 *   - Supports optional file logging (enabled via `LOG_TO_FILE` env var)
 *   - Provides semantic helpers for the common pipeline log events
 *     (task start, agent step, PR creation, merge)
 *
 * Usage:
 *   import { createLogger } from "../shared/logger.js";
 *   const logger = createLogger({ prefix: "workflow" });
 *   logger.logAgentStep("ADO", "Fetch work item");
 *   logger.warn("Something unexpected happened");
 */

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {string} Current time in ISO-8601 format */
function isoNow() {
  return new Date().toISOString();
}

/**
 * Safely converts any value to a string suitable for log output.
 *
 * @param {*} value
 * @returns {string}
 */
function safeString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────────────────────

export class Logger {
  /**
   * @param {object} [options]
   * @param {boolean} [options.logToFile]   Write log lines to a file (default: off)
   * @param {string}  [options.logFilePath] Absolute path to the log file
   * @param {string}  [options.prefix]      Short label prepended to every line
   */
  constructor(options = {}) {
    this.logToFile = Boolean(options.logToFile ?? process.env.LOG_TO_FILE);
    this.logFilePath =
      options.logFilePath ??
      process.env.LOG_FILE ??
      path.resolve(process.cwd(), "logs", "claude-auto.log");
    this.prefix = options.prefix ?? "claude";
  }

  // ── File bootstrap ────────────────────────────────────────────────────────

  /** Ensures the log file and its parent directory exist. */
  _ensureLogFile() {
    if (!this.logToFile) return;
    const dir = path.dirname(this.logFilePath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, "", "utf8");
    }
  }

  // ── Core write ────────────────────────────────────────────────────────────

  /**
   * Formats and emits a single log line.
   *
   * @param {string} line
   */
  write(line) {
    const msg = safeString(line);
    const formatted = `[${isoNow()}] [${this.prefix}] ${msg}`;
    // Use stderr so log lines don't pollute the MCP stdio transport.
    process.stderr.write(formatted + "\n");
    if (this.logToFile) {
      this._ensureLogFile();
      fs.appendFileSync(this.logFilePath, formatted + "\n", "utf8");
    }
  }

  // ── Semantic helpers ──────────────────────────────────────────────────────

  /**
   * Logs the beginning of a workflow run.
   *
   * @param {number} taskId
   */
  logTaskStart(taskId) {
    this.write(`TaskStart taskId=${taskId}`);
  }

  /**
   * Logs an agent performing an action.
   *
   * @param {string} agentName
   * @param {string} action
   */
  logAgentStep(agentName, action) {
    this.write(`AgentStep agent=${agentName} action=${safeString(action)}`);
  }

  /**
   * Logs a successful PR creation.
   *
   * @param {string} prUrl
   */
  logPRCreation(prUrl) {
    this.write(`PRCreated url=${prUrl}`);
  }

  /**
   * Logs a successful PR merge.
   *
   * @param {number} prNumber
   */
  logMerge(prNumber) {
    this.write(`PRMerged pr=${prNumber}`);
  }

  // ── Level helpers ─────────────────────────────────────────────────────────

  /** @param {string} message */
  info(message) {
    this.write(`INFO  ${message}`);
  }

  /** @param {string} message */
  warn(message) {
    this.write(`WARN  ${message}`);
  }

  /** @param {string} message */
  error(message) {
    this.write(`ERROR ${message}`);
  }
}

/**
 * Factory — creates a new `Logger` with the given options.
 *
 * @param {object} [options]  See {@link Logger} constructor options
 * @returns {Logger}
 */
export function createLogger(options = {}) {
  return new Logger(options);
}
