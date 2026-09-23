import { postAgentChat } from '@workspace/api-client-react';
import type { AgentRequest, AgentResponse } from './contracts';
import type { AgentTransport } from './gateway';

export const hermesTransport: AgentTransport = async (request, signal) => {
  const response = await postAgentChat(
    {
      conversationId: request.conversationId,
      messages: request.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    },
    { signal },
  );

  const result: AgentResponse = {
    conversationId: response.conversationId,
    outcome: response.outcome,
    message: {
      id: response.message.id,
      role: 'assistant',
      content: response.message.content,
      createdAt: response.message.createdAt,
    },
    missingQuestion: response.missingQuestion,
    proposedAction: response.proposedAction
      ? { summary: response.proposedAction.summary, details: response.proposedAction.details ?? null }
      : null,
  };
  return result;
};
