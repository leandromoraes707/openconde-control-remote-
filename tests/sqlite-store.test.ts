import { describe, expect, it } from "vitest";
import { SqliteStore } from "../src/store/sqlite-store.js";

describe("SqliteStore", () => {
  it("creates and updates a demand", () => {
    const store = new SqliteStore(":memory:");
    const demand = store.createDemand({ chatId: 10, userId: 20, prompt: "corrigir checkout", workspacePath: "/tmp/workspace" });

    expect(demand.id).toBe(1);
    expect(demand.title).toBe("corrigir checkout");
    expect(demand.status).toBe("queued");

    const updated = store.updateDemand(demand.id, { status: "running", opencodeSessionId: "ses_123" });

    expect(updated.status).toBe("running");
    expect(updated.opencodeSessionId).toBe("ses_123");
    store.close();
  });

  it("stores demand events in creation order", () => {
    const store = new SqliteStore(":memory:");
    const demand = store.createDemand({ chatId: 10, userId: 20, prompt: "rodar testes", workspacePath: "/tmp/workspace" });

    store.addEvent({ demandId: demand.id, type: "created", message: "criada" });
    store.addEvent({ demandId: demand.id, type: "started", message: "iniciada" });

    expect(store.listEvents(demand.id).map((event) => event.type)).toEqual(["created", "started"]);
    store.close();
  });
});
