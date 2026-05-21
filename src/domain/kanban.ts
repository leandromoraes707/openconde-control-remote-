import type { Demand, DemandEvent, DemandStatus } from "../types.js";

export type KanbanCard = {
  demand: Demand;
  lastEvent?: DemandEvent;
};

type KanbanColumn = {
  title: string;
  status: DemandStatus;
};

const COLUMNS: KanbanColumn[] = [
  { title: "Entrada", status: "queued" },
  { title: "Executando", status: "running" },
  { title: "Aguardando", status: "waiting_user" },
  { title: "Com erro", status: "failed" },
  { title: "Concluídas", status: "completed" },
  { title: "Canceladas", status: "cancelled" }
];

export function renderKanban(cards: KanbanCard[], now = new Date()): string {
  const lines = ["Kanban das demandas"];

  for (const column of COLUMNS) {
    const columnCards = cards.filter((card) => card.demand.status === column.status);
    lines.push("", `${column.title} (${columnCards.length})`);

    if (columnCards.length === 0) {
      lines.push("  - vazio");
      continue;
    }

    for (const card of columnCards.slice(0, 8)) {
      lines.push(`  - ${renderCard(card, now)}`);
    }

    if (columnCards.length > 8) lines.push(`  - ... mais ${columnCards.length - 8}`);
  }

  return lines.join("\n");
}

export function renderDemandLine(card: KanbanCard, now = new Date()): string {
  return renderCard(card, now);
}

function renderCard(card: KanbanCard, now: Date): string {
  const demand = card.demand;
  const age = formatAge(demand.lastActivityAt ?? demand.updatedAt, now);
  const event = card.lastEvent ? ` — ${card.lastEvent.message}` : "";
  const action = demand.status === "waiting_user" ? ` — responder: /responder ${demand.id} <texto>` : "";
  return `#${demand.id} ${demand.title} (${age})${event}${action}`;
}

function formatAge(iso: string, now: Date): string {
  const deltaMs = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
