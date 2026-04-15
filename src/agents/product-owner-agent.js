import { ticketTool } from '../tools/ticketTool.js';

const AGENT_NAME = 'ProductOwnerAgent';

const validateTask = (task) => {
  const issues = [];

  if (!task.description || task.description === 'No description provided.') {
    issues.push('Missing description');
  }
  if (
    !task.acceptanceCriteria ||
    task.acceptanceCriteria === 'No acceptance criteria provided.'
  ) {
    issues.push('Missing acceptance criteria');
  }
  if (!task.storyPoints || task.storyPoints === 'Not set') {
    issues.push('Story points not estimated');
  }

  return {
    isValid: issues.length === 0,
    issues,
    readyForDevelopment: issues.length === 0,
  };
};

const buildTaskSearchText = (task) => {
  const searchableParts = [
    task.title,
    task.description,
    task.acceptanceCriteria,
    task.tags,
    task.type,
    task.areaPath,
  ];
  return searchableParts
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
};

const normalizeMatchers = (patterns) => patterns.map((pattern) => new RegExp(pattern, 'i'));

const UI_PATTERNS = normalizeMatchers([
  '\\b(ui|ux|frontend|front-end|client-side|react|angular|vue)\\b',
  '\\b(screen|page|view|layout|template|wireframe|mockup)\\b',
  '\\b(form|field|input|dropdown|checkbox|radio|datepicker)\\b',
  '\\b(button|dialog|modal|toast|tooltip|sidebar|header|footer|tab)\\b',
  '\\b(component|widget|dashboard|table|grid|card|banner)\\b',
  '\\b(render|display|visible|responsive|pixel|design system)\\b',
  '\\b(as a user|user can|user should|on click|clicking)\\b',
]);

const API_PATTERNS = normalizeMatchers([
  '\\b(api|rest|graphql|endpoint|route|controller)\\b',
  '\\b(service|backend|server|middleware|microservice)\\b',
  '\\b(database|sql|nosql|schema|migration|index|query|mutation)\\b',
  '\\b(auth|authorization|token|jwt|session|permission)\\b',
  '\\b(integration|webhook|queue|event|cron|job|worker)\\b',
  '\\b(create|read|update|delete|crud)\\b',
]);

const matchSignals = (text, patterns) => {
  const matches = [];
  for (const pattern of patterns) {
    const result = text.match(pattern);
    if (result) matches.push(result[0]);
  }
  return [...new Set(matches)];
};

const classifyScope = (task) => {
  const text = buildTaskSearchText(task);
  const uiSignals = matchSignals(text, UI_PATTERNS);
  const apiSignals = matchSignals(text, API_PATTERNS);

  const uiConfidence = Math.min(1, uiSignals.length / 3);
  const apiConfidence = Math.min(1, apiSignals.length / 3);

  return {
    text,
    uiSignals,
    apiSignals,
    uiConfidence,
    apiConfidence,
    uiRequired: uiSignals.length > 0,
    apiRequired: apiSignals.length > 0,
  };
};

const detectsUIWork = (task) => {
  return classifyScope(task).uiRequired;
};

const detectsAPIWork = (task) => {
  return classifyScope(task).apiRequired;
};

const suggestAgents = ({ uiRequired }) => {
  const agents = ['code-agent', 'developer-agent', 'review-agent', 'devops-agent'];
  if (uiRequired) agents.unshift('figma-design-step');
  return agents;
};

const buildAnalysis = (task) => {
  const validation = validateTask(task);
  const scope = classifyScope(task);
  const uiRequired = scope.uiRequired;
  const apiRequired = scope.apiRequired;

  return {
    taskId: task.id,
    taskTitle: task.title,
    taskType: task.type,
    priority: task.priority,
    validation,
    requires: {
      uiDesign: uiRequired,
      apiChanges: apiRequired,
      testing: true,
      documentation: task.description?.toLowerCase().includes('document') || false,
    },
    scopeSignals: {
      ui: scope.uiSignals,
      api: scope.apiSignals,
      confidence: {
        ui: scope.uiConfidence,
        api: scope.apiConfidence,
      },
    },
    suggestedAgents: suggestAgents({ uiRequired, apiRequired }),
    summary:
      `**Task Analysis:**\n` +
      `- Type: ${task.type}\n` +
      `- Priority: ${task.priority}\n` +
      `- UI Work: ${uiRequired ? 'Yes' : 'No'}\n` +
      `- API Work: ${apiRequired ? 'Yes' : 'No'}\n` +
      `- UI Signals: ${scope.uiSignals.length ? scope.uiSignals.join(', ') : 'None'}\n` +
      `- API Signals: ${scope.apiSignals.length ? scope.apiSignals.join(', ') : 'None'}\n` +
      `- Validation: ${validation.isValid ? 'Ready' : `Issues: ${validation.issues.join(', ')}`}`,
  };
};

const analyzeTask = async (taskId) => {
  console.error(`[${AGENT_NAME}] Analyzing task #${taskId}...`);
  const task = await ticketTool.getById(taskId);
  const analysis = buildAnalysis(task);

  await ticketTool.addComment(taskId, `ProductOwnerAgent analyzed this task.\n\n${analysis.summary}`);

  return {
    agent: AGENT_NAME,
    task,
    analysis,
  };
};

const productOwnerAgent = {
  name: AGENT_NAME,
  role: 'Product Owner',
  analyzeTask,
  validateTask,
  buildAnalysis,
  detectsUIWork,
  detectsAPIWork,
  classifyScope,
  suggestAgents,
};

export default productOwnerAgent;
