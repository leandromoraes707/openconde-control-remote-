import type { CreateSessionInput, CreateSessionResult, OpenCodeClient, OpenCodeEvent, OpenCodeSessionStatus, PermissionReply } from "./types.js";

export class FakeOpenCodeClient implements OpenCodeClient {
  readonly prompts: Array<{ sessionId: string; prompt: string; workspacePath: string }> = [];
  readonly questionReplies: Array<{ requestId: string; answer: string }> = [];
  readonly permissionReplies: Array<{ requestId: string; reply: PermissionReply; message?: string }> = [];
  readonly abortedSessions: string[] = [];

  private nextSessionNumber = 1;
  private readonly listeners = new Set<(event: OpenCodeEvent) => void>();
  private readonly statuses = new Map<string, OpenCodeSessionStatus>();

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const sessionId = `fake-session-${this.nextSessionNumber}`;
    this.nextSessionNumber += 1;
    this.statuses.set(sessionId, { status: "busy", sessionId });
    this.emit({ type: "session.created", properties: { sessionID: sessionId, title: input.title } });
    return { sessionId };
  }

  async sendPrompt(sessionId: string, prompt: string, workspacePath: string): Promise<void> {
    this.prompts.push({ sessionId, prompt, workspacePath });
    this.statuses.set(sessionId, { status: "busy", sessionId });
    this.emit({ type: "session.status", properties: { sessionID: sessionId, status: "busy" } });
  }

  async replyToQuestion(requestId: string, answer: string): Promise<void> {
    this.questionReplies.push({ requestId, answer });
  }

  async replyToPermission(requestId: string, reply: PermissionReply, message?: string): Promise<void> {
    this.permissionReplies.push({ requestId, reply, message });
  }

  async abortSession(sessionId: string): Promise<void> {
    this.abortedSessions.push(sessionId);
    this.statuses.delete(sessionId);
    this.emit({ type: "session.error", properties: { sessionID: sessionId, error: "cancelled" } });
  }

  async getSessionStatuses(): Promise<Record<string, OpenCodeSessionStatus>> {
    return Object.fromEntries(this.statuses.entries());
  }

  subscribe(onEvent: (event: OpenCodeEvent) => void): () => void {
    this.listeners.add(onEvent);
    return () => this.listeners.delete(onEvent);
  }

  emit(event: OpenCodeEvent): void {
    const sessionId = readString(event.properties, "sessionID") ?? readString(event.properties, "sessionId");
    if (sessionId && event.type === "session.idle") this.statuses.set(sessionId, { status: "idle", sessionId });
    if (sessionId && event.type === "session.error") this.statuses.delete(sessionId);
    for (const listener of this.listeners) listener(event);
  }
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}
