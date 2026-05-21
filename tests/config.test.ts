import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("parses required environment variables", () => {
    const config = loadConfig({
      TELEGRAM_BOT_TOKEN: "123456789:example-token",
      TELEGRAM_ALLOWED_USER_IDS: "111,222",
      OPENCODE_WORKSPACE: "/tmp/workspace",
      OPENCODE_SERVER_URL: "http://127.0.0.1:4096",
      DATABASE_PATH: "./bot.sqlite",
      PENDING_RESPONSE_TIMEOUT_MINUTES: "45",
      NOTIFICATION_FLUSH_MS: "10"
    });

    expect(config.telegramBotToken).toBe("123456789:example-token");
    expect(config.allowedUserIds).toEqual([111, 222]);
    expect(config.opencodeWorkspace).toBe("/tmp/workspace");
    expect(config.opencodeServerUrl).toBe("http://127.0.0.1:4096");
    expect(config.databasePath).toBe("./bot.sqlite");
    expect(config.pendingResponseTimeoutMinutes).toBe(45);
    expect(config.notificationFlushMs).toBe(10);
  });

  it("rejects missing allowlist", () => {
    expect(() =>
      loadConfig({
        TELEGRAM_BOT_TOKEN: "123456789:example-token",
        TELEGRAM_ALLOWED_USER_IDS: "",
        OPENCODE_WORKSPACE: "/tmp/workspace"
      })
    ).toThrow("TELEGRAM_ALLOWED_USER_IDS");
  });
});
