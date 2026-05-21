import { describe, expect, it } from "vitest";
import { BufferedNotifier, compactTelegramMessage } from "../src/telegram/notifier.js";

describe("BufferedNotifier", () => {
  it("buffers and flushes messages", async () => {
    const sent: string[] = [];
    const notifier = new BufferedNotifier(async (_chatId, message) => {
      sent.push(message);
    }, { flushMs: 0 });

    await notifier.notify(1, "um");
    await notifier.notify(1, "dois");

    expect(sent).toEqual(["um", "dois"]);
  });

  it("truncates long Telegram messages", () => {
    const message = compactTelegramMessage("x".repeat(5000), 100);

    expect(message.length).toBeLessThanOrEqual(100);
    expect(message).toContain("Mensagem truncada");
  });
});
