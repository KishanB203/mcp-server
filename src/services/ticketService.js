import { ticketTool } from '../tools/ticketTool.js';
import productOwnerAgent from '../agents/product-owner-agent.js';


import { codeAgent } from '../agents/codeAgent.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const applyInlineMarkdown = (text = '') => {
  let value = escapeHtml(text);
  value = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/\*(.+?)\*/g, '<em>$1</em>');
  value = value.replace(/`(.+?)`/g, '<code>$1</code>');
  return value;
};

const markdownToAdoHtml = (markdown = '') => {
  const source = String(markdown || '').replace(/\r\n/g, '\n').trim();
  if (!source) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(source)) return source;

  const lines = source.split('\n');
  const chunks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      chunks.push(`<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        const match = current.match(/^\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${applyInlineMarkdown(match[1])}</li>`);
        i += 1;
      }
      chunks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i].trim();
        const match = current.match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${applyInlineMarkdown(match[1])}</li>`);
        i += 1;
      }
      chunks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const paragraph = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current || /^(#{1,6})\s+/.test(current) || /^\d+\.\s+/.test(current) || /^[-*]\s+/.test(current)) {
        break;
      }
      paragraph.push(current);
      i += 1;
    }
    chunks.push(`<p>${applyInlineMarkdown(paragraph.join(' '))}</p>`);
  }

  return chunks.join('');
};

const SUBTASK_TOPIC_RULES = [
  { label: 'Authentication and Session', pattern: /(login|auth|session|token|credential|sign in|sign-in|redirect)/i },
  { label: 'Access Control and Permissions', pattern: /(access|permission|role|admin|normal user|visibility|department|position|authorization)/i },
  { label: 'Listing, Search, and Filters', pattern: /(list|listing|search|filter|sort|pagination|tab|breadcrumb|view)/i },
  { label: 'Document and Category Management', pattern: /(create|edit|update|delete|category|document|upload|download|assignment|copy url)/i },
  { label: 'User Interface and Feedback', pattern: /(ui|screen|page|layout|responsive|empty state|message|notification|toaster|modal)/i },
];

const compressRequirementLine = (line = '') => {
  const cleaned = String(line)
    .replace(/^\s*[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^(the system|users?|admins?|normal users?)\s+(must|should|can)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ');
  if (words.length <= 18) return cleaned;
  return `${words.slice(0, 18).join(' ')}...`;
};

const isActionableRequirement = (line = '') => {
  const text = String(line || '').trim();
  if (!text || text.length < 20) return false;
  if (/^detailed implementation content was not provided/i.test(text)) return false;
  return /(must|should|can|create|update|delete|assign|search|filter|view|show|display|upload|download|validate|enforce|restrict|navigate|redirect)/i.test(
    text
  );
};

const extractFunctionalRequirementItems = (workItemDescription = '') => {
  const text = String(workItemDescription || '').replace(/\r\n/g, '\n');
  const startMatch = text.match(/##\s*Functional Requirements/i);
  if (!startMatch) return [];

  const startIdx = startMatch.index + startMatch[0].length;
  const afterStart = text.slice(startIdx);
  const nextSectionMatch = afterStart.match(/\n##\s+/);
  const block = (nextSectionMatch ? afterStart.slice(0, nextSectionMatch.index) : afterStart).trim();
  if (!block) return [];

  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter((line) => line && isActionableRequirement(line));

  const unique = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(line);
  }

  if (!unique.length) return [];

  const buckets = new Map();
  for (const line of unique) {
    const topic = SUBTASK_TOPIC_RULES.find((rule) => rule.pattern.test(line))?.label || 'General Implementation';
    const existing = buckets.get(topic) || [];
    existing.push(line);
    buckets.set(topic, existing);
  }

  const plans = [];
  for (const [topic, topicLines] of buckets.entries()) {
    const conciseLines = topicLines.map((line) => compressRequirementLine(line));
    const summary =
      conciseLines.length === 1
        ? conciseLines[0]
        : `${conciseLines.length} related requirements grouped under ${topic.toLowerCase()}.`;

    plans.push({
      topic,
      summary,
      requirementLines: topicLines,
      conciseLines,
    });
  }

  return plans;
};

const createStructuredTicket = async (payload) => {
  if (!payload?.title) {
    throw new Error('title is required');
  }

  // Step 1 + Step 2: ticket request detected -> generate complete, structured output
  const requirements = await codeAgent.generateRequirements({
    featureName: payload.title,
    businessRequirements: payload.description || '',
    // Optionally pass more fields if available (figmaInput, outputDir, etc.)
  });

  if (!requirements?.workItemDescription?.trim()) {
    throw new Error('Failed to generate complete work item content.');
  }

  const descriptionHtml = markdownToAdoHtml(requirements.workItemDescription);
  const acceptanceText =
    payload.acceptanceCriteria || requirements.acceptanceCriteria || 'Acceptance criteria included in description.';
  const normalizedAcceptance =
    acceptanceText && acceptanceText.trim()
      ? acceptanceText
      : '- Given an authenticated user, when they execute the target flow, then expected behavior is completed successfully.';
  const acceptanceHtml = markdownToAdoHtml(normalizedAcceptance) || `<p>${escapeHtml(normalizedAcceptance)}</p>`;
  const parentType =
    /user story|product backlog item|pbi/i.test(String(payload.type || ''))
      ? payload.type
      : 'User Story';

  // Step 3 + Step 4 + Step 5: create parent PBI with full generated content.
  const parentPayload = {
    ...payload,
    title: requirements.workItemTitle || payload.title,
    type: parentType,
    description: descriptionHtml || requirements.workItemDescription,
    acceptanceCriteria: acceptanceHtml,
  };
  const parentItem = await ticketTool.create(parentPayload);

  // Then create child subtasks linked to the parent from functional requirements.
  const subTaskItems = extractFunctionalRequirementItems(requirements.workItemDescription);
  const createdSubtasks = [];
  for (const plan of subTaskItems) {
    const subtask = await ticketTool.create({
      title: `${parentItem.title || parentPayload.title} - ${plan.topic}`,
      type: 'Task',
      description: [
        `<p>${applyInlineMarkdown(plan.summary)}</p>`,
        '<ul>',
        ...plan.conciseLines.map((line) => `<li>${applyInlineMarkdown(line)}</li>`),
        '</ul>',
      ].join(''),
      acceptanceCriteria: [
        '<ul>',
        ...plan.requirementLines.map(
          (line) =>
            `<li>Given implementation of ${applyInlineMarkdown(
              plan.topic.toLowerCase()
            )}, when ${applyInlineMarkdown(line.toLowerCase())}, then the expected behavior is delivered.</li>`
        ),
        '</ul>',
      ].join(''),
      areaPath: payload.areaPath,
      sprint: payload.sprint,
      assignedTo: payload.assignedTo,
      tags: payload.tags,
      priority: payload.priority,
      parentId: parentItem.id,
    });
    createdSubtasks.push(subtask);
  }

  // Step 6: return parent creation response with linked subtasks metadata.
  return {
    ...parentItem,
    subtaskCount: createdSubtasks.length,
    subtasks: createdSubtasks,
  };
};

const analyzeTicket = async (taskId) => productOwnerAgent.analyzeTask(taskId);

export const ticketService = {
  createStructuredTicket,
  analyzeTicket,
};
