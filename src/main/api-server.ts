// 任务 5.0：把 cursor-dance-api 嵌入主进程
//
// 职责：
//   - 在 whenReady 后启动 cursor-dance-api 的 HTTP server，绑定 127.0.0.1
//   - 端口探测：默认 8787，被占用时随机回退（getPort 0 → OS 分配）
//   - 把 ai-config 中的 apiKey/baseUrl/model 注入到 process.env，server 内部模块读 env
//   - 主进程退出前 close()，避免端口残留
//
// 复用：
//   cursor-dance-api/src/server.mjs 已经导出 createApp / startServer。这里走 createApp
//   再自己 listen(0)，方便拿到真实端口。startServer 是 dev 脚本用的便捷封装。

import { createServer } from "node:net";
import { configureRateLimiter } from "../../cursor-dance-api/src/rate-limiter.mjs";
import { createApp } from "../../cursor-dance-api/src/server.mjs";
import { syncEnvFromSettings } from "./ai-config";

const DEFAULT_PORT = 8787;
const HOST = "127.0.0.1";

// 全 process 单例 —— 一个嵌入服务实例
let server: import("node:http").Server | null = null;
let resolvedPort: number | null = null;

function probePort(port: number): Promise<boolean> {
  // 试探 port 是否可用；出于"快"的考虑，直接 createServer().listen(port) 尝试。
  // 占用就 reject、关闭再返回 false。返回 true 即代表当下未占用。
  return new Promise((resolve) => {
    const tester = createServer();
    tester.once("error", () => {
      try { tester.close(); } catch { /* ignore */ }
      resolve(false);
    });
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, HOST);
  });
}

async function pickPort(): Promise<number> {
  if (await probePort(DEFAULT_PORT)) return DEFAULT_PORT;
  // 0 = 让 OS 分配可用端口；listen 之后 server.address() 返回真实值。
  return 0;
}

export async function startEmbeddedAiServer(): Promise<{ port: number }> {
  if (server) {
    return { port: resolvedPort! };
  }

  // 1) 把用户设置写入 process.env，让 server 模块读到 apiKey/baseUrl/model。
  syncEnvFromSettings();
  configureRateLimiter(process.env);

  // 2) 起 HTTP server。
  const portCandidate = await pickPort();
  const app = createApp();

  await new Promise<void>((resolve, reject) => {
    app.once("error", reject);
    app.listen(portCandidate, HOST, () => resolve());
  });

  const address = app.address();
  if (!address || typeof address === "string") {
    // 不太可能进这条路径——createServer().listen() 后 address() 是 AddressInfo
    throw new Error("Failed to determine embedded AI server port");
  }

  server = app;
  resolvedPort = address.port;
  console.log(`[cursordance] embedded AI API listening on http://${HOST}:${resolvedPort}`);
  return { port: resolvedPort };
}

export function getEmbeddedAiServerEndpoint(): string | null {
  if (!resolvedPort) return null;
  return `http://${HOST}:${resolvedPort}/api/ai/scheme-proposals`;
}

export function getEmbeddedAiServerStreamEndpoint(): string | null {
  if (!resolvedPort) return null;
  return `http://${HOST}:${resolvedPort}/api/ai/scheme-proposals/stream`;
}

export function getEmbeddedAiAgentEndpoint(): string | null {
  if (!resolvedPort) return null;
  return `http://${HOST}:${resolvedPort}/api/ai/agent/run`;
}

export function stopEmbeddedAiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    const current = server;
    server = null;
    resolvedPort = null;
    current.close(() => resolve());
  });
}

export const __testing__ = {
  reset(): void {
    server = null;
    resolvedPort = null;
  },
  // 给单测注入端口，跳过真实 listen
  injectPort(port: number | null): void {
    resolvedPort = port;
  },
};
