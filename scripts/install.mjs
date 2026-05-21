#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const dryRun = Boolean(args["dry-run"]);
const skipInstall = Boolean(args["skip-install"]);
const skipChecks = !Boolean(args["checks"]);
const rl = createInterface({ input, output });

try {
  await main();
} finally {
  rl.close();
}

async function main() {
  console.log("Setup Telegram OpenCode Bot");

  if (!dryRun && existsSync(".env")) {
    const overwrite = await ask("Ja existe .env. Sobrescrever? [s/N] ");
    if (!/^s(im)?$/i.test(overwrite)) {
      console.log("Setup cancelado. .env preservado.");
      return;
    }
  }

  const token = args.token || await askRequired("Cole o token do BotFather: ");
  const workspace = args.workspace || process.cwd();
  const serverPassword = args["server-password"] || randomBytes(24).toString("hex");

  let botUsername = args["bot-username"] || "seu_bot";
  if (!dryRun) {
    const bot = await verifyTelegramToken(token);
    botUsername = bot.username;
    await telegramApi(token, "deleteWebhook", { drop_pending_updates: false });
    console.log(`Token validado: @${botUsername}`);
  }

  const envText = buildEnv({ token, workspace, serverPassword });

  if (dryRun) {
    console.log("\n.env que seria gerado:");
    console.log(redactToken(envText, token));
    console.log("Dry-run concluido. Nada foi instalado nem escrito.");
    return;
  }

  writeFileSync(".env", envText, { mode: 0o600 });
  console.log(".env gerado com token e senha local do OpenCode.");

  if (!skipInstall) run("npm", ["install"]);
  checkOpenCode();

  if (!skipChecks) {
    run("npm", ["run", "typecheck"]);
    run("npm", ["test"]);
    run("npm", ["run", "qa:fake"]);
  }

  console.log("\nPronto.");
  console.log("1. Rode: npm start");
  console.log("2. No Telegram, envie /start para o bot (isso registra voce como usuario autorizado)");
  console.log("3. Crie demanda com: /nova <o que voce quer que o OpenCode faca>");
}

async function verifyTelegramToken(token) {
  const result = await telegramApi(token, "getMe");
  if (!result?.username) throw new Error("Token validou, mas Telegram não retornou username do bot.");
  return result;
}

async function telegramApi(token, method, body) {
  const init = body ? {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  } : undefined;
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, init);
  const data = await response.json().catch(() => undefined);
  if (!response.ok || !data?.ok) {
    const description = data?.description || `${response.status} ${response.statusText}`;
    throw new Error(`Telegram ${method} falhou: ${description}`);
  }
  return data.result;
}

function buildEnv({ token, workspace, serverPassword }) {
  return [
    envLine("TELEGRAM_BOT_TOKEN", token),
    envLine("TELEGRAM_ALLOWED_USER_IDS", ""),
    envLine("OPENCODE_WORKSPACE", workspace),
    envLine("OPENCODE_SERVER_URL", "http://127.0.0.1:4096"),
    envLine("OPENCODE_SERVER_PASSWORD", serverPassword),
    envLine("DATABASE_PATH", "./telegram-opencode.sqlite"),
    envLine("PENDING_RESPONSE_TIMEOUT_MINUTES", "30"),
    envLine("NOTIFICATION_FLUSH_MS", "2500")
  ].join("");
}

function envLine(key, value) {
  return `${key}=${quoteEnv(String(value))}\n`;
}

function quoteEnv(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} falhou.`);
}

function checkOpenCode() {
  const result = spawnSync("opencode", ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.log("Aviso: não encontrei opencode no PATH. Instale/ative o OpenCode antes de rodar npm start.");
    return;
  }
  console.log(`OpenCode encontrado: ${result.stdout.trim()}`);
}

async function askRequired(question) {
  const answer = await ask(question);
  if (!answer) throw new Error("Valor obrigatório não informado.");
  return answer;
}

async function ask(question) {
  return (await rl.question(question)).trim();
}

function redactToken(text, token) {
  return text.replaceAll(token, token.length > 10 ? `${token.slice(0, 6)}...${token.slice(-4)}` : "***");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Uso: npm run setup

Fluxo interativo:
  1. cola token do BotFather
  2. instalador gera .env e instala pacotes
  3. rode npm start e envie /start no Telegram para se registrar

Opcoes:
  --dry-run              mostra o .env sem escrever arquivo
  --token <token>        informa token sem prompt
  --workspace <path>     muda OPENCODE_WORKSPACE
  --skip-install         nao roda npm install
  --checks               roda typecheck/test/qa:fake (desligado por padrao)
`);
}
