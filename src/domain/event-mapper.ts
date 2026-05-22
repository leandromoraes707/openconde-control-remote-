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
    const text = extractAssistantText(event.properties);
    return {
      type: "progress",
      sessionId,
      message: text ? truncate(text, 3900) : "OpenCode gerou atualização.",
      rawExcerpt,
      visibleToUser: Boolean(text)
    };
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

function extractAssistantText(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) return undefined;

  const role = findStringByKey(record, new Set(["role", "author"]));
  if (role && !["assistant", "agent", "opencode"].includes(role.toLowerCase())) return undefined;

  return cleanText(findText(record));
}

function findStringByKey(value: unknown, keys: Set<string>): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys);
      if (found) return found;
    }
    return undefined;
  }

  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key) && typeof item === "string") return item;
    const found = findStringByKey(item, keys);
    if (found) return found;
  }

  return undefined;
}

function findText(value: unknown, key?: string): string | undefined {
  if (typeof value === "string") {
    return key && ["text", "message", "content", "value", "delta", "output"].includes(key) ? value : undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => findText(item)).filter((text): text is string => Boolean(text)).join("\n") || undefined;
  }

  if (typeof value !== "object" || value === null) return undefined;

  const record = value as Record<string, unknown>;
  for (const preferred of ["text", "message", "content", "value", "delta", "output"]) {
    const found = findText(record[preferred], preferred);
    if (found) return found;
  }

  for (const [childKey, childValue] of Object.entries(record)) {
    const found = findText(childValue, childKey);
    if (found) return found;
  }

  return undefined;
}

function cleanText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/<dcp-message-id>[^<]*<\/dcp-message-id>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
  return cleaned || undefined;
}

function truncate(value: string, maxLength: number): string {
  const stripped = value.replace(/<dcp-message-id>[^<]*<\/dcp-message-id>/gi, "");
  return stripped.length <= maxLength ? stripped : `${stripped.slice(0, maxLength - 3)}...`;
}
