import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CircleHelp, Loader2, MessageCircle, Send, TriangleAlert } from 'lucide-react';
import { Link } from 'wouter';
import { getGetMoneyCalendarQueryKey, useGetMoneyCalendar } from '@workspace/api-client-react';
import { createAgentGateway, type AgentMessage, type AgentOutcome, type AgentProposedAction } from '@/features/agent';
import { hermesTransport } from '@/features/agent/hermes-transport';

const gateway = createAgentGateway(hermesTransport);

type ChatEntry = AgentMessage & {
  outcome?: AgentOutcome;
  missingQuestion?: string | null;
  proposedAction?: AgentProposedAction | null;
};

function newMessage(role: AgentMessage['role'], content: string): ChatEntry {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() };
}

export default function ChatPage() {
  const { data: calendar } = useGetMoneyCalendar({ query: { queryKey: getGetMoneyCalendarQueryKey() } });
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [transportError, setTransportError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending || !calendar) return;

    const nextMessages = [...messages, newMessage('user', text)];
    setMessages(nextMessages);
    setInput('');
    setTransportError(undefined);
    setSending(true);
    try {
      const response = await gateway.send({
        conversationId,
        messages: nextMessages,
        financialContext: {
          currency: 'AED',
          monthLabel: calendar.monthLabel,
          safeToSpend: calendar.safeToSpend,
          bufferTarget: calendar.bufferTarget,
          tightDay: calendar.tightDay,
        },
      });
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          ...response.message,
          outcome: response.outcome,
          missingQuestion: response.missingQuestion,
          proposedAction: response.proposedAction,
        },
      ]);
    } catch {
      setTransportError('The finance assistant could not respond just now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="reveal flex items-center gap-3">
        <Link href="/" className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-primary" data-testid="link-back-calendar">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="font-mono-data text-[10px] uppercase tracking-[.16em] text-muted-foreground">Ask about your money</p>
          <h1 className="font-display text-4xl leading-none text-primary md:text-5xl">Chat</h1>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6" data-testid="section-chat">
        <div className="min-h-[240px] space-y-3" data-testid="list-chat-messages">
          {messages.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="size-4 text-primary" />
              Ask something grounded in your calendar — like "How much can I safely spend this week?"
            </p>
          )}
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-chat-loading">
              <Loader2 className="size-3.5 animate-spin" /> Thinking…
            </div>
          )}
          {transportError && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="status-chat-error">
              <TriangleAlert className="size-3.5" /> {transportError}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="mt-5 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={calendar ? 'Ask about your money…' : 'Loading your calendar…'}
            disabled={!calendar || sending}
            maxLength={2000}
            className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none ring-primary/30 transition focus:ring-4"
            data-testid="input-chat-message"
          />
          <button
            type="submit"
            disabled={!calendar || sending || !input.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            data-testid="button-chat-send"
          >
            <Send className="size-4" />
          </button>
        </form>
      </section>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatEntry }) {
  if (message.role === 'user') {
    return (
      <div className="ml-auto max-w-[85%] rounded-xl bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground" data-testid={`message-user-${message.id}`}>
        {message.content}
      </div>
    );
  }

  if (message.outcome === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm leading-6 text-destructive" data-testid={`message-error-${message.id}`}>
        <TriangleAlert className="size-3.5 shrink-0" /> {message.content}
      </div>
    );
  }

  if (message.outcome === 'proposed_action' && message.proposedAction) {
    return (
      <div className="max-w-[85%] rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-6" data-testid={`message-proposed-action-${message.id}`}>
        <p className="font-mono-data text-[10px] uppercase tracking-[.14em] text-primary">Draft — nothing has changed yet</p>
        <p className="mt-1.5 font-semibold text-foreground">{message.proposedAction.summary}</p>
        {message.proposedAction.details && <p className="mt-1 text-xs text-muted-foreground">{message.proposedAction.details}</p>}
      </div>
    );
  }

  if (message.outcome === 'needs_input' && message.missingQuestion) {
    return (
      <div className="max-w-[85%] rounded-xl bg-secondary px-4 py-2.5 text-sm leading-6 text-secondary-foreground" data-testid={`message-needs-input-${message.id}`}>
        <p className="flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-[.14em] text-muted-foreground">
          <CircleHelp className="size-3.5" /> One more detail needed
        </p>
        <p className="mt-1">{message.missingQuestion}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] rounded-xl bg-secondary px-4 py-2.5 text-sm leading-6 text-secondary-foreground" data-testid={`message-assistant-${message.id}`}>
      {message.content}
    </div>
  );
}
