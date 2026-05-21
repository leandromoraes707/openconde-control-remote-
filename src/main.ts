import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createAuthorizer } from "./auth.js";
import { loadConfig } from "./config.js";
import { DemandManager } from "./domain/demand-manager.js";
import { HttpOpenCodeClient } from "./opencode/http-client.js";
import { SqliteStore } from "./store/sqlite-store.js";
import { createTelegramBot } from "./telegram/bot.js";
import { BufferedNotifier } from "./telegram/notifier.js";

export function health(): string {
  return "telegram-opencode-bot ready";
}

export async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const store = new SqliteStore(config.databasePath);
  const authorizer = createAuthorizer(config.allowedUserIds);
  const client = new HttpOpenCodeClient({ baseUrl: config.opencodeServerUrl, password: config.opencodeServerPassword });
  const manager = new DemandManager(store, client, {
    workspacePath: config.opencodeWorkspace,
    pendingResponseTimeoutMinutes: config.pendingResponseTimeoutMinutes
  });
  const bot = createTelegramBot(config.telegramBotToken, authorizer, manager);
  manager.setNotifier(
    new BufferedNotifier(async (chatId, message) => {
      await bot.telegram.sendMessage(chatId, message);
    }, {
      flushMs: config.notificationFlushMs
    })
  );

  await manager.start();
  await bot.launch();
  console.log(health());

  const shutdown = (signal: string) => {
    manager.stop();
    bot.stop(signal);
    store.close();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
