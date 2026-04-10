import { ticketTool } from '../tools/ticketTool.js';
import productOwnerAgent from '../agents/product-owner-agent.js';

const createStructuredTicket = async (payload) => {
  if (!payload?.title) {
    throw new Error('title is required');
  }
  return ticketTool.create(payload);
};

const analyzeTicket = async (taskId) => productOwnerAgent.analyzeTask(taskId);

export const ticketService = {
  createStructuredTicket,
  analyzeTicket,
};
