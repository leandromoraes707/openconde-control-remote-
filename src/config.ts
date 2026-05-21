import { z } from "zod";

export type AppConfig = {
  telegramBotToken: string;
  allowedUserIds: number[];
  opencodeWorkspace: string;
  opencodeServerUrl: string;
  opencodeServerPassword?: string;
  databasePath: string;
  pendingResponseTimeoutMinutes: number;
  notificationFlushMs: number;
};

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_USER_IDS: z.string().min(1),
  OPENCODE_WORKSPACE: z.string().min(1),
  OPENCODE_SERVER_URL: z.string().url().default("http://127.0.0.1:4096"),
  OPENCODE_SERVER_PASSWORD: z.string().optional(),
  DATABASE_PATH: z.string().min(1).default("./telegram-opencode.sqlite"),
  PENDING_RESPONSE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),
  NOTIFICATION_FLUSH_MS: z.coerce.number().int().min(0).default(2500)
});

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.parse(env);
  const allowedUserIds = parsed.TELEGRAM_ALLOWED_USER_IDS.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));

  if (allowedUserIds.length === 0) {
    throw new Error("TELEGRAM_ALLOWED_USER_IDS must contain at least one numeric Telegram user id");
  }

  return {
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    allowedUserIds,
    opencodeWorkspace: parsed.OPENCODE_WORKSPACE,
    opencodeServerUrl: parsed.OPENCODE_SERVER_URL,
    opencodeServerPassword: parsed.OPENCODE_SERVER_PASSWORD || undefined,
    databasePath: parsed.DATABASE_PATH,
    pendingResponseTimeoutMinutes: parsed.PENDING_RESPONSE_TIMEOUT_MINUTES,
    notificationFlushMs: parsed.NOTIFICATION_FLUSH_MS
  };
}
