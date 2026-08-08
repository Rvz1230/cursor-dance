const MAX_DIAGNOSTIC_ENTRIES = 80;

const DIAGNOSTIC_REASON_LABELS = {
  "not-ready": "引擎未就绪",
  "site-disabled": "被应用规则禁用",
  "trigger-zone-filtered": "不在触发区域内",
  "missing-source-action-config": "源动作配置缺失",
  "missing-resolved-action-config": "解析后配置缺失",
  "no-enabled-effects": "没有启用的效果",
  "budget-exhausted": "效果预算已满",
  throttled: "被节流吃掉",
  "content-signal-unavailable": "内容信号取不到（已回落到指针）",
};

function outputLabels(outputs) {
  const value = outputs && typeof outputs === "object" ? outputs : {};
  return [
    ["textEnabled", "飘字"],
    ["particleEnabled", "粒子"],
    ["rippleEnabled", "波纹"],
    ["soundEnabled", "音效"],
    ["animationEnabled", "动画"],
    ["imageEnabled", "贴纸"],
    ["cursorOverrideEnabled", "光标反馈"],
  ].filter(([key]) => value[key] === true).map(([, label]) => label);
}

function deriveDiagnosticGroup(entries, index) {
  const actionFire = entries.find((entry) => entry.scope === "action.fire");
  const actionSkip = [...entries].reverse().find((entry) => entry.scope === "action.skip");
  const rejectedZone = [...entries].reverse().find((entry) => (
    entry.scope === "trigger-zone.check" && entry.matched === false
  ));
  const fallbackEntry = entries.find((entry) => (
    entry.scope === "signal.fallback"
    || entry.scope === "keyboard.anchor-fallback"
    || entry.reason === "content-signal-unavailable"
  ));
  const representative = actionFire || actionSkip || entries[entries.length - 1] || {};
  const first = entries[0] || representative;
  const reason = fallbackEntry
    ? "content-signal-unavailable"
    : typeof actionSkip?.reason === "string" ? actionSkip.reason
      : rejectedZone ? "trigger-zone-filtered" : "";
  const result = actionFire
    ? (fallbackEntry ? "fallback" : "fire")
    : actionSkip || rejectedZone ? "skip" : "info";
  const outputs = outputLabels(actionFire?.outputs);

  return {
    id: `${first.at || "event"}-${index}`,
    at: first.at || representative.at || "",
    entries,
    result,
    reason,
    trigger: representative.sourceActionId || representative.actionId || representative.triggerSource || representative.scope || "runtime",
    outputs,
    host: entries.map((entry) => entry.processName || entry.host).find(Boolean) || "",
    theme: entries.map((entry) => entry.activeThemeId).find(Boolean) || "",
    zone: entries.map((entry) => entry.triggerZone).find(Boolean) || "",
    target: entries.map((entry) => entry.target).find(Boolean) || null,
    scopes: [...new Set(entries.map((entry) => entry.scope).filter(Boolean))],
  };
}

/**
 * 把 runtime 的逐条日志折叠成「一次触发一组」。运行时目前没有显式 trace id，
 * 因而以触发起点、终态以及相邻事件的时间间隔划分；返回顺序为最新优先。
 */
export function groupDiagnosticEntries(entries) {
  const ordered = (Array.isArray(entries) ? entries : []).filter((entry) => entry && typeof entry === "object");
  const buckets = [];
  let current = null;

  for (const entry of ordered) {
    const previous = current?.entries[current.entries.length - 1];
    const gap = new Date(entry.at || 0).getTime() - new Date(previous?.at || 0).getTime();
    const terminal = entry.scope === "action.fire" || entry.scope === "action.skip";
    const currentActionTerminal = current?.entries.some((item) => (
      item.scope === "action.fire"
      || item.scope === "action.skip"
      || item.scope === "keyboard.fire"
    ));
    const currentTerminal = currentActionTerminal || current?.entries.some((item) => (
      item.scope === "trigger-zone.check" && item.matched === false
    ));
    const startScope = ["action.schedule", "trigger-zone.check", "pointer.down", "pointer.up", "keyboard.anchor-fallback"].includes(entry.scope);
    const scheduled = entry.scope === "trigger-zone.check" && previous?.scope === "action.schedule";
    const hasPipeline = current?.entries.some((item) => item.scope === "trigger-zone.check" || item.scope?.startsWith("action.") || item.scope?.includes("fallback"));
    const keyboardPrelude = current?.entries.some((item) => item.scope === "keyboard.anchor-fallback")
      && !current?.entries.some((item) => item.scope === "keyboard.fire");
    const startsTrigger = entry.scope === "trigger-zone.check"
      ? !hasPipeline || currentTerminal
      : entry.scope === "keyboard.fire" ? !keyboardPrelude : startScope && !scheduled;
    if (!current || gap > 800 || startsTrigger || (terminal && (!hasPipeline || currentActionTerminal))) {
      current = { entries: [] };
      buckets.push(current);
    }
    current.entries.push(entry);
  }

  return buckets.map((bucket, index) => deriveDiagnosticGroup(bucket.entries, index)).reverse();
}

export function diagnosticReasonLabel(reason) {
  return DIAGNOSTIC_REASON_LABELS[reason] || reason || "未说明原因";
}

export function appendDiagnosticEntry(entries, entry, maxEntries = MAX_DIAGNOSTIC_ENTRIES) {
  const currentEntries = Array.isArray(entries) ? entries : [];
  if (!entry || typeof entry !== "object") {
    return currentEntries.slice(-maxEntries);
  }
  return [...currentEntries, entry].slice(-maxEntries);
}

export function summarizeLivePreviewConfig(config, selectedThemeId) {
  if (!config) {
    return {
      status: "inactive",
      label: "当前没有检测到未保存预览。",
      activeThemeId: "",
      themeCount: 0,
    };
  }

  const activeThemeId = config.activeThemeId || "";
  const themeCount = Array.isArray(config.themes) ? config.themes.length : 0;

  if (activeThemeId && activeThemeId === selectedThemeId) {
    return {
      status: "current",
      label: "当前主题存在未保存预览覆盖。",
      activeThemeId,
      themeCount,
    };
  }

  if (activeThemeId) {
    return {
      status: "other",
      label: `检测到主题 ${activeThemeId} 的未保存预览覆盖。`,
      activeThemeId,
      themeCount,
    };
  }

  return {
    status: "unknown",
    label: "检测到未保存预览，但没有明确的主题标识。",
    activeThemeId: "",
    themeCount,
  };
}
