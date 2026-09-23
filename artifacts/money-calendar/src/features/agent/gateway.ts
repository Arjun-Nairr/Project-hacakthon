import type { AgentGateway, AgentRequest, AgentResponse } from './contracts';

export type AgentTransport = (
  request: AgentRequest,
  signal?: AbortSignal,
) => Promise<AgentResponse>;

export class AgentNotConfiguredError extends Error {
  constructor() {
    super('The Bayzati agent integration is not configured.');
    this.name = 'AgentNotConfiguredError';
  }
}

export function createAgentGateway(transport: AgentTransport): AgentGateway {
  return {
    configured: true,
    send: transport,
  };
}

export const unconfiguredAgentGateway: AgentGateway = {
  configured: false,
  async send() {
    throw new AgentNotConfiguredError();
  },
};