import { spawn } from "node:child_process";
import stripAnsi from "strip-ansi";
import type {
  CreateSessionInput,
  CreateSessionResult,
  OpenCodeClient,
  OpenCodeEvent,
  OpenCodeSessionStatus,
  PermissionReply,
} from "./types.js";

type PtyProcess = {
  pid: number;
  onEvent: (event: OpenCodeEvent) => void;
  onExit: (code: number) => void;
  write: (data: string) => void;
  kill: () => void;
};

type SessionState = {
  id: string;
  status: "idle" | "busy" | "dead";
};

export class PtyOpenCodeClient implements OpenCodeClient {
  private readonly processes = new Map<string, PtyProcess>();
  private readonly sessions = new Map<string, SessionState>();
  private readonly workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const sessionId = input.title?.replace(/[^a-zA-Z0-9-_]/g, "-") ?? `session-${Date.now()}`;
    const resolvedSessionId = `${sessionId}-${Date.now().toString(36)}`;

    const pendingEvents: OpenCodeEvent[] = [];
    let outputBuffer = "";
    let resolveOutput: ((events: OpenCodeEvent[]) => void) | undefined;
    const outputReady = new Promise<OpenCodeEvent[]>((r) => {
      resolveOutput = r;
    });

    const proc = spawn("opencode", this.buildArgs(resolvedSessionId), {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, OPENCODE_WORKSPACE: this.workspacePath },
    });

    const ptyProcess: PtyProcess = {
      pid: proc.pid ?? 0,
      onEvent: () => {},
      onExit: () => {},
      write: (data: string) => proc.stdin?.write(data),
      kill: () => proc.kill("SIGTERM"),
    };

    this.processes.set(resolvedSessionId, ptyProcess);
    this.sessions.set(resolvedSessionId, { id: resolvedSessionId, status: "busy" });

    proc.stdout?.on("data", (chunk: Buffer) => {
      outputBuffer += chunk.toString();
      const lines = outputBuffer.split("\n");
      outputBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const raw = line.trim();
        if (!raw) continue;
        const text = stripAnsi(raw);
        const event = parseOpencodeOutput(text);
        if (event) {
          pendingEvents.push(event);
          ptyProcess.onEvent(event);
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = stripAnsi(chunk.toString()).trim();
      if (text) {
        const event: OpenCodeEvent = { type: "session.status", properties: { status: "busy", message: text } };
        pendingEvents.push(event);
        ptyProcess.onEvent(event);
      }
    });

    proc.on("exit", (code) => {
      this.sessions.set(resolvedSessionId, { id: resolvedSessionId, status: "dead" });
      ptyProcess.onExit(code ?? 0);

      if (outputBuffer.trim()) {
        const text = stripAnsi(outputBuffer.trim());
        const event = parseOpencodeOutput(text);
        if (event) {
          pendingEvents.push(event);
          ptyProcess.onEvent(event);
        }
      }

      resolveOutput?.(pendingEvents);
      this.processes.delete(resolvedSessionId);
    });

    await this.waitForReady(proc, resolvedSessionId);

    return { sessionId: resolvedSessionId };
  }

  async sendPrompt(sessionId: string, prompt: string, _workspacePath: string): Promise<void> {
    const proc = this.processes.get(sessionId);
    if (!proc) throw new Error(`Session ${sessionId} not found`);

    this.sessions.set(sessionId, { id: sessionId, status: "busy" });
    proc.write(prompt + "\n");
  }

  async replyToQuestion(requestId: string, answer: string): Promise<void> {
    const proc = this.findProcessByRequestId(requestId);
    if (!proc) throw new Error(`Session for request ${requestId} not found`);
    proc.write(answer + "\n");
  }

  async replyToPermission(requestId: string, reply: PermissionReply, message?: string): Promise<void> {
    const proc = this.findProcessByRequestId(requestId);
    if (!proc) throw new Error(`Session for request ${requestId} not found`);
    const fullReply = message ? `${reply} ${message}` : reply;
    proc.write(`${fullReply}\n`);
  }

  async abortSession(sessionId: string): Promise<void> {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill();
      this.processes.delete(sessionId);
    }
    this.sessions.set(sessionId, { id: sessionId, status: "dead" });
  }

  async getSessionStatuses(): Promise<Record<string, OpenCodeSessionStatus>> {
    const statuses: Record<string, OpenCodeSessionStatus> = {};
    for (const [id, state] of this.sessions) {
      statuses[id] = { status: state.status, sessionId: id };
    }
    return statuses;
  }

  subscribe(onEvent: (event: OpenCodeEvent) => void, onError: (error: Error) => void): () => void {
    for (const [, ptyProcess] of this.processes) {
      const prev = ptyProcess.onEvent;
      ptyProcess.onEvent = (event) => {
        prev(event);
        onEvent(event);
      };
    }

    return () => {
      for (const [, ptyProcess] of this.processes) {
        ptyProcess.onEvent = () => {};
      }
    };
  }

  private buildArgs(sessionId: string): string[] {
    return [
      "run",
      "--session",
      sessionId,
      "--format",
      "json",
      "--continue",
    ];
  }

  private async waitForReady(proc: ReturnType<typeof spawn>, sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Session ${sessionId} did not start within 10s`));
      }, 10_000);

      proc.stdout?.once("data", () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private findProcessByRequestId(_requestId: string): PtyProcess | undefined {
    for (const [, proc] of this.processes) {
      return proc;
    }
    return undefined;
  }
}

function parseOpencodeOutput(text: string): OpenCodeEvent | undefined {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return { type: String(parsed.type), properties: parsed.properties ?? {} };
    }
  } catch { }
  if (text.startsWith(".") || text === "...") return undefined;

  return {
    type: "session.status",
    properties: { status: "busy", message: text },
  };
}