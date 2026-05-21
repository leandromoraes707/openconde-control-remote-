import { describe, expect, it } from "vitest";
import { renderKanban } from "../src/domain/kanban.js";
import type { Demand } from "../src/types.js";

describe("renderKanban", () => {
  it("groups demand cards by lifecycle column", () => {
    const now = new Date("2026-05-21T12:00:00.000Z");
    const demand: Demand = {
      id: 1,
      chatId: 10,
      userId: 20,
      title: "corrigir checkout",
      prompt: "corrigir checkout",
      workspacePath: "/tmp/workspace",
      status: "waiting_user",
      pendingRequestId: "req_1",
      pendingRequestType: "question",
      pendingSince: "2026-05-21T11:59:00.000Z",
      lastActivityAt: "2026-05-21T11:59:00.000Z",
      createdAt: "2026-05-21T11:58:00.000Z",
      updatedAt: "2026-05-21T11:59:00.000Z"
    };

    const output = renderKanban([{ demand, lastEvent: { id: 1, demandId: 1, type: "decision", message: "Qual abordagem?", createdAt: demand.updatedAt } }], now);

    expect(output).toContain("Aguardando (1)");
    expect(output).toContain("#1 corrigir checkout");
    expect(output).toContain("/responder 1 <texto>");
  });
});
