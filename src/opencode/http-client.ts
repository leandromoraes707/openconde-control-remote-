import type { CreateSessionInput, CreateSessionResult, OpenCodeClient, OpenCodeEvent, OpenCodeSessionStatus, PermissionReply } from "./types.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type HttpOpenCodeClientOptions = {
  baseUrl: string;
  password?: string;
  fetchFn?: FetchLike;
  reconnectDelayMs?: number;
};

export class HttpOpenCodeClient implements OpenCodeClient {
  private readonly baseUrl: string;
  private readonly password?: string;
  private readonly fetchFn: FetchLike;
  private readonly reconnectDelayMs: number;

  constructor(options: HttpOpenCodeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.password = options.password;
    this.fetchFn = options.fetchFn ?? fetch;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const data = await this.requestJson(`/session?directory=${encodeURIComponent(input.workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({ title: input.title })
    });
    const sessionId = extractSessionId(data);
    if (!sessionId) throw new Error("OpenCode did not return a session id");
    return { sessionId };
  }

  async sendPrompt(sessionId: string, prompt: string, workspacePath: string): Promise<void> {
    await this.requestJson(`/session/${encodeURIComponent(sessionId)}/prompt_async?directory=${encodeURIComponent(workspacePath)}`, {
      method: "POST",
      body: JSON.stringify({ parts: [{ type: "text", text: prompt }] })
    });
  }

  async replyToQuestion(requestId: string, answer: string): Promise<void> {
    await this.requestJson(`/question/${encodeURIComponent(requestId)}/reply`, {
      method: "POST",
      body: JSON.stringify({ answers: [[answer]] })
    });
  }

  async replyToPermission(requestId: string, reply: PermissionReply, message?: string): Promise<void> {
    await this.requestJson(`/permission/${encodeURIComponent(requestId)}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply, message })
    });
  }

  async abortSession(sessionId: string): Promise<void> {
    await this.requestJson(`/session/${encodeURIComponent(sessionId)}/abort`, { method: "POST" });
  }

  async getSessionStatuses(): Promise<Record<string, OpenCodeSessionStatus>> {
    const data = await this.requestJson("/session/status", { method: "GET" });
    if (!isRecord(data)) return {};

    const statuses: Record<string, OpenCodeSessionStatus> = {};
    for (const [sessionId, value] of Object.entries(data)) {
      if (typeof value === "string") statuses[sessionId] = { status: value, sessionId };
      if (isRecord(value)) {
        const status = readString(value, "status") ?? "unknown";
        statuses[sessionId] = { status, sessionId };
      }
    }
    return statuses;
  }

  subscribe(onEvent: (event: OpenCodeEvent) => void, onError: (error: Error) => void): () => void {
    const controller = new AbortController();
    void this.streamWithReconnect(controller, onEvent, onError);
    return () => controller.abort();
  }

  private async streamWithReconnect(controller: AbortController, onEvent: (event: OpenCodeEvent) => void, onError: (error: Error) => void): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        await this.readEventStream(controller.signal, onEvent);
      } catch (error) {
        if (!controller.signal.aborted) onError(toError(error));
      }

      if (!controller.signal.aborted) await delay(this.reconnectDelayMs);
    }
  }

  private async readEventStream(signal: AbortSignal, onEvent: (event: OpenCodeEvent) => void): Promise<void> {
    const response = await this.requestRaw("/event", { method: "GET", signal });
    if (!response.body) throw new Error("OpenCode event stream returned no body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseSseBlock(block);
        if (event) onEvent(event);
        boundary = buffer.indexOf("\n\n");
      }
    }
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.requestRaw(path, init);
    if (response.status === 204) return undefined;
    return response.json() as Promise<unknown>;
  }

  private async requestRaw(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    if (this.password) headers.set("authorization", `Basic ${Buffer.from(`:${this.password}`).toString("base64")}`);

    const response = await this.fetchFn(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenCode ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
    }
    return response;
  }
}

function parseSseBlock(block: string): OpenCodeEvent | undefined {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) return undefined;

  const parsed = JSON.parse(dataLines.join("\n")) as unknown;
  if (!isRecord(parsed)) return undefined;
  const type = readString(parsed, "type");
  if (!type) return undefined;
  const properties = isRecord(parsed.properties) ? parsed.properties : undefined;
  return { type, properties };
}

function extractSessionId(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  return readString(data, "id") ?? readString(data, "ID") ?? readString(data, "sessionID") ?? readString(data, "sessionId");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
