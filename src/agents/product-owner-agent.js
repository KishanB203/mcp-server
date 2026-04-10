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

const detectsUIWork = (task) => {
  const keywords = [
    'ui',
    'screen',
    'page',
    'form',
    'component',
    'display',
    'view',
    'button',
    'modal',
    'layout',
  ];
  const text = `${task.title} ${task.description} ${task.acceptanceCriteria}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
};

const detectsAPIWork = (task) => {
  const keywords = [
    'api',
    'endpoint',
    'service',
    'backend',
    'database',
    'query',
    'mutation',
    'rest',
    'fetch',
  ];
  const text = `${task.title} ${task.description} ${task.acceptanceCriteria}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
};

const suggestAgents = ({ uiRequired }) => {
  const agents = ['code-agent', 'developer-agent', 'review-agent', 'devops-agent'];
  if (uiRequired) agents.unshift('figma-design-step');
  return agents;
};

const buildAnalysis = (task) => {
  const validation = validateTask(task);
  const uiRequired = detectsUIWork(task);
  const apiRequired = detectsAPIWork(task);

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
    suggestedAgents: suggestAgents({ uiRequired, apiRequired }),
    summary:
      `**Task Analysis:**\n` +
      `- Type: ${task.type}\n` +
      `- Priority: ${task.priority}\n` +
      `- UI Work: ${uiRequired ? 'Yes' : 'No'}\n` +
      `- API Work: ${apiRequired ? 'Yes' : 'No'}\n` +
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
  suggestAgents,
};

export default productOwnerAgent;
