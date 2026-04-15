import { ticketService } from '../services/ticketService.js';

const createTicket = async (payload) => ticketService.createStructuredTicket(payload);
const analyzeTicket = async (taskId) => ticketService.analyzeTicket(taskId);

export const ticketAgent = {
  createTicket,
  analyzeTicket,
};
