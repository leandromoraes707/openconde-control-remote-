export type DemandStatus = "queued" | "running" | "waiting_user" | "completed" | "failed" | "cancelled";

export type BotEventType =
  | "created"
  | "started"
  | "progress"
  | "attention"
  | "decision"
  | "response"
  | "error"
  | "completed"
  | "cancelled"
  | "recovered";

export type PendingRequestType = "question" | "permission";

export type Demand = {
  id: number;
  chatId: number;
  userId: number;
  title: string;
  prompt: string;
  workspacePath: string;
  status: DemandStatus;
  opencodeSessionId?: string;
  pendingRequestId?: string;
  pendingRequestType?: PendingRequestType;
  pendingSince?: string;
  lastActivityAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

export type DemandEvent = {
  id: number;
  demandId: number;
  type: BotEventType;
  message: string;
  rawExcerpt?: string;
  createdAt: string;
};

export type HumanResponse = {
  id: number;
  demandId: number;
  userId: number;
  message: string;
  createdAt: string;
};

export type DemandSummary = {
  demand: Demand;
  lastEvent?: DemandEvent;
};
