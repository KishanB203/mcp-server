import { codeService } from '../services/codeService.js';
import { validationTool } from '../tools/validationTool.js';

const generateArchitecture = (featureName) => codeService.generateArchitecture(featureName);
const generateRequirements = (options) => codeService.generateRequirementsDocs(options);
const validateGeneratedDiff = (diff, changedFiles) =>
  validationTool.validateDiff(diff, changedFiles);

export const codeAgent = {
  generateArchitecture,
  generateRequirements,
  validateGeneratedDiff,
};
