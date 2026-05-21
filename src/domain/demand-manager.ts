import { renderKanban, type KanbanCard } from "./kanban.js";
import { mapOpenCodeEvent } from "./event-mapper.js";
import type { OpenCodeClient, OpenCodeEvent, PermissionReply } from "../opencode/types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import type { Demand, DemandEvent, DemandStatus } from "../types.js";
import type { DemandNotifier } from "../telegram/notifier.js";

type DemandManagerOptions = {
  workspacePath: string;
  pendingResponseTimeoutMinutes: number;
};

type CreateDemandInput = {
  chatId: number;
  userId: number;
  prompt: string;
};

const TERMINAL_STATUSES: DemandStatus[] = ["completed", "failed", "cancelled"];

export class DemandManager {
  private notifier?: DemandNotifier;
  private unsubscribe?: () => void;

  constructor(
    private readonly store: SqliteStore,
    private readonly client: OpenCodeClient,
    private readonly options: DemandManagerOptions,
    notifier?: DemandNotifier
  ) {
    this.notifier = notifier;
  }

  setNotifier(notifier: DemandNotifier): void {
    this.notifier = notifier;
  }

  async start(): Promise<void> {
    await this.bootRecovery();
    this.unsubscribe = this.client.subscribe(
      (event) => {
        void this.handleOpenCodeEvent(event).catch((error: unknown) => this.recordStreamError(toError(error)));
      },
      (error) => {
        void this.handleStreamError(error);
      }
    );
  }

  stop(): void {
    this.unsubscribe?.();
  }

  async createDemand(input: CreateDemandInput): Promise<Demand> {
    const active = this.store.findActiveDemandForUser(input.userId);
    if (active) {
      throw new Error(`Você já tem uma demanda ativa (#${active.id}). Use /status ${active.id} ou /cancelar ${active.id}.`);
    }

    const demand = this.store.createDemand({
      chatId: input.chatId,
      userId: input.userId,
      prompt: input.prompt,
      workspacePath: this.options.workspacePath
    });
    this.store.addEvent({ demandId: demand.id, type: "created", message: "Demanda criada no Telegram." });

    try {
      const session = await this.client.createSession({ title: demand.title, workspacePath: demand.workspacePath });
      const running = this.store.updateDemand(demand.id, {
        status: "running",
        opencodeSessionId: session.sessionId,
        lastActivityAt: new Date().toISOString()
      });
      this.store.addEvent({ demandId: demand.id, type: "started", message: `Sessão OpenCode ${session.sessionId} iniciada.` });
      await this.client.sendPrompt(session.sessionId, input.prompt, demand.workspacePath);
      await this.notify(running.chatId, `#${running.id} em execução. Veja /kanban ou /status ${running.id}.`);
      return running;
    } catch (error) {
      const message = toError(error).message;
      const failed = this.store.updateDemand(demand.id, {
        status: "failed",
        lastError: message,
        finishedAt: new Date().toISOString()
      });
      this.store.addEvent({ demandId: demand.id, type: "error", message, rawExcerpt: message });
      await this.notify(failed.chatId, `#${failed.id} falhou ao iniciar: ${message}`);
      return failed;
    }
  }

  async handleOpenCodeEvent(event: OpenCodeEvent): Promise<void> {
    const mapped = mapOpenCodeEvent(event);
    if (!mapped?.sessionId) return;

    const demand = this.store.findDemandBySession(mapped.sessionId);
    if (!demand || TERMINAL_STATUSES.includes(demand.status)) return;

    const now = new Date().toISOString();

    if ((mapped.type === "decision" || mapped.type === "attention") && mapped.pendingRequestId && mapped.pendingRequestType) {
      const waiting = this.store.updateDemand(demand.id, {
        status: "waiting_user",
        pendingRequestId: mapped.pendingRequestId,
        pendingRequestType: mapped.pendingRequestType,
        pendingSince: now,
        lastActivityAt: now
      });
      this.store.addEvent({ demandId: demand.id, type: mapped.type, message: mapped.message, rawExcerpt: mapped.rawExcerpt });
      await this.notify(waiting.chatId, `#${waiting.id} precisa de resposta: ${mapped.message}\nResponder: /responder ${waiting.id} <texto>`);
      return;
    }

    if (mapped.type === "completed") {
      if (demand.pendingRequestId) return;
      const completed = this.store.updateDemand(demand.id, {
        status: "completed",
        pendingRequestId: null,
        pendingRequestType: null,
        pendingSince: null,
        finishedAt: now,
        lastActivityAt: now
      });
      this.store.addEvent({ demandId: demand.id, type: "completed", message: mapped.message, rawExcerpt: mapped.rawExcerpt });
      await this.notify(completed.chatId, `#${completed.id} concluída. Veja /eventos ${completed.id}.`);
      return;
    }

    if (mapped.type === "error") {
      const failed = this.store.updateDemand(demand.id, { status: "failed", lastError: mapped.message, finishedAt: now, lastActivityAt: now });
      this.store.addEvent({ demandId: demand.id, type: "error", message: mapped.message, rawExcerpt: mapped.rawExcerpt });
      await this.notify(failed.chatId, `#${failed.id} com erro: ${mapped.message}`);
      return;
    }

    if (demand.status !== "waiting_user") {
      this.store.updateDemand(demand.id, { status: "running", lastActivityAt: now });
    }
    this.store.addEvent({ demandId: demand.id, type: mapped.type, message: mapped.message, rawExcerpt: mapped.rawExcerpt });
  }

  async respondToDemand(id: number, userId: number, message: string): Promise<Demand> {
    const demand = this.store.findDemand(id);
    if (!demand) throw new Error(`Demanda #${id} não encontrada.`);
    if (demand.userId !== userId) throw new Error(`Demanda #${id} pertence a outro usuário autorizado.`);
    if (!demand.pendingRequestId || !demand.pendingRequestType) throw new Error(`Demanda #${id} não está aguardando resposta.`);

    if (demand.pendingRequestType === "question") {
      await this.client.replyToQuestion(demand.pendingRequestId, message);
    } else {
      const parsed = parsePermissionResponse(message);
      await this.client.replyToPermission(demand.pendingRequestId, parsed.reply, parsed.message);
    }

    this.store.addResponse({ demandId: demand.id, userId, message });
    const running = this.store.updateDemand(demand.id, {
      status: "running",
      pendingRequestId: null,
      pendingRequestType: null,
      pendingSince: null,
      lastActivityAt: new Date().toISOString()
    });
    this.store.addEvent({ demandId: demand.id, type: "response", message: "Resposta humana enviada ao OpenCode." });
    await this.notify(running.chatId, `Resposta enviada para #${running.id}.`);
    return running;
  }

  async cancelDemand(id: number, userId: number): Promise<Demand> {
    const demand = this.store.findDemand(id);
    if (!demand) throw new Error(`Demanda #${id} não encontrada.`);
    if (demand.userId !== userId) throw new Error(`Demanda #${id} pertence a outro usuário autorizado.`);
    if (TERMINAL_STATUSES.includes(demand.status)) return demand;

    if (demand.opencodeSessionId) await this.client.abortSession(demand.opencodeSessionId);
    const cancelled = this.store.updateDemand(demand.id, {
      status: "cancelled",
      pendingRequestId: null,
      pendingRequestType: null,
      pendingSince: null,
      finishedAt: new Date().toISOString()
    });
    this.store.addEvent({ demandId: demand.id, type: "cancelled", message: "Demanda cancelada pelo Telegram." });
    await this.notify(cancelled.chatId, `#${cancelled.id} cancelada.`);
    return cancelled;
  }

  getDemand(id: number): Demand | undefined {
    return this.store.findDemand(id);
  }

  listDemandCards(limit = 30): KanbanCard[] {
    return this.store.listDemands(limit).map((demand) => ({ demand, lastEvent: this.store.latestEvent(demand.id) }));
  }

  renderKanban(limit = 30): string {
    return renderKanban(this.listDemandCards(limit));
  }

  listEvents(id: number, limit = 20): DemandEvent[] {
    return this.store.listEvents(id, limit);
  }

  async bootRecovery(): Promise<void> {
    await this.reconcileActiveSessions("boot_recovery");
    await this.checkPendingTimeouts();
  }

  private async handleStreamError(error: Error): Promise<void> {
    this.recordStreamError(error);
    await this.reconcileActiveSessions("sse_reconnect");
  }

  private recordStreamError(error: Error): void {
    for (const demand of this.store.listActiveDemands()) {
      this.store.addEvent({ demandId: demand.id, type: "attention", message: `SSE reconectando: ${error.message}` });
    }
  }

  private async reconcileActiveSessions(reason: "boot_recovery" | "sse_reconnect"): Promise<void> {
    const activeDemands = this.store.listActiveDemands();
    if (activeDemands.length === 0) return;

    let statuses: Record<string, { status: string }>;
    try {
      statuses = await this.client.getSessionStatuses();
    } catch (error) {
      const message = toError(error).message;
      for (const demand of activeDemands) {
        this.store.addEvent({ demandId: demand.id, type: "attention", message: `Falha ao reconciliar OpenCode: ${message}` });
      }
      return;
    }

    for (const demand of activeDemands) {
      if (!demand.opencodeSessionId) continue;
      const status = statuses[demand.opencodeSessionId]?.status;
      if (!status) {
        const failed = this.store.updateDemand(demand.id, {
          status: "failed",
          lastError: "session_not_found_after_restart",
          finishedAt: new Date().toISOString()
        });
        this.store.addEvent({ demandId: demand.id, type: "error", message: "session_not_found_after_restart" });
        await this.notify(failed.chatId, `#${failed.id} não foi encontrada no OpenCode após recuperação.`);
        continue;
      }

      if (status === "idle" && !demand.pendingRequestId) {
        this.store.updateDemand(demand.id, { status: "completed", finishedAt: new Date().toISOString() });
        this.store.addEvent({ demandId: demand.id, type: "completed", message: `Recuperada como concluída (${reason}).` });
      } else if (demand.status !== "waiting_user") {
        this.store.updateDemand(demand.id, { status: "running" });
        this.store.addEvent({ demandId: demand.id, type: "recovered", message: `Sessão reanexada (${reason}): ${status}.` });
      }
    }
  }

  private async checkPendingTimeouts(): Promise<void> {
    const timeoutMs = this.options.pendingResponseTimeoutMinutes * 60 * 1000;
    const now = Date.now();
    for (const demand of this.store.listActiveDemands()) {
      if (demand.status !== "waiting_user" || !demand.pendingSince) continue;
      const age = now - new Date(demand.pendingSince).getTime();
      if (age <= timeoutMs) continue;
      this.store.addEvent({ demandId: demand.id, type: "attention", message: "Resposta pendente passou do timeout configurado." });
      await this.notify(demand.chatId, `#${demand.id} continua aguardando resposta há mais de ${this.options.pendingResponseTimeoutMinutes}min.`);
    }
  }

  private async notify(chatId: number, message: string): Promise<void> {
    await this.notifier?.notify(chatId, message);
  }
}

export function parsePermissionResponse(message: string): { reply: PermissionReply; message?: string } {
  const trimmed = message.trim();
  const [first, ...rest] = trimmed.split(/\s+/);
  const body = rest.join(" ").trim() || undefined;

  if (first?.toLowerCase() === "always") return { reply: "always", message: body };
  if (["reject", "rejeitar", "negar"].includes(first?.toLowerCase() ?? "")) return { reply: "reject", message: body };
  if (first?.toLowerCase() === "once") return { reply: "once", message: body };
  return { reply: "once", message: trimmed };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
