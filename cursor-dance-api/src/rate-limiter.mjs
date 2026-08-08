// rate-limiter.mjs — 内存滑动窗口限流器
//
// 三层限制（全部通过环境变量配置）：
//   1. 并发限制 — 同时处理中的请求数
//   2. IP 频率限制 — 滑动窗口（每分钟 + 每小时），按 quick/agent 模式区分
//   3. 日请求预算 — 每日总请求数硬上限，超过自动拒绝
//
// 日预算写入文件持久化，pm2 重启不丢失。
// 单进程设计（pm2 instances=1），模块级状态即全局状态。

import fs from "node:fs";
import path from "node:path";

// ── 滑动窗口状态 ──────────────────────────────────────────
const IP_WINDOWS = {
  quick: { rpm: new Map(), rph: new Map() },
  agent: { rpm: new Map(), rph: new Map() },
};

let currentConcurrency = 0;
let currentConcurrencyAgent = 0;

let dailyCount = 0;
let currentDate = "";
let budgetFilePath = "";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

// ── 配置（从环境变量加载） ──────────────────────────────
let cfg = {
  enabled: true,
  maxConcurrency: 3,
  maxConcurrencyAgent: 1,
  rpmIp: 3,
  rphIp: 20,
  rpmIpAgent: 1,
  rphIpAgent: 5,
  dailyRequestBudget: 0,
  trustProxy: false,
};

/**
 * 从环境变量初始化（可在 startServer 时调用）。
 * 幂等，多次调用会重置计数器。
 */
export function configureRateLimiter(env = {}) {
  cfg = {
    enabled: env.CURSORDANCE_AI_RATE_LIMIT_ENABLED !== "0",
    maxConcurrency: pInt(env.CURSORDANCE_AI_MAX_CONCURRENCY, 3),
    maxConcurrencyAgent: pInt(env.CURSORDANCE_AI_MAX_CONCURRENCY_AGENT, 1),
    rpmIp: pInt(env.CURSORDANCE_AI_RPM_IP, 3),
    rphIp: pInt(env.CURSORDANCE_AI_RPH_IP, 20),
    rpmIpAgent: pInt(env.CURSORDANCE_AI_RPM_IP_AGENT, 1),
    rphIpAgent: pInt(env.CURSORDANCE_AI_RPH_IP_AGENT, 5),
    dailyRequestBudget: pInt(env.CURSORDANCE_AI_DAILY_REQUEST_BUDGET, 0),
    trustProxy: env.CURSORDANCE_AI_TRUST_PROXY === "1",
  };

  budgetFilePath = env.CURSORDANCE_AI_BUDGET_FILE || "";

  // 重置日计数器
  currentDate = todayStr();
  dailyCount = 0;
  currentConcurrency = 0;
  currentConcurrencyAgent = 0;
  clearIpWindows();

  if (cfg.dailyRequestBudget > 0 && budgetFilePath) {
    loadBudget();
  }
}

// ── 公开 API ───────────────────────────────────────────────

/**
 * 尝试获取处理槽位。
 * @param {import("node:http").IncomingMessage} request
 * @param {"quick"|"agent"} mode
 * @returns {{ ok: true } | { ok: false, status: number, retryAfter: number, error: string, code: string }}
 */
export function acquireSlot(request, mode = "quick") {
  const rejection = checkLimits(request, mode);
  if (rejection) return rejection;

  const now = Date.now();
  const ip = clientIp(request);
  const windows = windowsFor(mode);

  // 占用并发槽位
  if (mode === "agent") {
    currentConcurrencyAgent++;
  } else {
    currentConcurrency++;
  }

  // 记录 IP 滑动窗口
  pushWindow(windows.rpm, ip, now, MINUTE_MS);
  pushWindow(windows.rph, ip, now, HOUR_MS);

  // 计入日预算
  checkDayRollover();
  dailyCount++;
  persistBudget();

  return { ok: true };
}

/**
 * 释放处理槽位（在 finally 中调用）。
 */
export function releaseSlot(mode = "quick") {
  if (mode === "agent") {
    currentConcurrencyAgent = Math.max(0, currentConcurrencyAgent - 1);
  } else {
    currentConcurrency = Math.max(0, currentConcurrency - 1);
  }
}

/**
 * 当前限流器状态（用于 /api/health）。
 */
export function getRateLimitMetrics() {
  checkDayRollover();
  return {
    enabled: cfg.enabled,
    concurrency: currentConcurrency,
    concurrencyAgent: currentConcurrencyAgent,
    dailyCount,
    dailyBudget: cfg.dailyRequestBudget,
    date: currentDate,
    trackedIps: new Set([
      ...IP_WINDOWS.quick.rpm.keys(),
      ...IP_WINDOWS.agent.rpm.keys(),
    ]).size,
  };
}

// ── 内部 ───────────────────────────────────────────────────

function checkLimits(request, mode) {
  if (!cfg.enabled) return null;

  const isAgent = mode === "agent";
  const now = Date.now();
  const windows = windowsFor(mode);

  // 1. 并发限制
  const maxConc = isAgent ? cfg.maxConcurrencyAgent : cfg.maxConcurrency;
  const curConc = isAgent ? currentConcurrencyAgent : currentConcurrency;
  if (curConc >= maxConc) {
    return reject(503, 5, "服务器繁忙，请稍后重试", "too_many_concurrent");
  }

  const ip = clientIp(request);

  // 2. IP 频率 — 每分钟
  const maxRpm = isAgent ? cfg.rpmIpAgent : cfg.rpmIp;
  if (windowCount(windows.rpm, ip, MINUTE_MS, now) >= maxRpm) {
    return reject(429, 60, "请求过于频繁，请稍后再试", "rate_limited");
  }

  // 3. IP 频率 — 每小时
  const maxRph = isAgent ? cfg.rphIpAgent : cfg.rphIp;
  if (windowCount(windows.rph, ip, HOUR_MS, now) >= maxRph) {
    return reject(429, 3600, "已达到每小时请求上限，请稍后再试", "rate_limited_hourly");
  }

  // 4. 日预算
  checkDayRollover();
  if (cfg.dailyRequestBudget > 0 && dailyCount >= cfg.dailyRequestBudget) {
    return reject(429, 3600, "今日 AI 用量已达上限，请明天再试", "daily_budget_exceeded");
  }

  return null;
}

function reject(status, retryAfter, error, code) {
  return { ok: false, status, retryAfter, error, code };
}

function clientIp(request) {
  if (cfg.trustProxy) {
    const fwd = request.headers?.["x-forwarded-for"];
    if (fwd) {
      const ip = (Array.isArray(fwd) ? fwd[0] : fwd).split(",")[0].trim();
      if (ip) return ip;
    }
    const real = request.headers?.["x-real-ip"];
    if (real) return Array.isArray(real) ? real[0] : real;
  }
  return request.socket?.remoteAddress || "unknown";
}

function windowsFor(mode) {
  return mode === "agent" ? IP_WINDOWS.agent : IP_WINDOWS.quick;
}

function clearIpWindows() {
  IP_WINDOWS.quick.rpm.clear();
  IP_WINDOWS.quick.rph.clear();
  IP_WINDOWS.agent.rpm.clear();
  IP_WINDOWS.agent.rph.clear();
}

// ── 滑动窗口工具 ──────────────────────────────────────────

function windowCount(map, key, windowMs, now) {
  const entries = map.get(key);
  if (!entries) return 0;
  const cutoff = now - windowMs;
  while (entries.length > 0 && entries[0] < cutoff) {
    entries.shift();
  }
  return entries.length;
}

function pushWindow(map, key, timestamp, windowMs) {
  let entries = map.get(key);
  if (!entries) {
    entries = [];
    map.set(key, entries);
  }
  entries.push(timestamp);

  if (entries.length > 200) {
    const cutoff = timestamp - windowMs;
    while (entries.length > 0 && entries[0] < cutoff) {
      entries.shift();
    }
  }
}

// ── 日预算持久化 ─────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function checkDayRollover() {
  const today = todayStr();
  if (today !== currentDate) {
    currentDate = today;
    dailyCount = 0;
    clearIpWindows();
    persistBudget();
  }
}

function loadBudget() {
  try {
    if (fs.existsSync(budgetFilePath)) {
      const data = JSON.parse(fs.readFileSync(budgetFilePath, "utf8"));
      if (data.date === currentDate) {
        dailyCount = data.count || 0;
      }
    }
  } catch {
    // 文件不存在或格式错误 — 忽略
  }
}

function persistBudget() {
  if (!budgetFilePath || cfg.dailyRequestBudget <= 0) return;

  try {
    const dir = path.dirname(budgetFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      budgetFilePath,
      JSON.stringify({ date: currentDate, count: dailyCount }),
      "utf8",
    );
  } catch {
    // 写盘失败不影响服务
  }
}

// ── 工具 ───────────────────────────────────────────────────

function pInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
