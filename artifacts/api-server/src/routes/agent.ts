import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { ZodError } from "zod";
import { PostAgentChatBody, PostAgentChatResponse } from "@workspace/api-zod";
import { getFinancialContext, type FinancialContext } from "../lib/financial-context";
import { createHermesClient, type HermesClient, type HermesMessage } from "../lib/hermes-client";
import { logger } from "../lib/logger";

const MAX_HISTORY_MESSAGES = 6;
const OUTCOMES = ["answer", "needs_input", "out_of_scope", "proposed_action", "error"] as const;
type Outcome = (typeof OUTCOMES)[number];

const SAFE_OPERATIONAL_FAILURE_MESSAGE = "The finance assistant could not respond just now. Please try again.";
const NOT_CONFIGURED_MESSAGE = "The finance assistant is not connected yet.";
const MALFORMED_OUTPUT_MESSAGE = "The finance assistant returned something we couldn't safely show. Please try again.";

const SCOPE_AND_CONTRACT = `You are a read-only financial explainer for a UAE personal-finance app.

Rules:
- You never calculate, estimate, or infer numbers. Every figure you state must come verbatim from FINANCIAL_CONTEXT below.
- Never invent missing records or infer recurring commitments from one month of data.
- If the message is unrelated to this household's finances, use outcome "out_of_scope".
- If you need exactly one more piece of information the context does not contain, use outcome "needs_input" and ask that one question in "missingQuestion".
- If the user asks you to change, add, or schedule something, use outcome "proposed_action" and describe what would change in "proposedAction" — you never make the change yourself.
- Otherwise use outcome "answer".

Respond with ONLY a single JSON object, no prose outside it, matching exactly:
{"outcome": "answer" | "needs_input" | "out_of_scope" | "proposed_action", "message": string, "missingQuestion": string | null, "proposedAction": {"summary": string, "details": string | null} | null}`;

type NormalizedOutcome = {
  outcome: Outcome;
  message: string;
  missingQuestion: string | null;
  proposedAction: { summary: string; details: string | null } | null;
};

// Hermes may only ever report these outcomes itself; "error" is reserved for
// this backend's own operational failures (unreachable, timeout, malformed
// output) and must never be a value the model can claim for itself.
const MODEL_REPORTABLE_OUTCOMES = ["answer", "needs_input", "out_of_scope", "proposed_action"] as const;

function malformedOutputFallback(): NormalizedOutcome {
  return { outcome: "error", message: MALFORMED_OUTPUT_MESSAGE, missingQuestion: null, proposedAction: null };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/** Fails closed: any output that isn't valid, well-formed structured JSON becomes a
 * safe "error" outcome. Raw model text is never shown to the user, and malformed
 * output is never classified as "answer" or "out_of_scope". */
export function normalizeHermesOutput(raw: string): NormalizedOutcome {
  let parsed: Partial<NormalizedOutcome>;
  try {
    parsed = JSON.parse(stripCodeFence(raw)) as Partial<NormalizedOutcome>;
  } catch {
    return malformedOutputFallback();
  }

  if (
    typeof parsed.outcome !== "string" ||
    !(MODEL_REPORTABLE_OUTCOMES as readonly string[]).includes(parsed.outcome) ||
    typeof parsed.message !== "string" ||
    parsed.message.trim() === ""
  ) {
    return malformedOutputFallback();
  }

  return {
    outcome: parsed.outcome as Outcome,
    message: parsed.message,
    missingQuestion: typeof parsed.missingQuestion === "string" ? parsed.missingQuestion : null,
    proposedAction:
      parsed.proposedAction && typeof parsed.proposedAction.summary === "string"
        ? {
            summary: parsed.proposedAction.summary,
            details: typeof parsed.proposedAction.details === "string" ? parsed.proposedAction.details : null,
          }
        : null,
  };
}

export function buildHermesMessages(
  context: FinancialContext,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): HermesMessage[] {
  const bounded = history.slice(-MAX_HISTORY_MESSAGES);
  return [
    { role: "system", content: SCOPE_AND_CONTRACT },
    { role: "system", content: `FINANCIAL_CONTEXT = ${JSON.stringify(context)}` },
    ...bounded,
  ];
}

function operationalFailure(conversationId: string, message: string) {
  return PostAgentChatResponse.parse({
    conversationId,
    outcome: "error",
    message: { id: randomUUID(), role: "assistant", content: message, createdAt: new Date().toISOString() },
    missingQuestion: null,
    proposedAction: null,
  });
}

export type AgentRouterDeps = {
  getFinancialContext: () => Promise<FinancialContext>;
  hermesClient: HermesClient;
};

export function createAgentRouter(deps: AgentRouterDeps): IRouter {
  const router: IRouter = Router();

  router.post("/agent/chat", async (req, res): Promise<void> => {
    let input: ReturnType<typeof PostAgentChatBody.parse>;
    try {
      input = PostAgentChatBody.parse(req.body);
    } catch (error) {
      const message = error instanceof ZodError ? error.issues.map((issue) => issue.message).join("; ") : "Invalid request.";
      res.status(400).json({ error: message });
      return;
    }

    const conversationId = input.conversationId ?? randomUUID();

    if (!deps.hermesClient.configured) {
      res.json(operationalFailure(conversationId, NOT_CONFIGURED_MESSAGE));
      return;
    }

    const history = input.messages.map((message) => ({ role: message.role, content: message.content }));

    try {
      const context = await deps.getFinancialContext();
      const raw = await deps.hermesClient.chat(buildHermesMessages(context, history));
      const normalized = normalizeHermesOutput(raw);

      res.json(
        PostAgentChatResponse.parse({
          conversationId,
          outcome: normalized.outcome,
          message: {
            id: randomUUID(),
            role: "assistant",
            content: normalized.message,
            createdAt: new Date().toISOString(),
          },
          missingQuestion: normalized.missingQuestion,
          proposedAction: normalized.proposedAction,
        }),
      );
    } catch (error) {
      logger.error({ err: error instanceof Error ? error.message : "unknown" }, "agent chat failed");
      res.json(operationalFailure(conversationId, SAFE_OPERATIONAL_FAILURE_MESSAGE));
    }
  });

  return router;
}

const router: IRouter = createAgentRouter({
  getFinancialContext,
  hermesClient: createHermesClient(),
});

export default router;
