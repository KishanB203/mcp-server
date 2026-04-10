import { architectureGenerator } from './architecture-generator.js';
import solutionRequirementsAgent from '../agents/solution-requirements-agent.js';

const generateArchitecture = (featureName) => architectureGenerator.generate({ featureName });
const generateRequirementsDocs = (options) => solutionRequirementsAgent.generateDocs(options);
const buildBacklogFromRequirements = (options) =>
  solutionRequirementsAgent.buildBacklogFromRequirements(options);

export const codeService = {
  generateArchitecture,
  generateRequirementsDocs,
  buildBacklogFromRequirements,
};
