#!/usr/bin/env node
import { spawn } from "node:child_process";
import { loadRuntimeEnv, opencodeServeArgs } from "./shared.mjs";

if (process.argv.includes("--help")) {
  console.log("Uso: npm run opencode:serve\nSobe o OpenCode local usando OPENCODE_SERVER_URL e OPENCODE_SERVER_PASSWORD do .env.");
  process.exit(0);
}

const env = loadRuntimeEnv();
const child = spawn("opencode", opencodeServeArgs(env), { stdio: "inherit", env });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
