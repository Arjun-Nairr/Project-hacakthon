import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpHermesClient, HermesRequestError } from "../src/lib/hermes-client";

const SECRET = "super-secret-token-xyz789";

function withFakeFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("HttpHermesClient sends the bearer token in the header, not the body", async () => {
  let capturedHeaders: Headers | undefined;
  let capturedBody: string | undefined;
  await withFakeFetch(
    async (_input, init) => {
      capturedHeaders = new Headers(init?.headers);
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    },
    async () => {
      const client = new HttpHermesClient("http://127.0.0.1:8642/v1", SECRET, "uae-finance");
      await client.chat([{ role: "user", content: "hi" }]);
    },
  );
  assert.equal(capturedHeaders?.get("authorization"), `Bearer ${SECRET}`);
  assert.equal(capturedBody?.includes(SECRET), false);
});

test("HttpHermesClient error messages never leak the bearer token", async () => {
  await withFakeFetch(
    async () => new Response("unauthorized", { status: 401 }),
    async () => {
      const client = new HttpHermesClient("http://127.0.0.1:8642/v1", SECRET, "uae-finance");
      await assert.rejects(
        () => client.chat([{ role: "user", content: "hi" }]),
        (error: unknown) => {
          assert.ok(error instanceof HermesRequestError);
          assert.equal(error.message.includes(SECRET), false);
          return true;
        },
      );
    },
  );
});

test("HttpHermesClient surfaces a timeout as HermesRequestError without leaking the token", async () => {
  await withFakeFetch(
    async (_input, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    },
    async () => {
      const client = new HttpHermesClient("http://127.0.0.1:8642/v1", SECRET, "uae-finance", 50);
      await assert.rejects(
        () => client.chat([{ role: "user", content: "hi" }]),
        (error: unknown) => {
          assert.ok(error instanceof HermesRequestError);
          assert.match(error.message, /timed out/i);
          assert.equal(error.message.includes(SECRET), false);
          return true;
        },
      );
    },
  );
});

test("HttpHermesClient rejects when the response has no message content", async () => {
  await withFakeFetch(
    async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    async () => {
      const client = new HttpHermesClient("http://127.0.0.1:8642/v1", SECRET, "uae-finance");
      await assert.rejects(() => client.chat([{ role: "user", content: "hi" }]), HermesRequestError);
    },
  );
});
