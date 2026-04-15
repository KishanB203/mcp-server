import { codeService } from '../services/codeService.js';
import { validationTool } from '../tools/validationTool.js';

const generateArchitecture = (featureName, rootDir) =>
  codeService.generateArchitecture(featureName, rootDir);
const generateRequirements = (options) => codeService.generateRequirementsDocs(options);
const buildBacklogFromRequirements = (options) =>
  codeService.buildBacklogFromRequirements(options);
const validateGeneratedDiff = (diff, changedFiles) =>
  validationTool.validateDiff(diff, changedFiles);

export const codeAgent = {
  generateArchitecture,
  generateRequirements,
  buildBacklogFromRequirements,
  validateGeneratedDiff,
};
