import fs from "fs";
import path from "path";

function isoNow() {
  return new Date().toISOString();
}

function safeString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class Logger {
  constructor(options = {}) {
    this.logToFile = Boolean(options.logToFile ?? process.env.LOG_TO_FILE);
    this.logFilePath =
      options.logFilePath ||
      process.env.LOG_FILE ||
      path.resolve(process.cwd(), "logs", "claude-auto.log");
    this.prefix = options.prefix || "claude";
  }

  ensureLogFile() {
    if (!this.logToFile) return;
    const dir = path.dirname(this.logFilePath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.logFilePath)) fs.writeFileSync(this.logFilePath, "", "utf8");
  }

  write(line) {
    const msg = safeString(line);
    const formatted = `[${isoNow()}] [${this.prefix}] ${msg}`;
    console.log(formatted);
    if (this.logToFile) {
      this.ensureLogFile();
      fs.appendFileSync(this.logFilePath, formatted + "\n", "utf8");
    }
  }

  logTaskStart(taskId) {
    this.write(`TaskStart taskId=${taskId}`);
  }

  logAgentStep(agentName, action) {
    this.write(`AgentStep agent=${agentName} action=${safeString(action)}`);
  }

  logPRCreation(prUrl) {
    this.write(`PRCreated url=${prUrl}`);
  }

  logMerge(prId) {
    this.write(`PRMerged pr=${prId}`);
  }

  info(message) {
    this.write(`INFO ${message}`);
  }

  warn(message) {
    this.write(`WARN ${message}`);
  }

  error(message) {
    this.write(`ERROR ${message}`);
  }
}

export function createLogger(options = {}) {
  return new Logger(options);
}

