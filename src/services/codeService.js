import { architectureGenerator } from './architecture-generator.js';
import solutionRequirementsAgent from '../agents/solution-requirements-agent.js';
import {
  listProjectRuleMarkdownFiles,
  loadProjectRulesMarkdown,
} from './project-rules.js';

const generateArchitecture = (featureName, rootDir) => {
  const result = architectureGenerator.generate({ featureName, rootDir });
  const projectDir = rootDir ?? process.cwd();
  return {
    ...result,
    projectRules: {
      files: listProjectRuleMarkdownFiles({ projectDir }),
      markdown: loadProjectRulesMarkdown({ projectDir }),
    },
  };
};
const generateRequirementsDocs = (options) => solutionRequirementsAgent.generateDocs(options);
const buildBacklogFromRequirements = (options) =>
  solutionRequirementsAgent.buildBacklogFromRequirements(options);

export const codeService = {
  generateArchitecture,
  generateRequirementsDocs,
  buildBacklogFromRequirements,
};
