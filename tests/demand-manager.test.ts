import { describe, expect, it } from "vitest";
import { DemandManager, parsePermissionResponse } from "../src/domain/demand-manager.js";
import { FakeOpenCodeClient } from "../src/opencode/fake-client.js";
import { SqliteStore } from "../src/store/sqlite-store.js";
import type { DemandNotifier } from "../src/telegram/notifier.js";

function createFixture() {
  const store = new SqliteStore(":memory:");
  const client = new FakeOpenCodeClient();
  const notifications: string[] = [];
  const notifier: DemandNotifier = {
    async notify(_chatId, message) {
      notifications.push(message);
    }
  };
  const manager = new DemandManager(store, client, { workspacePath: "/tmp/workspace", pendingResponseTimeoutMinutes: 30 }, notifier);
  return { store, client, notifications, manager };
}

describe("DemandManager", () => {
  it("creates a demand and sends prompt to OpenCode", async () => {
    const { store, client, manager } = createFixture();

    const demand = await manager.createDemand({ chatId: 10, userId: 20, prompt: "rodar testes" });

    expect(demand.status).toBe("running");
    expect(demand.opencodeSessionId).toBe("fake-session-1");
    expect(client.prompts).toEqual([{ sessionId: "fake-session-1", prompt: "rodar testes", workspacePath: "/tmp/workspace" }]);
    store.close();
  });

  it("moves a demand to waiting_user and responds to a question", async () => {
    const { store, client, manager } = createFixture();
    const demand = await manager.createDemand({ chatId: 10, userId: 20, prompt: "corrigir bug" });

    await manager.handleOpenCodeEvent({
      type: "question.asked",
      properties: { sessionID: demand.opencodeSessionId, requestID: "req_1", question: "Pode rodar teste?" }
    });

    expect(manager.getDemand(demand.id)?.status).toBe("waiting_user");

    await manager.respondToDemand(demand.id, 20, "sim");

    expect(client.questionReplies).toEqual([{ requestId: "req_1", answer: "sim" }]);
    expect(manager.getDemand(demand.id)?.status).toBe("running");
    store.close();
  });

  it("marks a demand completed on idle event", async () => {
    const { store, manager } = createFixture();
    const demand = await manager.createDemand({ chatId: 10, userId: 20, prompt: "implementar feature" });

    await manager.handleOpenCodeEvent({ type: "session.idle", properties: { sessionID: demand.opencodeSessionId } });

    expect(manager.getDemand(demand.id)?.status).toBe("completed");
    store.close();
  });

  it("parses permission reply shortcuts", () => {
    expect(parsePermissionResponse("always pode usar npm test")).toEqual({ reply: "always", message: "pode usar npm test" });
    expect(parsePermissionResponse("reject perigoso")).toEqual({ reply: "reject", message: "perigoso" });
    expect(parsePermissionResponse("rode uma vez")).toEqual({ reply: "once", message: "rode uma vez" });
  });
});
