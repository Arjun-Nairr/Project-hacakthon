export type HermesMessage = { role: "system" | "user" | "assistant"; content: string };

export interface HermesClient {
  readonly configured: boolean;
  chat(messages: HermesMessage[]): Promise<string>;
}

export class HermesNotConfiguredError extends Error {
  constructor() {
    super("HERMES_BASE_URL is not configured.");
    this.name = "HermesNotConfiguredError";
  }
}

export class HermesRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HermesRequestError";
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export class HttpHermesClient implements HermesClient {
  readonly configured = true;

  constructor(
    private readonly baseUrl: string,
    private readonly apiToken: string,
    private readonly model: string,
    private readonly timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ) {}

  async chat(messages: HermesMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
        signal: controller.signal,
      });
    } catch (cause) {
      throw new HermesRequestError(
        cause instanceof Error && cause.name === "AbortError"
          ? "Hermes request timed out."
          : "Hermes request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new HermesRequestError(`Hermes returned HTTP ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new HermesRequestError("Hermes response had no message content.");
    }
    return content;
  }
}

class UnconfiguredHermesClient implements HermesClient {
  readonly configured = false;

  async chat(): Promise<string> {
    throw new HermesNotConfiguredError();
  }
}

export function createHermesClient(): HermesClient {
  const baseUrl = process.env.HERMES_BASE_URL;
  const apiToken = process.env.HERMES_API_TOKEN;
  if (!baseUrl) return new UnconfiguredHermesClient();
  return new HttpHermesClient(baseUrl, apiToken ?? "", "uae-finance");
}
