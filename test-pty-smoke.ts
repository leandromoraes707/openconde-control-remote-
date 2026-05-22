import { PtyOpenCodeClient } from "./src/opencode/pty-client.ts";

const client = new PtyOpenCodeClient("/tmp/test-workspace");
console.log("instantiated");

const events: string[] = [];
const unsub = client.subscribe(
  (event) => {
    const msg = `[${event.type}] ${JSON.stringify(event.properties ?? {})}`;
    events.push(msg);
    console.log("EVENT:", msg);
  },
  (err) => console.error("ERROR:", err)
);

console.log("creating session...");
const result = await client.createSession({ title: "test-session", workspacePath: "/tmp/test-workspace" });
console.log("session created:", result.sessionId);

console.log("sending prompt...");
await client.sendPrompt(result.sessionId, "Hello, respond with just the word OK", "/tmp/test-workspace");

await new Promise((r) => setTimeout(r, 5000));

console.log("\nAll events captured:", events.length);
for (const e of events) console.log(e);

unsub();
process.exit(0);