import { createAuthorizer } from "../auth.js";
import { DemandManager } from "../domain/demand-manager.js";
import { FakeOpenCodeClient } from "../opencode/fake-client.js";
import { SqliteStore } from "../store/sqlite-store.js";
import { BufferedNotifier } from "../telegram/notifier.js";

async function runFakeQa(): Promise<void> {
  const store = new SqliteStore(":memory:");
  const client = new FakeOpenCodeClient();
  const notifications: string[] = [];
  const manager = new DemandManager(
    store,
    client,
    { workspacePath: "/tmp/opencode-workspace", pendingResponseTimeoutMinutes: 30 },
    new BufferedNotifier(async (_chatId, message) => {
      notifications.push(message);
    }, { flushMs: 0 })
  );
  const auth = createAuthorizer([111]);

  if (!auth.isAllowed(111) || auth.isAllowed(999)) throw new Error("authorization fake QA failed");

  await manager.start();
  const demand = await manager.createDemand({ chatId: 10, userId: 111, prompt: "corrigir checkout e rodar testes" });
  if (!demand.opencodeSessionId) throw new Error("fake demand did not create session");

  client.emit({
    type: "question.asked",
    properties: {
      sessionID: demand.opencodeSessionId,
      requestID: "question-1",
      question: "Posso rodar npm test?"
    }
  });

  await manager.respondToDemand(demand.id, 111, "sim, rode os testes");
  client.emit({
    type: "message.part.updated",
    properties: {
      sessionID: demand.opencodeSessionId,
      part: { type: "text", role: "assistant", text: "Corrigi o checkout e rodei os testes." }
    }
  });

  const promptCountBeforeNewConversation = client.prompts.length;
  const newConversation = await manager.startNewConversation({ chatId: 10, userId: 111 });
  if (!newConversation.opencodeSessionId) throw new Error("blank /new conversation did not create session");
  if (client.prompts.length !== promptCountBeforeNewConversation) throw new Error("blank /new conversation sent an initial prompt");

  const continued = await manager.handleChatMessage({ chatId: 10, userId: 111, prompt: "continue nesta nova conversa" });
  const lastPrompt = client.prompts[client.prompts.length - 1];
  if (continued.action !== "continued" || continued.demand.id !== newConversation.id) {
    throw new Error("normal chat did not continue the newest /new conversation");
  }
  if (lastPrompt?.sessionId !== newConversation.opencodeSessionId || lastPrompt.prompt !== "continue nesta nova conversa") {
    throw new Error("normal chat was not sent to the blank /new OpenCode session");
  }

  client.emit({ type: "session.idle", properties: { sessionID: demand.opencodeSessionId } });

  console.log(manager.renderKanban());
  console.log("\nEventos:");
  for (const event of manager.listEvents(demand.id)) console.log(`[${event.type}] ${event.message}`);
  console.log("\nNotificações:");
  for (const notification of notifications) console.log(notification);

  const completed = manager.getDemand(demand.id);
  if (completed?.status !== "completed") throw new Error(`expected completed demand, got ${completed?.status ?? "missing"}`);
  if (!notifications.some((notification) => notification.includes("Corrigi o checkout e rodei os testes."))) {
    throw new Error("assistant response was not sent to Telegram notifications");
  }
  manager.stop();
  store.close();
}

void runFakeQa().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
