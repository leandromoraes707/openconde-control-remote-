import { Telegraf, type Context } from "telegraf";
import type { Authorizer } from "../auth.js";
import type { DemandManager } from "../domain/demand-manager.js";
import { renderDemandLine } from "../domain/kanban.js";

type TelegramBotOptions = {
  onUserRegistered?: (userIds: number[]) => Promise<void> | void;
};

export type StartAuthorization = {
  status: "allowed" | "registered" | "denied";
  userIds: number[];
};

export function createTelegramBot(
  token: string,
  authorizer: Authorizer,
  manager: DemandManager,
  options: TelegramBotOptions = {}
): Telegraf<Context> {
  const bot = new Telegraf(token);

  bot.start((ctx) => handleStart(ctx, authorizer, options));
  bot.command("help", (ctx) => guarded(ctx, authorizer, () => ctx.reply(helpText())));
  bot.command("ajuda", (ctx) => guarded(ctx, authorizer, () => ctx.reply(helpText())));

  const startNewConversation = (ctx: Context) => handleNewConversation(ctx, authorizer, manager);
  bot.command("new", startNewConversation);
  bot.command("clear", startNewConversation);
  bot.command("nova", startNewConversation);

  bot.command("kanban", (ctx) => guarded(ctx, authorizer, () => ctx.reply(manager.renderKanban())));

  bot.command("listar", (ctx) =>
    guarded(ctx, authorizer, () => {
      const lines = manager.listDemandCards(10).map((card) => renderDemandLine(card));
      return ctx.reply(lines.length ? lines.join("\n") : "Nenhuma demanda registrada.");
    })
  );

  bot.command("status", (ctx) =>
    guarded(ctx, authorizer, async () => {
      const id = parseDemandId(ctx);
      if (!id) {
        await ctx.reply("Use: /status <id>");
        return;
      }
      const demand = manager.getDemand(id);
      if (!demand) {
        await ctx.reply(`Demanda #${id} não encontrada.`);
        return;
      }
      await ctx.reply([
        `#${demand.id} ${demand.title}`,
        `Status: ${demand.status}`,
        `Sessão: ${demand.opencodeSessionId ?? "sem sessão"}`,
        demand.pendingRequestId ? `Pendente: ${demand.pendingRequestType} ${demand.pendingRequestId}` : "Pendente: não",
        demand.lastError ? `Erro: ${demand.lastError}` : undefined,
        `Eventos: /eventos ${demand.id}`
      ].filter((line): line is string => Boolean(line)).join("\n"));
    })
  );

  bot.command("eventos", (ctx) =>
    guarded(ctx, authorizer, async () => {
      const id = parseDemandId(ctx);
      if (!id) {
        await ctx.reply("Use: /eventos <id>");
        return;
      }
      const events = manager.listEvents(id, 30);
      if (events.length === 0) {
        await ctx.reply(`Sem eventos para #${id}.`);
        return;
      }
      await ctx.reply(events.map((event) => `${event.id}. [${event.type}] ${event.message}`).join("\n"));
    })
  );

  bot.command("responder", (ctx) =>
    guarded(ctx, authorizer, async () => {
      const parsed = parseResponder(ctx);
      if (!parsed) {
        await ctx.reply("Use: /responder <id> <texto>");
        return;
      }
      const userId = ctx.from?.id;
      if (typeof userId !== "number") return;
      const demand = await manager.respondToDemand(parsed.id, userId, parsed.message);
      await ctx.reply(`Resposta enviada para #${demand.id}.`);
    })
  );

  bot.command("cancelar", (ctx) =>
    guarded(ctx, authorizer, async () => {
      const id = parseDemandId(ctx);
      if (!id) {
        await ctx.reply("Use: /cancelar <id>");
        return;
      }
      const userId = ctx.from?.id;
      if (typeof userId !== "number") return;
      const demand = await manager.cancelDemand(id, userId);
      await ctx.reply(`#${demand.id} cancelada.`);
    })
  );

  bot.hears(/[\s\S]+/, (ctx) =>
    guarded(ctx, authorizer, async () => {
      const prompt = messageText(ctx).trim();
      if (!prompt || prompt.startsWith("/")) return;

      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      if (typeof chatId !== "number" || typeof userId !== "number") return;

      const result = await manager.handleChatMessage({ chatId, userId, prompt });
      if (result.action === "responded") {
        await ctx.reply(`Enviei sua resposta para o OpenCode na conversa #${result.demand.id}.`);
        return;
      }

      if (result.action === "continued") {
        await ctx.reply(`Enviei sua mensagem para o OpenCode na conversa #${result.demand.id}.`);
        return;
      }

      await ctx.reply(`Conversa #${result.demand.id} iniciada no OpenCode. Vou responder aqui quando o agente falar.`);
    })
  );

  bot.catch((error, ctx) => {
    const message = error instanceof Error ? error.message : String(error);
    void ctx.reply(`Erro: ${message}`);
  });

  return bot;
}

async function handleStart(ctx: Context, authorizer: Authorizer, options: TelegramBotOptions): Promise<void> {
  const userId = ctx.from?.id;
  if (typeof userId !== "number") return;
  const authorization = authorizeStartUser(authorizer, userId);
  if (authorization.status === "denied") {
    await ctx.reply("Usuário não autorizado.");
    return;
  }
  if (authorization.status === "registered") {
    await options.onUserRegistered?.(authorization.userIds);
  }
  await ctx.reply([authorization.status === "registered" ? `Usuário ${userId} autorizado neste bot.` : undefined, helpText()].filter(Boolean).join("\n\n"));
}

async function handleNewConversation(ctx: Context, authorizer: Authorizer, manager: DemandManager): Promise<void> {
  await guarded(ctx, authorizer, async () => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    if (typeof chatId !== "number" || typeof userId !== "number") return;

    const prompt = textAfterCommand(ctx);
    const demand = await manager.startNewConversation({ chatId, userId, prompt });
    const message = prompt
      ? `Conversa #${demand.id} iniciada no OpenCode. Vou responder aqui quando o agente falar.`
      : `Conversa #${demand.id} aberta no OpenCode. Envie a próxima mensagem normalmente para continuar nela.`;
    await ctx.reply(message);
  });
}

export function authorizeStartUser(authorizer: Authorizer, userId: number): StartAuthorization {
  if (authorizer.isAllowed(userId)) return { status: "allowed", userIds: authorizer.allowedUserIds() };
  if (authorizer.allowedUserIds().length > 0) return { status: "denied", userIds: authorizer.allowedUserIds() };
  authorizer.register(userId);
  return { status: "registered", userIds: authorizer.allowedUserIds() };
}

async function guarded(ctx: Context, authorizer: Authorizer, run: () => Promise<unknown> | unknown): Promise<void> {
  if (!authorizer.isAllowed(ctx.from?.id)) {
    await ctx.reply("Usuário não autorizado.");
    return;
  }
  await run();
}

function helpText(): string {
  return [
    "Telegram OpenCode Bot",
    "Envie qualquer mensagem normal para conversar com o OpenCode.",
    "Ex.: corrigir o erro X e rodar os testes",
    "O Kanban é só o gestor/auditoria das conversas em andamento.",
    "Se o OpenCode pedir algo, responda com texto normal ou use /responder <id> <texto>.",
    "/new ou /clear [mensagem] — abrir nova conversa OpenCode",
    "/nova [mensagem] — alias em português para /new",
    "/kanban — visão principal",
    "/listar — últimas demandas",
    "/status <id> — detalhes",
    "/eventos <id> — histórico",
    "/responder <id> <texto> — responder decisão/permissão",
    "/cancelar <id> — cancelar demanda"
  ].join("\n");
}

function messageText(ctx: Context): string {
  const message = ctx.message;
  if (message && "text" in message && typeof message.text === "string") return message.text;
  return "";
}

function textAfterCommand(ctx: Context): string {
  return messageText(ctx).replace(/^\/\S+\s*/, "").trim();
}

function parseDemandId(ctx: Context): number | undefined {
  const text = textAfterCommand(ctx);
  const id = Number(text.split(/\s+/)[0]);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function parseResponder(ctx: Context): { id: number; message: string } | undefined {
  const text = textAfterCommand(ctx);
  const match = /^(\d+)\s+([\s\S]+)$/.exec(text);
  if (!match) return undefined;
  const id = Number(match[1]);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  return { id, message: match[2].trim() };
}
