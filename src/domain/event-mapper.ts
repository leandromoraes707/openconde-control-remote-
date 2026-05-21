import type { MappedOpenCodeEvent, OpenCodeEvent } from "../opencode/types.js";

export function mapOpenCodeEvent(event: OpenCodeEvent): MappedOpenCodeEvent | undefined {
  const sessionId = readString(event.properties, "sessionID") ?? readString(event.properties, "sessionId") ?? readNestedString(event.properties, "session", "id");
  const rawExcerpt = truncate(JSON.stringify(event), 900);

  if (event.type === "session.created") {
    return { type: "created", sessionId, message: "Sessão OpenCode criada.", rawExcerpt };
  }

  if (event.type === "session.status") {
    const status = readString(event.properties, "status") ?? "status atualizado";
    return {
      type: status === "idle" ? "completed" : "progress",
      sessionId,
      message: status === "idle" ? "OpenCode ficou idle." : `OpenCode status: ${status}.`,
      rawExcerpt
    };
  }

  if (event.type === "session.idle") {
    return { type: "completed", sessionId, message: "OpenCode concluiu e ficou idle.", rawExcerpt };
  }

  if (event.type === "session.error") {
    const message = readString(event.properties, "error") ?? readString(event.properties, "message") ?? "OpenCode reportou erro.";
    return { type: "error", sessionId, message, rawExcerpt };
  }

  if (event.type === "question.asked") {
    const requestId = readString(event.properties, "requestID") ?? readString(event.properties, "requestId") ?? readString(event.properties, "id");
    const question = readString(event.properties, "question") ?? readString(event.properties, "message") ?? "OpenCode precisa de uma resposta.";
    return { type: "decision", sessionId, message: question, pendingRequestId: requestId, pendingRequestType: "question", rawExcerpt };
  }

  if (event.type === "permission.asked") {
    const requestId = readString(event.properties, "requestID") ?? readString(event.properties, "requestId") ?? readString(event.properties, "id");
    const detail = readString(event.properties, "title") ?? readString(event.properties, "message") ?? "OpenCode pediu permissão.";
    return { type: "attention", sessionId, message: detail, pendingRequestId: requestId, pendingRequestType: "permission", rawExcerpt };
  }

  if (event.type === "todo.updated") {
    return { type: "progress", sessionId, message: "Lista de tarefas do OpenCode foi atualizada.", rawExcerpt };
  }

  if (event.type.includes("message") || event.type.includes("part")) {
    const text = readString(event.properties, "text") ?? readString(event.properties, "message") ?? "OpenCode gerou atualização.";
    return { type: "progress", sessionId, message: truncate(text, 240), rawExcerpt };
  }

  return undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function readNestedString(record: Record<string, unknown> | undefined, objectKey: string, valueKey: string): string | undefined {
  const nested = record?.[objectKey];
  if (typeof nested !== "object" || nested === null || Array.isArray(nested)) return undefined;
  const value = (nested as Record<string, unknown>)[valueKey];
  return typeof value === "string" ? value : undefined;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
