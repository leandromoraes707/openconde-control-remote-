import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertEnvValue } from "../src/env-file.js";

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("upsertEnvValue", () => {
  it("updates an existing env key without touching other lines", () => {
    const path = tempEnvPath();
    writeFileSync(path, 'TELEGRAM_BOT_TOKEN="secret"\nTELEGRAM_ALLOWED_USER_IDS=""\nDATABASE_PATH="./bot.sqlite"\n');

    upsertEnvValue(path, "TELEGRAM_ALLOWED_USER_IDS", "111,222");

    expect(readFileSync(path, "utf8")).toBe(
      'TELEGRAM_BOT_TOKEN="secret"\nTELEGRAM_ALLOWED_USER_IDS="111,222"\nDATABASE_PATH="./bot.sqlite"\n'
    );
  });

  it("creates a private env file when missing", () => {
    const path = tempEnvPath();

    upsertEnvValue(path, "TELEGRAM_ALLOWED_USER_IDS", "111");

    expect(readFileSync(path, "utf8")).toBe('TELEGRAM_ALLOWED_USER_IDS="111"\n');
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});

function tempEnvPath(): string {
  tempDir = mkdtempSync(join(tmpdir(), "telegram-opencode-env-"));
  return join(tempDir, ".env");
}
