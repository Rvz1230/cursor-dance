// 任务 5.0：把嵌入 AI 服务的 endpoint 注入到 globalThis
//
// cursor-dance-api/src/client.js 读 globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT 等全局，
// 扩展端通过 vite define 在构建时塞进去；桌面端没法在构建时知道运行端口
// （主进程随机分配），所以这里在 renderer 启动后通过 IPC 拉一次再注入。
//
// 调用时机：必须在 React 渲染之前 + 在用户触发 AI 请求之前完成 await。
// 当前 entry.tsx 使用顶层 await 等待这次注入完成；失败 fallback 为
// 默认的远程 endpoint，让客户端走「未配置后端」错误路径，不阻塞 UI 启动。

declare global {
  // eslint-disable-next-line no-var
  var VITE_CURSORDANCE_AI_API_ENDPOINT: string | undefined;
  // eslint-disable-next-line no-var
  var VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT: string | undefined;
  // eslint-disable-next-line no-var
  var VITE_CURSORDANCE_AI_AGENT_ENDPOINT: string | undefined;
  // eslint-disable-next-line no-var
  var VITE_CURSORDANCE_AI_API_ACCESS_TOKEN: string | undefined;
}

export async function installAiEndpointGlobals(): Promise<void> {
  if (typeof window === "undefined") return;
  const bridge = window.cursorDanceAi;
  if (!bridge) return; // 扩展端 / 静态预览：不覆盖 build-time 注入的值

  try {
    const config = await bridge.getRuntimeConfig();
    const g = globalThis as Record<string, unknown>;
    if (config.endpoint) g.VITE_CURSORDANCE_AI_API_ENDPOINT = config.endpoint;
    if (config.streamEndpoint) g.VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT = config.streamEndpoint;
    if (config.agentEndpoint) g.VITE_CURSORDANCE_AI_AGENT_ENDPOINT = config.agentEndpoint;
    if (config.accessToken) g.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN = config.accessToken;
  } catch (error) {
    console.error("[cursordance] failed to install AI endpoint globals:", error);
  }
}
