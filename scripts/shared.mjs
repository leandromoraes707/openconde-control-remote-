import { existsSync, readFileSync } from "node:fs";

export function loadEnvFile(filePath = ".env") {
  if (!existsSync(filePath)) return {};

  const values = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    values[key] = unquoteEnvValue(value);
  }
  return values;
}

export function loadRuntimeEnv() {
  return { ...process.env, ...loadEnvFile(".env") };
}

export function opencodeServeArgs(env) {
  const serverUrl = env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096";
  const parsed = new URL(serverUrl);
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  return ["serve", "--hostname", parsed.hostname || "127.0.0.1", "--port", port];
}

function unquoteEnvValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}
