import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extension = process.platform === "win32" ? ".exe" : "";
const helperPath = join(
  projectRoot,
  "build",
  "native",
  process.arch,
  `cursordance-cursor-helper${extension}`,
);

const helper = spawn(helperPath, [], { stdio: ["pipe", "pipe", "pipe"] });
const statuses = [];
let stdoutBuffer = "";
let stderr = "";
let sentCommands = false;

helper.stdout.on("data", (chunk) => {
  stdoutBuffer += String(chunk);
  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() ?? "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    statuses.push(line);
    if (line === "ready" && !sentCommands) {
      sentCommands = true;
      helper.stdin.end("ping\nshow\nquit\n");
    }
  }
});
helper.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

const timeout = setTimeout(() => {
  helper.kill();
}, 5_000);

const exitCode = await new Promise((resolveExit, reject) => {
  helper.once("error", reject);
  helper.once("close", resolveExit);
});
clearTimeout(timeout);

if (exitCode !== 0) throw new Error(`Cursor helper exited with ${exitCode}: ${stderr.trim()}`);
for (const requiredStatus of ["ready", "pong", "shown"]) {
  if (!statuses.includes(requiredStatus)) {
    throw new Error(`Cursor helper omitted ${requiredStatus}; received: ${statuses.join(", ")}`);
  }
}
console.info(`[cursor-helper] protocol verified: ${statuses.join(" -> ")}`);
