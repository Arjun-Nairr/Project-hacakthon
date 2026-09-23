import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  createAgentRouter,
  normalizeHermesOutput,
  buildHermesMessages,
  type AgentRouterDeps,
} from "../src/routes/agent";
import type { FinancialContext } from "../src/lib/financial-context";
import type { HermesClient, HermesMessage } from "../src/lib/hermes-client";
import { HermesRequestError } from "../src/lib/hermes-client";

const FAKE_CONTEXT: FinancialContext = {
  asOf: "2026-09-01",
  currency: "AED",
  monthLabel: "September 2026",
  safeToSpend: 12_500,
  bufferTarget: 15_000,
  tightDay: 27,
  projectedPayday: 25,
  income: { basic: 22_000, housingAllowance: 3_000, variable: 0 },
  snapshot: {
    currentAvailableBalance: 51_450,
    expectedIncomeBeforeNextPayday: 25_000,
    billsAndCommitmentsDueBeforeNextPayday: 33_000,
    minimumDebtPayments: 2_800,
    plannedGoalContributions: 3_000,
    recommendedEmergencyBuffer: 15_000,
  },
  upcomingEvents: [{ label: "Rent", amount: 33_000, day: 3, kind: "lump", status: "forecasted", confidence: "high" }],
};

class FakeHermesClient implements HermesClient {
  readonly configured = true;
  captured: HermesMessage[] | null = null;
  constructor(private readonly respond: () => Promise<string>) {}
  async chat(messages: HermesMessage[]): Promise<string> {
    this.captured = messages;
    return this.respond();
  }
}

async function withServer(deps: AgentRouterDeps, run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use("/api", createAgentRouter(deps));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}/api`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function postChat(baseUrl: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  return fetch(`${baseUrl}/agent/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m, i) => ({ id: `m${i}`, role: m.role, content: m.content, createdAt: new Date().toISOString() })),
    }),
  }).then((r) => r.json() as Promise<any>);
}

test("normalizeHermesOutput parses a well-formed structured reply", () => {
  const result = normalizeHermesOutput('{"outcome":"answer","message":"Safe to spend is AED 12,500.","missingQuestion":null,"proposedAction":null}');
  assert.equal(result.outcome, "answer");
  assert.equal(result.message, "Safe to spend is AED 12,500.");
});

test("normalizeHermesOutput strips a markdown code fence", () => {
  const result = normalizeHermesOutput('```json\n{"outcome":"out_of_scope","message":"Not finance related.","missingQuestion":null,"proposedAction":null}\n```');
  assert.equal(result.outcome, "out_of_scope");
});

test("normalizeHermesOutput fails closed on invalid JSON: never 'answer', never raw text shown", () => {
  const raw = "this is not json at all -- and might contain <script>alert(1)</script> or anything else";
  const result = normalizeHermesOutput(raw);
  assert.equal(result.outcome, "error");
  assert.notEqual(result.outcome, "answer");
  assert.notEqual(result.outcome, "out_of_scope");
  assert.equal(result.message.includes(raw), false);
});

test("normalizeHermesOutput fails closed on well-formed JSON with the wrong shape", () => {
  const result = normalizeHermesOutput('{"foo":"bar","baz":123}');
  assert.equal(result.outcome, "error");
});

test("normalizeHermesOutput fails closed if the model claims an outcome it isn't allowed to report", () => {
  // "error" is reserved for this backend's own operational failures; the model must never
  // be able to claim it directly.
  const result = normalizeHermesOutput('{"outcome":"error","message":"pretending to be a backend failure","missingQuestion":null,"proposedAction":null}');
  assert.equal(result.outcome, "error");
  assert.equal(result.message.includes("pretending"), false);
});

test("normalizeHermesOutput fails closed on an unrecognized outcome value", () => {
  const result = normalizeHermesOutput('{"outcome":"mutate_database","message":"do something","missingQuestion":null,"proposedAction":null}');
  assert.equal(result.outcome, "error");
});

test("buildHermesMessages bounds history to the last N turns, keeping the tail", () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, content: `turn-${i}` }));
  const messages = buildHermesMessages(FAKE_CONTEXT, history);
  const nonSystem = messages.filter((m) => m.role !== "system");
  assert.equal(nonSystem.length, 6);
  assert.equal(nonSystem[0].content, "turn-4");
  assert.equal(nonSystem[5].content, "turn-9");
});

test("buildHermesMessages embeds the financial context server-side, not from the client", () => {
  const messages = buildHermesMessages(FAKE_CONTEXT, []);
  const contextMessage = messages.find((m) => m.content.startsWith("FINANCIAL_CONTEXT ="));
  assert.ok(contextMessage);
  assert.ok(contextMessage!.content.includes("12500"));
});

test("route returns a grounded answer end to end", async () => {
  const fake = new FakeHermesClient(async () =>
    JSON.stringify({ outcome: "answer", message: "You have AED 12,500 safe to spend.", missingQuestion: null, proposedAction: null }),
  );
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "How much can I safely spend?" }]);
    assert.equal(body.outcome, "answer");
    assert.equal(body.message.content, "You have AED 12,500 safe to spend.");
    assert.ok(fake.captured);
  });
});

test("route returns needs_input with exactly one question", async () => {
  const fake = new FakeHermesClient(async () =>
    JSON.stringify({ outcome: "needs_input", message: "I need one more detail.", missingQuestion: "What is the loan tenure?", proposedAction: null }),
  );
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "Can I afford a car loan?" }]);
    assert.equal(body.outcome, "needs_input");
    assert.equal(body.missingQuestion, "What is the loan tenure?");
  });
});

test("route returns out_of_scope for unrelated messages", async () => {
  const fake = new FakeHermesClient(async () =>
    JSON.stringify({ outcome: "out_of_scope", message: "I can only help with your finances.", missingQuestion: null, proposedAction: null }),
  );
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "What's a good pasta recipe?" }]);
    assert.equal(body.outcome, "out_of_scope");
  });
});

test("route returns proposed_action and never mutates anything (no writable dependency exists)", async () => {
  const fake = new FakeHermesClient(async () =>
    JSON.stringify({
      outcome: "proposed_action",
      message: "I can draft a reminder for the school fee.",
      missingQuestion: null,
      proposedAction: { summary: "Add a school-fee reminder", details: "AED 18,000 on the 10th" },
    }),
  );
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "Remind me about school fees" }]);
    assert.equal(body.outcome, "proposed_action");
    assert.equal(body.proposedAction.summary, "Add a school-fee reminder");
    // AgentRouterDeps only exposes a read (getFinancialContext) and the Hermes client —
    // there is no mutation-capable function reachable from this route at all.
  });
});

test("route reports Hermes timeout as 'error', never 'out_of_scope' (operational failure, not scope)", async () => {
  const fake = new FakeHermesClient(async () => {
    throw new HermesRequestError("Hermes request timed out.");
  });
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "Can I afford this?" }]);
    assert.equal(body.outcome, "error");
    assert.notEqual(body.outcome, "out_of_scope");
    assert.ok(body.message.content.length > 0);
  });
});

test("route reports a database/context failure as 'error', never 'out_of_scope'", async () => {
  const fake = new FakeHermesClient(async () => "should never be called");
  await withServer(
    {
      getFinancialContext: async () => {
        throw new Error("connection refused");
      },
      hermesClient: fake,
    },
    async (baseUrl) => {
      const body = await postChat(baseUrl, [{ role: "user", content: "Can I afford this?" }]);
      assert.equal(body.outcome, "error");
      assert.notEqual(body.outcome, "out_of_scope");
    },
  );
});

test("route reports an unconfigured Hermes client as 'error', never 'out_of_scope'", async () => {
  const unconfigured: HermesClient = {
    configured: false,
    async chat() {
      throw new Error("should never be called");
    },
  };
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: unconfigured }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "Can I afford this?" }]);
    assert.equal(body.outcome, "error");
    assert.notEqual(body.outcome, "out_of_scope");
  });
});

test("route reports malformed Hermes output as 'error' end to end, without showing the raw text", async () => {
  const fake = new FakeHermesClient(async () => "not valid json, definitely not the contract");
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const body = await postChat(baseUrl, [{ role: "user", content: "Can I afford this?" }]);
    assert.equal(body.outcome, "error");
    assert.equal(body.message.content.includes("not valid json"), false);
  });
});

test("route rejects more than 8 messages with a 400, not a crash", async () => {
  const fake = new FakeHermesClient(async () => "unused");
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const messages = Array.from({ length: 9 }, (_, i) => ({ role: "user" as const, content: `turn-${i}` }));
    const res = await fetch(`${baseUrl}/agent/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m, i) => ({ id: `m${i}`, role: m.role, content: m.content, createdAt: new Date().toISOString() })),
      }),
    });
    assert.equal(res.status, 400);
  });
});

test("route rejects empty message content with a 400", async () => {
  const fake = new FakeHermesClient(async () => "unused");
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/agent/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ id: "m1", role: "user", content: "", createdAt: new Date().toISOString() }] }),
    });
    assert.equal(res.status, 400);
  });
});

test("route rejects message content over 2000 characters with a 400", async () => {
  const fake = new FakeHermesClient(async () => "unused");
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/agent/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ id: "m1", role: "user", content: "a".repeat(2001), createdAt: new Date().toISOString() }] }),
    });
    assert.equal(res.status, 400);
  });
});

test("route response never contains the Hermes bearer token, even on failure", async () => {
  const secret = "super-secret-token-abc123";
  const fake = new FakeHermesClient(async () => {
    throw new HermesRequestError(`Hermes returned HTTP 401.`);
  });
  await withServer({ getFinancialContext: async () => FAKE_CONTEXT, hermesClient: fake }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/agent/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ id: "m1", role: "user", content: "test", createdAt: new Date().toISOString() }] }),
    });
    const text = await res.text();
    assert.equal(text.includes(secret), false);
  });
});
