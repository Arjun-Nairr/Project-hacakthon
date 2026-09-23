import { test } from "node:test";
import assert from "node:assert/strict";
import { hermesTransport } from "../src/features/agent/hermes-transport";
import type { AgentRequest } from "../src/features/agent/contracts";

function withFakeFetch<T>(body: unknown, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

const baseRequest: AgentRequest = {
  messages: [{ id: "m1", role: "user", content: "Can I afford this?", createdAt: new Date().toISOString() }],
  financialContext: { currency: "AED", monthLabel: "September 2026", safeToSpend: 1000, bufferTarget: 2000, tightDay: 27 },
};

test("hermesTransport forwards outcome, missingQuestion, and proposedAction from the backend response", async () => {
  const backendResponse = {
    conversationId: "conv-1",
    outcome: "proposed_action",
    message: { id: "msg-1", role: "assistant", content: "I can draft that.", createdAt: new Date().toISOString() },
    missingQuestion: null,
    proposedAction: { summary: "Add a reminder", details: "AED 500 on the 5th" },
  };

  await withFakeFetch(backendResponse, async () => {
    const result = await hermesTransport(baseRequest);
    assert.equal(result.outcome, "proposed_action");
    assert.equal(result.proposedAction?.summary, "Add a reminder");
    assert.equal(result.proposedAction?.details, "AED 500 on the 5th");
    assert.equal(result.missingQuestion, null);
  });
});

test("hermesTransport forwards a needs_input outcome with its question", async () => {
  const backendResponse = {
    conversationId: "conv-2",
    outcome: "needs_input",
    message: { id: "msg-2", role: "assistant", content: "I need one more detail.", createdAt: new Date().toISOString() },
    missingQuestion: "Cash or finance?",
    proposedAction: null,
  };

  await withFakeFetch(backendResponse, async () => {
    const result = await hermesTransport(baseRequest);
    assert.equal(result.outcome, "needs_input");
    assert.equal(result.missingQuestion, "Cash or finance?");
    assert.equal(result.proposedAction, null);
  });
});

test("hermesTransport forwards an error outcome without treating it as an answer", async () => {
  const backendResponse = {
    conversationId: "conv-3",
    outcome: "error",
    message: { id: "msg-3", role: "assistant", content: "Could not respond just now.", createdAt: new Date().toISOString() },
    missingQuestion: null,
    proposedAction: null,
  };

  await withFakeFetch(backendResponse, async () => {
    const result = await hermesTransport(baseRequest);
    assert.equal(result.outcome, "error");
  });
});
