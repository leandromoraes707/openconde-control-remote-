export type TelegramSender = (chatId: number, message: string) => Promise<void>;

export type DemandNotifier = {
  notify(chatId: number, message: string): Promise<void>;
  flushAll?(): Promise<void>;
};

type BufferedNotifierOptions = {
  flushMs: number;
  maxMessageLength?: number;
};

export class BufferedNotifier implements DemandNotifier {
  private readonly sender: TelegramSender;
  private readonly flushMs: number;
  private readonly maxMessageLength: number;
  private readonly buffers = new Map<number, string[]>();
  private readonly timers = new Map<number, NodeJS.Timeout>();

  constructor(sender: TelegramSender, options: BufferedNotifierOptions) {
    this.sender = sender;
    this.flushMs = options.flushMs;
    this.maxMessageLength = options.maxMessageLength ?? 3900;
  }

  async notify(chatId: number, message: string): Promise<void> {
    const buffer = this.buffers.get(chatId) ?? [];
    buffer.push(message);
    this.buffers.set(chatId, buffer);

    if (this.flushMs === 0) {
      await this.flush(chatId);
      return;
    }

    if (!this.timers.has(chatId)) {
      const timer = setTimeout(() => {
        this.timers.delete(chatId);
        void this.flush(chatId);
      }, this.flushMs);
      this.timers.set(chatId, timer);
    }
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.buffers.keys()].map((chatId) => this.flush(chatId)));
  }

  private async flush(chatId: number): Promise<void> {
    const messages = this.buffers.get(chatId) ?? [];
    this.buffers.delete(chatId);

    const timer = this.timers.get(chatId);
    if (timer) clearTimeout(timer);
    this.timers.delete(chatId);

    if (messages.length === 0) return;

    const grouped = groupStreamingMessages(messages);
    for (const groupedMsg of grouped) {
      await this.sender(chatId, compactTelegramMessage(groupedMsg, this.maxMessageLength));
    }
  }
}

function groupStreamingMessages(messages: string[]): string[] {
  const result: string[] = [];
  let streamingBlock: string[] = [];

  for (const msg of messages) {
    if (msg.startsWith("OpenCode:\n")) {
      streamingBlock.push(msg.slice(9).trim());
    } else {
      if (streamingBlock.length > 0) {
        const combined = streamingBlock.join(" ");
        if (combined) result.push(`OpenCode:\n${combined}`);
        streamingBlock = [];
      }
      result.push(msg);
    }
  }

  if (streamingBlock.length > 0) {
    const combined = streamingBlock.join(" ");
    if (combined) result.push(`OpenCode:\n${combined}`);
  }

  return result;
}

export function compactTelegramMessage(message: string, maxLength = 3900): string {
  if (message.length <= maxLength) return message;
  const suffix = "\n\nMensagem truncada. Consulte /eventos <id> para histórico completo.";
  return `${message.slice(0, maxLength - suffix.length - 3)}...${suffix}`;
}
