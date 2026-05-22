import { describe, expect, it } from "vitest";
import { mapOpenCodeEvent } from "../src/domain/event-mapper.js";

describe("mapOpenCodeEvent", () => {
  it("maps question events into decision requests", () => {
    const mapped = mapOpenCodeEvent({
      type: "question.asked",
      properties: { sessionID: "ses_1", requestID: "req_1", question: "Qual abordagem?" }
    });

    expect(mapped).toMatchObject({
      type: "decision",
      sessionId: "ses_1",
      pendingRequestId: "req_1",
      pendingRequestType: "question"
    });
  });

  it("maps idle events into completed events", () => {
    expect(mapOpenCodeEvent({ type: "session.idle", properties: { sessionID: "ses_1" } })).toMatchObject({
      type: "completed",
      sessionId: "ses_1"
    });
  });

  it("maps assistant text parts into user-visible progress", () => {
    expect(mapOpenCodeEvent({
      type: "message.part.updated",
      properties: { sessionID: "ses_1", part: { type: "text", role: "assistant", text: "Resposta final" } }
    })).toMatchObject({
      type: "progress",
      sessionId: "ses_1",
      message: "Resposta final",
      visibleToUser: true
    });
  });

  it("does not echo user text parts as assistant output", () => {
    expect(mapOpenCodeEvent({
      type: "message.part.updated",
      properties: { sessionID: "ses_1", part: { type: "text", role: "user", text: "minha pergunta" } }
    })).toMatchObject({
      type: "progress",
      sessionId: "ses_1",
      visibleToUser: false
    });
  });
});
