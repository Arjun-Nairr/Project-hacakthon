export type AgentMessageRole = 'user' | 'assistant';

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
}

export interface AgentFinancialContext {
  currency: 'AED';
  monthLabel: string;
  safeToSpend: number;
  bufferTarget: number;
  tightDay: number;
}

export interface AgentRequest {
  conversationId?: string;
  messages: AgentMessage[];
  financialContext: AgentFinancialContext;
}

export interface AgentResponse {
  conversationId: string;
  message: AgentMessage;
}

export interface AgentGateway {
  readonly configured: boolean;
  send(request: AgentRequest, signal?: AbortSignal): Promise<AgentResponse>;
}