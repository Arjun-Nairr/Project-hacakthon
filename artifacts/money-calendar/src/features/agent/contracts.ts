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

export type AgentOutcome = 'answer' | 'needs_input' | 'out_of_scope' | 'proposed_action' | 'error';

export interface AgentProposedAction {
  summary: string;
  details: string | null;
}

export interface AgentResponse {
  conversationId: string;
  outcome: AgentOutcome;
  message: AgentMessage;
  missingQuestion: string | null;
  proposedAction: AgentProposedAction | null;
}

export interface AgentGateway {
  readonly configured: boolean;
  send(request: AgentRequest, signal?: AbortSignal): Promise<AgentResponse>;
}
