import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const endpoint = process.env.CURSORDANCE_AI_API_CHECK_ENDPOINT
  || process.env.VITE_CURSORDANCE_AI_API_ENDPOINT
  || "http://127.0.0.1:8787/api/ai/scheme-proposals";

const token = process.env.CURSORDANCE_AI_API_ACCESS_TOKEN || "";

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({
    prompt: "把当前方案换成数字+1模式，不要声音",
    actionId: "leftClick",
    actionLabel: "左键单击",
    taskMode: "modify_action",
    currentConfig: {
      textEnabled: true,
      textKind: "文本飘字",
      textMode: "模板模式",
      textContent: "nice",
      textTags: ["nice"],
      sound: true,
      volume: 60,
    },
  }),
});

const text = await response.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  payload = text;
}

if (!response.ok) {
  console.error("AI API check failed:", response.status, payload);
  process.exit(1);
}

console.log(JSON.stringify({
  endpoint,
  status: response.status,
  source: payload.source,
  mode: payload.mode,
  scheme: payload.scheme,
  patch: payload.patch,
}, null, 2));
