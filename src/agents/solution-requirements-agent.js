import fs from "fs/promises";
import path from "path";
import { figmaClient, validateFigmaConfig } from "../infrastructure/figma-client.js";

const WORK_ITEM_OUTPUT_FORMAT = `Generate a complete Azure DevOps work item body in this exact structure:

Title
Description (clear, structured, and detailed)
Business Value
Scope (In Scope / Out of Scope)
Functional Requirements (numbered list)
Non-Functional Requirements (if applicable)
Acceptance Criteria (in Given/When/Then format, multiple items)

Do not summarize. Do not truncate. Keep all relevant details explicit and testable.`;

function extractFigmaFileKey(figmaInput = "") {
  const text = String(figmaInput || "").trim();
  if (!text) return null;

  const urlMatch = text.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];

  if (/^[a-zA-Z0-9]{10,}$/.test(text)) return text;
  return null;
}

function collectNodeNames(nodes = [], out = []) {
  for (const node of nodes) {
    if (!node) continue;
    const name = String(node.name || "").trim();
    if (
      name &&
      name.length >= 3 &&
      name.length <= 80 &&
      /[a-zA-Z]/.test(name) &&
      !/^(frame|group|page|component)$/i.test(name)
    ) {
      out.push(name);
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      collectNodeNames(node.children, out);
    }
  }
  return out;
}

async function collectFigmaUiHints(figmaInput = "") {
  const fileKey = extractFigmaFileKey(figmaInput);
  if (!fileKey) return { fileKey: null, hints: [], error: null };

  try {
    validateFigmaConfig();
    const response = await figmaClient.get(`/files/${fileKey}`, {
      params: { depth: 4 },
    });

    const pageNames = (response.data.document?.children ?? [])
      .map((p) => p?.name)
      .filter(Boolean)
      .slice(0, 20);
    const nodeNames = collectNodeNames(response.data.document?.children ?? [])
      .slice(0, 100);

    return {
      fileKey,
      hints: [...pageNames, ...nodeNames],
      error: null,
    };
  } catch (error) {
    return {
      fileKey,
      hints: [],
      error: error.message,
    };
  }
}

async function readTextFile(absPath) {
  try {
    const text = await fs.readFile(absPath, "utf8");
    return text.trim();
  } catch {
    return "";
  }
}

async function listImageFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "must", "should", "would",
  "can", "could", "will", "all", "any", "are", "is", "was", "were", "have", "has", "had",
  "then", "when", "where", "what", "how", "who", "why", "your", "our", "their", "there",
  "about", "after", "before", "while", "under", "over", "only", "each", "also", "more",
  "need", "needed", "include", "including", "across", "within", "through", "using", "use",
  "task", "feature", "module", "system", "user", "users", "story", "pbi"
]);

function extractKeywords(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function parseRequirementSections(requirementBody = "") {
  const lines = String(requirementBody || "").replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = null;
  const isLikelyPlainHeading = (line = "", prevLine = "", nextLine = "") => {
    const value = String(line || "").trim();
    if (!value) return false;
    if (value.length < 3 || value.length > 90) return false;
    if (/^[#>*`\-\d]/.test(value)) return false;
    if (/[.!?;:]$/.test(value)) return false;
    if (!/[a-zA-Z]/.test(value)) return false;
    if (value.split(/\s+/).length > 10) return false;
    if (prevLine && prevLine.trim()) return false;
    if (!nextLine || !nextLine.trim()) return false;
    return true;
  };

  const pushCurrent = () => {
    if (!current) return;
    const body = current.lines.join("\n").trim();
    sections.push({
      title: current.title.trim(),
      body,
    });
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const prevLine = idx > 0 ? lines[idx - 1] : "";
    const nextLine = idx + 1 < lines.length ? lines[idx + 1] : "";
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      pushCurrent();
      current = { title: headingMatch[1], lines: [] };
      continue;
    }
    if (isLikelyPlainHeading(line, prevLine, nextLine)) {
      pushCurrent();
      current = { title: line.trim(), lines: [] };
      continue;
    }
    if (!current) {
      current = { title: "Feature Details", lines: [] };
    }
    current.lines.push(line);
  }
  pushCurrent();

  return sections.filter((s) => s.title || s.body);
}

function scoreSectionForTask(section, keywords = []) {
  if (!section || !keywords.length) return 0;
  const title = String(section.title || "").toLowerCase();
  const body = String(section.body || "").toLowerCase();

  let score = 0;
  for (const kw of keywords) {
    if (title.includes(kw)) score += 5;
    if (body.includes(kw)) score += 2;
  }
  return score;
}

function sectionPenalty(section) {
  const title = String(section?.title || "").toLowerCase();
  if (/^knowledge base|general experience|overview|introduction|feature details/.test(title)) {
    return 3;
  }
  return 0;
}

function filterExtraInputForTask(extraText = "", keywords = []) {
  const text = String(extraText || "").trim();
  if (!text) return "";
  if (!keywords.length) return text;

  const sentences = splitSentences(text);
  const relevant = sentences.filter((line) => {
    const lower = line.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  });

  const picked = relevant.length ? relevant.slice(0, 12) : sentences.slice(0, 4);
  return picked.join(" ");
}

function buildTaskScopedRequirementBody({ requirementFromFile = "", featureName = "", businessRequirements = "" }) {
  const fileText = String(requirementFromFile || "").trim();
  const extraText = String(businessRequirements || "").trim();
  const titleKeywords = extractKeywords(featureName);
  const fallbackKeywords = titleKeywords.length
    ? titleKeywords
    : extractKeywords(splitSentences(extraText).slice(0, 2).join(" "));
  const keywords = fallbackKeywords;
  const filteredExtraText = filterExtraInputForTask(extraText, keywords);
  if (!fileText) {
    const extraSections = parseRequirementSections(extraText);
    if (!extraSections.length) return filteredExtraText;
    const rankedExtra = extraSections
      .map((section) => ({
        section,
        score: Math.max(0, scoreSectionForTask(section, keywords) - sectionPenalty(section)),
      }))
      .sort((a, b) => b.score - a.score);
    const selectedExtra = rankedExtra
      .filter((item) => item.score > 0)
      .slice(0, 4)
      .map((item) => item.section);
    const finalExtra = (selectedExtra.length ? selectedExtra : rankedExtra.slice(0, 2).map((item) => item.section))
      .map((section) => `## ${section.title}\n${section.body}`)
      .join("\n\n")
      .trim();
    return finalExtra || filteredExtraText;
  }

  const sections = parseRequirementSections(fileText);
  if (!sections.length) {
    return filteredExtraText ? `${fileText}\n\n---\n\n### Additional Input\n\n${filteredExtraText}` : fileText;
  }

  const ranked = sections
    .map((section) => ({
      section,
      score: Math.max(0, scoreSectionForTask(section, keywords) - sectionPenalty(section)),
    }))
    .sort((a, b) => b.score - a.score);

  const bestScore = ranked[0]?.score || 0;
  const threshold = bestScore > 0 ? Math.max(4, Math.floor(bestScore * 0.45)) : 0;

  const matched = ranked
    .filter((item) => item.score >= threshold && item.score > 0)
    .slice(0, 4)
    .map((item) => item.section);
  const selectedSections = matched.length ? matched : ranked.slice(0, 2).map((item) => item.section);

  const scopedFileContent = selectedSections
    .map((section) => `## ${section.title}\n${section.body}`)
    .join("\n\n")
    .trim();

  if (scopedFileContent && filteredExtraText) {
    return `${scopedFileContent}\n\n---\n\n### Additional Input\n\n${filteredExtraText}`;
  }
  return scopedFileContent || filteredExtraText;
}

function splitSentences(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectRequirementStatements(sections = []) {
  const statements = [];

  for (const section of sections) {
    const lines = String(section.body || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const normalizedLine = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
      if (!normalizedLine) continue;

      const sentenceCandidates = splitSentences(normalizedLine);
      if (sentenceCandidates.length > 1) {
        statements.push(...sentenceCandidates);
      } else {
        statements.push(normalizedLine);
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const stmt of statements) {
    const key = stmt.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(stmt);
    }
  }
  return unique;
}

function inferBusinessValue(sections = [], statements = []) {
  const businessSignals = statements.filter((line) =>
    /(enable|improve|reduce|increase|streamline|standardize|secure|compliance|visibility|productivity|efficien)/i.test(
      line
    )
  );

  if (!businessSignals.length) {
    return "- Business value is derived from delivering the requested capabilities with explicit, testable behavior.";
  }

  return businessSignals
    .slice(0, 5)
    .map((line) => `- ${line}`)
    .join("\n");
}

function buildScopeSection(sections = [], statements = []) {
  const inScopeTitles = sections.map((s) => s.title).filter(Boolean);
  const outOfScopeLines = statements.filter((line) =>
    /(out of scope|not in scope|does not include|exclude|must not|cannot)/i.test(line)
  );

  const inScope = inScopeTitles.length
    ? inScopeTitles.map((title) => `- ${title}`).join("\n")
    : "- Core feature implementation requested by the input.";
  const outOfScope = outOfScopeLines.length
    ? outOfScopeLines.slice(0, 5).map((line) => `- ${line}`).join("\n")
    : "- Any behavior, integration, or workflow not explicitly defined in the functional requirements.";

  return `## Scope\n\n**In Scope**\n${inScope}\n\n**Out of Scope**\n${outOfScope}`;
}

function buildFunctionalRequirements(statements = []) {
  const candidateStatements = statements.filter((line) =>
    /(must|should|shall|required|can|cannot|only|support|allow|validate|display|show|create|update|delete|assign|filter|search|sort|upload|download|redirect)/i.test(
      line
    )
  );

  const picked = (candidateStatements.length ? candidateStatements : statements).slice(0, 40);
  if (!picked.length) {
    return "- The system must implement the feature behavior described by the provided input.";
  }

  return picked
    .map((line) => `- ${line}`)
    .join("\n\n");
}

function buildNonFunctionalRequirements(statements = []) {
  const picked = statements.filter((line) =>
    /(security|session|token|performance|responsive|upload|size|limit|server side|server-side|validation|pagination|error message|api|audit|access control)/i.test(
      line
    )
  );

  if (!picked.length) {
    return "- No explicit non-functional constraints were found in the provided input.";
  }

  return picked
    .slice(0, 25)
    .map((line) => `- ${line}`)
    .join("\n");
}

function inferActor(statement = "") {
  if (/admin/i.test(statement)) return "an Admin user";
  if (/normal user|end user|reader/i.test(statement)) return "a Normal User";
  return "an authenticated user";
}

function buildAcceptanceCriteria(statements = []) {
  const candidates = statements.filter((line) =>
    /(must|should|shall|required|can|cannot|only|support|allow|validate|display|show|create|update|delete|assign|filter|search|sort|upload|download|redirect)/i.test(
      line
    )
  );
  const source = (candidates.length ? candidates : statements).slice(0, 25);

  if (!source.length) {
    return "- Given an authenticated user, when they perform the core workflow, then the system processes the request successfully and returns expected results.";
  }

  return source
    .map((statement) => {
      const actor = inferActor(statement);
      return `- Given ${actor}, when ${statement.charAt(0).toLowerCase()}${statement.slice(
        1
      )}, then the system enforces the behavior exactly as specified.`;
    })
    .join("\n");
}

function buildAdoWorkItemDescription({ requirementBody, figmaInsight }) {
  const sections = parseRequirementSections(requirementBody);
  const statements = collectRequirementStatements(sections);
  const descriptionSections = sections
    .map((section) => `#### ${section.title}\n${section.body || "- No additional details provided."}`)
    .join("\n\n");
  const figmaContext = figmaInsight?.hints?.length
    ? `\n\n#### Design Context\n- Relevant design cues: ${figmaInsight.hints.slice(0, 20).join(", ")}`
    : "";

  const lines = [
    (descriptionSections || "Detailed implementation content was not provided.") + figmaContext,
    "",
    "## Business Value",
    inferBusinessValue(sections, statements),
    "",
    buildScopeSection(sections, statements),
    "",
    "## Functional Requirements",
    buildFunctionalRequirements(statements),
    "",
    "## Non-Functional Requirements",
    buildNonFunctionalRequirements(statements),
  ];

  return lines.join("\n");
}

async function mergeRequirementText(absDocPath, featureName, businessRequirements) {
  const fromFile = await readTextFile(absDocPath);
  return buildTaskScopedRequirementBody({
    requirementFromFile: fromFile,
    featureName,
    businessRequirements,
  });
}

export class SolutionRequirementsAgent {
  constructor() {
    this.name = "SolutionRequirementsAgent";
    this.role = "Senior Solution Architect + Product Analyst";
  }

  /**
   * Builds complete work item content from merged project requirements and optional Figma context.
   */
  async generateDocs({
    featureName,
    figmaInput,
    businessRequirements,
    outputDir = process.cwd(),
    requirementDocPath = "requirement.md",
    figmaImagesDir = "figma",
  }) {
    const safeFeature = featureName?.trim() || "feature";
    const base = path.resolve(outputDir);
    const requirementAbs = path.join(base, requirementDocPath);
    const figmaImagesAbs = path.join(base, figmaImagesDir);

    const requirementBody = await mergeRequirementText(
      requirementAbs,
      safeFeature,
      businessRequirements
    );
    const resolvedBody =
      requirementBody.trim() ||
      "(No requirement text was provided. Include requirement details in the request.)";

    const imageFiles = await listImageFiles(figmaImagesAbs);
    const figmaInsight = await collectFigmaUiHints(figmaInput);

    const workItemDescription = buildAdoWorkItemDescription({
      requirementBody: resolvedBody,
      figmaInsight,
    });
    const acceptanceCriteria = buildAcceptanceCriteria(
      collectRequirementStatements(parseRequirementSections(resolvedBody))
    );

    return {
      agent: this.name,
      role: this.role,
      featureName: safeFeature,
      workItemTitle: safeFeature,
      prompt: workItemDescription,
      workItemDescription,
      acceptanceCriteria,
      sources: {
        requirementFile: requirementAbs,
        figmaImagesDir: figmaImagesAbs,
        imageFileCount: imageFiles.length,
        imageFiles,
      },
      figmaAnalysis: {
        fileKey: figmaInsight.fileKey,
        analyzedNodes: figmaInsight.hints.length,
        warning: figmaInsight.error || null,
      },
      note: "Generated complete, structured work item content from the provided feature inputs.",
      workItemFlowNote: WORK_ITEM_OUTPUT_FORMAT,
    };
  }
}

export default new SolutionRequirementsAgent();
