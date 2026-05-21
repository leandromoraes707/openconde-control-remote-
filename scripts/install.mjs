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
const skipChecks = Boolean(args["skip-checks"]);
const rl = createInterface({ input, output });

try {
  await main();
} finally {
  rl.close();
}

async function main() {
  console.log("Setup Telegram OpenCode Bot");

  if (!dryRun && existsSync(".env")) {
    const overwrite = await ask("Já existe .env. Sobrescrever? [s/N] ");
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

  const allowedUserId = args["user-id"] || (dryRun ? "111111111" : await authorizeTelegramUser(token, botUsername));
  const envText = buildEnv({ token, allowedUserId, workspace, serverPassword });

  if (dryRun) {
    console.log("\n.env que seria gerado:");
    console.log(redactToken(envText, token));
    console.log("Dry-run concluído. Nada foi instalado nem escrito.");
    return;
  }

  writeFileSync(".env", envText, { mode: 0o600 });
  console.log(".env gerado com token, usuário autorizado e senha local do OpenCode.");

  if (!skipInstall) run("npm", ["install"]);
  checkOpenCode();

  if (!skipChecks) {
    run("npm", ["run", "typecheck"]);
    run("npm", ["test"]);
    run("npm", ["run", "qa:fake"]);
  }

  console.log("\nPronto.");
  console.log("1. Rode: npm start");
  console.log("2. No Telegram, envie: /ajuda");
  console.log("3. Crie demanda com: /nova <o que você quer que o OpenCode faça>");
}

async function authorizeTelegramUser(token, botUsername) {
  const before = await telegramApi(token, "getUpdates", { timeout: 0, limit: 100, allowed_updates: ["message"] });
  let offset = latestUpdateId(before) + 1;

  console.log(`\nAbra https://t.me/${botUsername} e envie /start para o bot.`);
  await ask("Depois de enviar /start, pressione Enter aqui. ");

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const updates = await telegramApi(token, "getUpdates", { timeout: 5, limit: 100, offset, allowed_updates: ["message"] });
    offset = Math.max(offset, latestUpdateId(updates) + 1);
    const userId = findPrivateUserId(updates);
    if (userId) {
      console.log(`Usuário autorizado: ${userId}`);
      return userId;
    }
    console.log("Aguardando mensagem /start no Telegram...");
  }

  throw new Error("Não encontrei /start do Telegram. Rode npm run setup novamente e envie /start para o bot.");
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

function buildEnv({ token, allowedUserId, workspace, serverPassword }) {
  return [
    envLine("TELEGRAM_BOT_TOKEN", token),
    envLine("TELEGRAM_ALLOWED_USER_IDS", allowedUserId),
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

function findPrivateUserId(updates) {
  for (const update of [...updates].reverse()) {
    const message = update.message;
    if (message?.chat?.type === "private" && Number.isInteger(message.from?.id)) return String(message.from.id);
  }
  return undefined;
}

function latestUpdateId(updates) {
  return updates.reduce((latest, update) => Math.max(latest, Number(update.update_id) || 0), 0);
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
  2. envia /start para o bot
  3. instalador gera .env, instala pacotes e valida QA

Opções:
  --dry-run              mostra o .env sem escrever arquivo nem chamar Telegram
  --token <token>        informa token sem prompt
  --user-id <id>         informa Telegram user id sem capturar /start
  --workspace <path>     muda OPENCODE_WORKSPACE
  --skip-install         não roda npm install
  --skip-checks          não roda typecheck/test/qa:fake
`);
}
