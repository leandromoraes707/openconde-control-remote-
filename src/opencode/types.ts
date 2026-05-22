import type { PendingRequestType } from "../types.js";

export type PermissionReply = "once" | "always" | "reject";

export type OpenCodeSessionStatus = {
  status: "idle" | "busy" | "retry" | string;
  sessionId?: string;
};

export type OpenCodeEvent = {
  type: string;
  properties?: Record<string, unknown>;
};

export type CreateSessionInput = {
  title: string;
  workspacePath: string;
};

export type CreateSessionResult = {
  sessionId: string;
};

export type OpenCodeClient = {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  sendPrompt(sessionId: string, prompt: string, workspacePath: string): Promise<void>;
  replyToQuestion(requestId: string, answer: string): Promise<void>;
  replyToPermission(requestId: string, reply: PermissionReply, message?: string): Promise<void>;
  abortSession(sessionId: string): Promise<void>;
  getSessionStatuses(): Promise<Record<string, OpenCodeSessionStatus>>;
  subscribe(onEvent: (event: OpenCodeEvent) => void, onError: (error: Error) => void): () => void;
};

export type MappedOpenCodeEvent = {
  type: "created" | "started" | "progress" | "attention" | "decision" | "error" | "completed" | "cancelled";
  sessionId?: string;
  message: string;
  rawExcerpt?: string;
  visibleToUser?: boolean;
  pendingRequestId?: string;
  pendingRequestType?: PendingRequestType;
};
