import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export function upsertEnvValue(filePath: string, key: string, value: string): void {
  const line = `${key}=${quoteEnv(value)}`;
  const text = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(text) ? text.replace(pattern, line) : appendLine(text, line);

  writeFileSync(filePath, next, { mode: 0o600 });
  chmodSync(filePath, 0o600);
}

function appendLine(text: string, line: string): string {
  if (!text) return `${line}\n`;
  return `${text.endsWith("\n") ? text : `${text}\n`}${line}\n`;
}

function quoteEnv(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
