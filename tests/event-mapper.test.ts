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
});
