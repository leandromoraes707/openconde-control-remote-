import Database from "better-sqlite3";
import type { BotEventType, Demand, DemandEvent, DemandStatus, HumanResponse, PendingRequestType } from "../types.js";

type CreateDemandInput = {
  chatId: number;
  userId: number;
  title?: string;
  prompt: string;
  workspacePath: string;
};

type DemandPatch = Partial<{
  status: DemandStatus;
  opencodeSessionId: string | null;
  pendingRequestId: string | null;
  pendingRequestType: PendingRequestType | null;
  pendingSince: string | null;
  lastActivityAt: string | null;
  lastError: string | null;
  finishedAt: string | null;
}>;

type AddEventInput = {
  demandId: number;
  type: BotEventType;
  message: string;
  rawExcerpt?: string;
};

type DemandRow = {
  id: number;
  chat_id: number;
  user_id: number;
  title: string;
  prompt: string;
  workspace_path: string;
  status: DemandStatus;
  opencode_session_id: string | null;
  pending_request_id: string | null;
  pending_request_type: PendingRequestType | null;
  pending_since: string | null;
  last_activity_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type DemandEventRow = {
  id: number;
  demand_id: number;
  type: BotEventType;
  message: string;
  raw_excerpt: string | null;
  created_at: string;
};

type HumanResponseRow = {
  id: number;
  demand_id: number;
  user_id: number;
  message: string;
  created_at: string;
};

const ACTIVE_STATUSES: DemandStatus[] = ["queued", "running", "waiting_user"];

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  createDemand(input: CreateDemandInput): Demand {
    const now = new Date().toISOString();
    const title = input.title ?? createTitle(input.prompt);
    const result = this.db
      .prepare(
        `insert into demands (chat_id, user_id, title, prompt, workspace_path, status, created_at, updated_at, last_activity_at)
         values (?, ?, ?, ?, ?, 'queued', ?, ?, ?)`
      )
      .run(input.chatId, input.userId, title, input.prompt, input.workspacePath, now, now, now);

    return this.getDemand(Number(result.lastInsertRowid));
  }

  getDemand(id: number): Demand {
    const row = this.db.prepare("select * from demands where id = ?").get(id) as DemandRow | undefined;
    if (!row) throw new Error(`Demand ${id} not found`);
    return mapDemand(row);
  }

  findDemand(id: number): Demand | undefined {
    const row = this.db.prepare("select * from demands where id = ?").get(id) as DemandRow | undefined;
    return row ? mapDemand(row) : undefined;
  }

  findDemandBySession(sessionId: string): Demand | undefined {
    const row = this.db.prepare("select * from demands where opencode_session_id = ?").get(sessionId) as DemandRow | undefined;
    return row ? mapDemand(row) : undefined;
  }

  findActiveDemandForUser(userId: number): Demand | undefined {
    const row = this.db
      .prepare("select * from demands where user_id = ? and status in ('queued', 'running', 'waiting_user') order by id desc limit 1")
      .get(userId) as DemandRow | undefined;
    return row ? mapDemand(row) : undefined;
  }

  listDemands(limit = 20): Demand[] {
    return this.db
      .prepare("select * from demands order by id desc limit ?")
      .all(limit)
      .map((row) => mapDemand(row as DemandRow));
  }

  listActiveDemands(): Demand[] {
    return this.db
      .prepare("select * from demands where status in ('queued', 'running', 'waiting_user') order by id asc")
      .all()
      .map((row) => mapDemand(row as DemandRow));
  }

  updateDemand(id: number, patch: DemandPatch): Demand {
    const assignments: string[] = [];
    const values: Array<string | number | null> = [];

    addPatch(assignments, values, "status", patch.status);
    addPatch(assignments, values, "opencode_session_id", patch.opencodeSessionId);
    addPatch(assignments, values, "pending_request_id", patch.pendingRequestId);
    addPatch(assignments, values, "pending_request_type", patch.pendingRequestType);
    addPatch(assignments, values, "pending_since", patch.pendingSince);
    addPatch(assignments, values, "last_activity_at", patch.lastActivityAt);
    addPatch(assignments, values, "last_error", patch.lastError);
    addPatch(assignments, values, "finished_at", patch.finishedAt);

    if (assignments.length === 0) return this.getDemand(id);

    assignments.push("updated_at = ?");
    values.push(new Date().toISOString(), id);

    this.db.prepare(`update demands set ${assignments.join(", ")} where id = ?`).run(...values);
    return this.getDemand(id);
  }

  addEvent(input: AddEventInput): DemandEvent {
    const now = new Date().toISOString();
    const result = this.db
      .prepare("insert into events (demand_id, type, message, raw_excerpt, created_at) values (?, ?, ?, ?, ?)")
      .run(input.demandId, input.type, input.message, input.rawExcerpt ?? null, now);

    this.updateDemand(input.demandId, { lastActivityAt: now });
    return this.getEvent(Number(result.lastInsertRowid));
  }

  listEvents(demandId: number, limit = 20): DemandEvent[] {
    return this.db
      .prepare("select * from events where demand_id = ? order by id asc limit ?")
      .all(demandId, limit)
      .map((row) => mapEvent(row as DemandEventRow));
  }

  latestEvent(demandId: number): DemandEvent | undefined {
    const row = this.db
      .prepare("select * from events where demand_id = ? order by id desc limit 1")
      .get(demandId) as DemandEventRow | undefined;
    return row ? mapEvent(row) : undefined;
  }

  addResponse(input: { demandId: number; userId: number; message: string }): HumanResponse {
    const now = new Date().toISOString();
    const result = this.db
      .prepare("insert into responses (demand_id, user_id, message, created_at) values (?, ?, ?, ?)")
      .run(input.demandId, input.userId, input.message, now);
    return this.getResponse(Number(result.lastInsertRowid));
  }

  close(): void {
    this.db.close();
  }

  private getEvent(id: number): DemandEvent {
    const row = this.db.prepare("select * from events where id = ?").get(id) as DemandEventRow | undefined;
    if (!row) throw new Error(`Event ${id} not found`);
    return mapEvent(row);
  }

  private getResponse(id: number): HumanResponse {
    const row = this.db.prepare("select * from responses where id = ?").get(id) as HumanResponseRow | undefined;
    if (!row) throw new Error(`Response ${id} not found`);
    return {
      id: row.id,
      demandId: row.demand_id,
      userId: row.user_id,
      message: row.message,
      createdAt: row.created_at
    };
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists demands (
        id integer primary key autoincrement,
        chat_id integer not null,
        user_id integer not null,
        title text not null,
        prompt text not null,
        workspace_path text not null,
        status text not null,
        opencode_session_id text,
        pending_request_id text,
        pending_request_type text,
        pending_since text,
        last_activity_at text,
        last_error text,
        created_at text not null,
        updated_at text not null,
        finished_at text
      );

      create index if not exists idx_demands_status on demands(status);
      create index if not exists idx_demands_session on demands(opencode_session_id);
      create index if not exists idx_demands_user_status on demands(user_id, status);

      create table if not exists events (
        id integer primary key autoincrement,
        demand_id integer not null references demands(id) on delete cascade,
        type text not null,
        message text not null,
        raw_excerpt text,
        created_at text not null
      );

      create index if not exists idx_events_demand_id on events(demand_id, id);

      create table if not exists responses (
        id integer primary key autoincrement,
        demand_id integer not null references demands(id) on delete cascade,
        user_id integer not null,
        message text not null,
        created_at text not null
      );
    `);
  }
}

function addPatch(assignments: string[], values: Array<string | number | null>, column: string, value: string | number | null | undefined): void {
  if (value !== undefined) {
    assignments.push(`${column} = ?`);
    values.push(value);
  }
}

function mapDemand(row: DemandRow): Demand {
  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.user_id,
    title: row.title,
    prompt: row.prompt,
    workspacePath: row.workspace_path,
    status: row.status,
    opencodeSessionId: row.opencode_session_id ?? undefined,
    pendingRequestId: row.pending_request_id ?? undefined,
    pendingRequestType: row.pending_request_type ?? undefined,
    pendingSince: row.pending_since ?? undefined,
    lastActivityAt: row.last_activity_at ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at ?? undefined
  };
}

function mapEvent(row: DemandEventRow): DemandEvent {
  return {
    id: row.id,
    demandId: row.demand_id,
    type: row.type,
    message: row.message,
    rawExcerpt: row.raw_excerpt ?? undefined,
    createdAt: row.created_at
  };
}

function createTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length <= 64 ? normalized : `${normalized.slice(0, 61)}...`;
}

export { ACTIVE_STATUSES };
