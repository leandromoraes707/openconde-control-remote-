import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createAuthorizer } from "./auth.js";
import { loadConfig } from "./config.js";
import { DemandManager } from "./domain/demand-manager.js";
import { upsertEnvValue } from "./env-file.js";
import { PtyOpenCodeClient } from "./opencode/pty-client.js";
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
  const client = new PtyOpenCodeClient(config.opencodeWorkspace);
  const manager = new DemandManager(store, client, {
    workspacePath: config.opencodeWorkspace,
    pendingResponseTimeoutMinutes: config.pendingResponseTimeoutMinutes
  });
  const bot = createTelegramBot(config.telegramBotToken, authorizer, manager, {
    onUserRegistered(userIds) {
      upsertEnvValue(".env", "TELEGRAM_ALLOWED_USER_IDS", userIds.join(","));
      console.log(`telegram user autorizado e persistido: ${userIds.join(",")}`);
    }
  });
  manager.setNotifier(
    new BufferedNotifier(async (chatId, message) => {
      await bot.telegram.sendMessage(chatId, message);
    }, {
      flushMs: config.notificationFlushMs
    })
  );

  await manager.start();
  const botInfo = await bot.telegram.getMe();
  await bot.launch({ dropPendingUpdates: false });
  console.log(`${health()} - @${botInfo.username} https://t.me/${botInfo.username}`);

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
