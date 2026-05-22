#!/usr/bin/env node
import { spawn } from "node:child_process";

if (process.argv.includes("--help")) {
  console.log("Uso: npm start\nInicia o bot Telegram. Cada conversa usa seu proprio processo opencode run.\nNao envie no Telegram; esse comando e so do terminal.");
  process.exit(0);
}

const env = { ...process.env };
const lines = await readEnvFile(".env");
for (const [key, value] of Object.entries(lines)) {
  env[key] = value;
}

let stopping = false;
let bot;

console.log("Iniciando bot Telegram...");
bot = spawn("npm", ["run", "dev"], { stdio: "inherit", env });
console.log("Mantenha este terminal aberto. No Telegram, envie /start para o bot e depois texto normal.");

bot.on("exit", (code) => {
  if (!stopping) stopAll(code ?? 1);
});

process.once("SIGINT", () => stopAll(0));
process.once("SIGTERM", () => stopAll(0));

function stopAll(code) {
  stopping = true;
  bot?.kill("SIGTERM");
  process.exitCode = code;
}

async function readEnvFile(filePath) {
  const { existsSync, readFileSync } = await import("node:fs");
  if (!existsSync(filePath)) return {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    values[key] = unquote(raw);
  }
  return values;
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}
