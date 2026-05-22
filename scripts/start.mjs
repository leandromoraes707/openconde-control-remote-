#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

if (process.argv.includes("--help")) {
  console.log("Uso: npm start\nSobe opencode serve em 127.0.0.1 e depois inicia o bot Telegram. Rode no terminal; nao envie no Telegram.");
  process.exit(0);
}

const env = { ...process.env };
const lines = readFileSync(".env", "utf8").split(/\r?\n/);
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = trimmed.indexOf("=");
  if (separator < 1) continue;
  const key = trimmed.slice(0, separator).trim();
  const raw = trimmed.slice(separator + 1).trim();
  env[key] = unquote(raw);
}

const serverUrl = env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096";
let stopping = false;
let bot;
let opencode;

console.log(`Iniciando OpenCode em ${serverUrl}...`);
const parsed = new URL(serverUrl);
const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
opencode = spawn("opencode", ["serve", "--hostname", parsed.hostname || "127.0.0.1", "--port", port], { stdio: "inherit", env });

try {
  await waitForOpenCode(serverUrl, env.OPENCODE_SERVER_PASSWORD);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopAll(1);
  process.exit(1);
}

console.log("OpenCode respondeu. Iniciando bot Telegram...");
bot = spawn("npm", ["run", "dev"], { stdio: "inherit", env });
console.log("Mantenha este terminal aberto. No Telegram, envie /start para o bot e depois texto normal.");

opencode.on("exit", (code) => {
  if (!stopping) stopAll(code ?? 1);
});

bot.on("exit", (code) => {
  if (!stopping) stopAll(code ?? 1);
});

process.once("SIGINT", () => stopAll(0));
process.once("SIGTERM", () => stopAll(0));

async function waitForOpenCode(url, password) {
  const headers = new Headers();
  if (password) headers.set("authorization", `Basic ${Buffer.from(`:${password}`).toString("base64")}`);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/session/status`, { headers });
      if (response.ok) return;
    } catch { }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`OpenCode não respondeu em ${url}.`);
}

function stopAll(code) {
  stopping = true;
  opencode?.kill("SIGTERM");
  bot?.kill("SIGTERM");
  process.exitCode = code;
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}