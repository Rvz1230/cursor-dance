import { mergeActionConfig } from "../model/workbenchSchema.js";

const HEX_COLOR_BY_INTENT = {
  cyber: "#0284C7",
  minimal: "#0F766E",
  warm: "#B45309",
  petal: "#BE185D",
  focus: "#475569",
};

const NUMERIC_LIMITS = {
  fontSize: [12, 36],
  textDuration: [240, 1800],
  textOpacity: [20, 100],
  textOffsetY: [-72, 24],
  particleCount: [0, 40],
  particleSpread: [8, 120],
  particleDuration: [180, 1600],
  particleSize: [4, 28],
  particleOpacity: [20, 100],
  rippleSize: [20, 140],
  rippleDuration: [180, 1600],
  rippleOpacity: [10, 100],
  rippleLineWidth: [1, 6],
  volume: [0, 100],
  playbackRate: [70, 130],
  soundDelay: [0, 500],
  soundFadeOut: [0, 300],
  shake: [0, 90],
  cursorSize: [32, 64],
  holdMs: [0, 900],
};

function normalizePrompt(prompt) {
  return String(prompt || "").trim().toLowerCase();
}

function hasAny(prompt, terms) {
  return terms.some((term) => prompt.includes(term));
}

function clampNumber(fieldName, value) {
  const limits = NUMERIC_LIMITS[fieldName];
  if (!limits) return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return limits[0];
  return Math.min(limits[1], Math.max(limits[0], Math.round(numericValue)));
}

function sanitizePatch(patch) {
  return Object.fromEntries(
    Object.entries(patch).map(([fieldName, value]) => [
      fieldName,
      Object.prototype.hasOwnProperty.call(NUMERIC_LIMITS, fieldName) ? clampNumber(fieldName, value) : value,
    ])
  );
}

function describeDiff(patch) {
  const summary = [];
  if (patch.textEnabled === false) summary.push("关闭飘字，降低视觉打扰");
  if (patch.textEnabled === true) summary.push("启用文本飘字并设置文案");
  if (patch.particle === true) summary.push(`启用粒子反馈，数量 ${patch.particleCount ?? "保持当前"}`);
  if (patch.particle === false) summary.push("关闭粒子反馈");
  if (patch.ripple === true) summary.push(`启用波纹反馈，尺寸 ${patch.rippleSize ?? "保持当前"}`);
  if (patch.ripple === false) summary.push("关闭波纹反馈");
  if (patch.sound === false) summary.push("关闭音效");
  if (patch.sound === true) summary.push(`启用音效，音量 ${patch.volume ?? "保持当前"}`);
  if (patch.textColor) summary.push(`主色调整为 ${patch.textColor}`);
  if (patch.shake === 0) summary.push("关闭光标震动");
  if (patch.shake > 0) summary.push(`设置光标震动强度 ${patch.shake}`);
  return summary.slice(0, 5);
}

function buildBasePatch(prompt, currentConfig) {
  const patch = {};
  const wantsMinimal = hasAny(prompt, ["简约", "低调", "不要太花", "办公", "写代码", "轻量", "安静", "克制"]);
  const wantsCyber = hasAny(prompt, ["科技", "赛博", "cyber", "蓝", "霓虹", "程序员", "代码"]);
  const wantsWarm = hasAny(prompt, ["木鱼", "功德", "温暖", "暖色", "橙"]);
  const wantsPetal = hasAny(prompt, ["花", "粉", "可爱", "柔和"]);
  const wantsStrong = hasAny(prompt, ["夸张", "强烈", "明显", "炫", "炸裂", "高亮", "录屏"]);
  const wantsNoSound = hasAny(prompt, ["不要声音", "关闭声音", "静音", "无声", "不要音效"]);
  const wantsSound = hasAny(prompt, ["加声音", "有声音", "音效", "提示音"]);
  const wantsNoText = hasAny(prompt, ["不要文字", "不要飘字", "关闭飘字", "无文字"]);
  const wantsText = hasAny(prompt, ["文字", "飘字", "文案", "显示"]);
  const wantsNoParticle = hasAny(prompt, ["不要粒子", "关闭粒子", "无粒子"]);
  const wantsParticle = hasAny(prompt, ["粒子", "火花", "碎屑", "星星"]);
  const wantsRipple = hasAny(prompt, ["波纹", "涟漪", "扩散"]);
  const wantsLess = hasAny(prompt, ["少一点", "小一点", "暗一点", "再低调", "降低", "减弱"]);
  const wantsMore = hasAny(prompt, ["多一点", "亮一点", "增强", "更明显", "更强"]);

  if (wantsCyber) {
    Object.assign(patch, {
      textColor: HEX_COLOR_BY_INTENT.cyber,
      particle: true,
      particleStyle: "火花",
      particleColorMode: "跟随飘字色",
      particleDirection: "四周扩散",
      ripple: true,
      rippleStyle: "双环",
      cursorOverride: "切换到 pointer",
    });
  }

  if (wantsMinimal) {
    Object.assign(patch, {
      textColor: wantsCyber ? HEX_COLOR_BY_INTENT.cyber : HEX_COLOR_BY_INTENT.minimal,
      textEnabled: false,
      particle: true,
      particleCount: 8,
      particleSpread: 30,
      particleDuration: 520,
      particleSize: 8,
      particleOpacity: 58,
      ripple: true,
      rippleSize: 42,
      rippleDuration: 520,
      rippleOpacity: 36,
      sound: false,
      volume: 0,
      shake: 8,
      cursorOverride: "跟随当前状态",
    });
  }

  if (wantsWarm) {
    Object.assign(patch, {
      textColor: HEX_COLOR_BY_INTENT.warm,
      textEnabled: true,
      textKind: "数字飘字",
      textContent: "+1",
      textTags: ["功德 +1", "继续点击", "已触发"],
      particle: true,
      ripple: true,
      sound: !wantsNoSound,
      soundFile: "woodfish-soft.wav",
    });
  }

  if (wantsPetal) {
    Object.assign(patch, {
      textColor: HEX_COLOR_BY_INTENT.petal,
      textEnabled: true,
      textKind: "文本飘字",
      textContent: "nice",
      textTags: ["nice", "轻轻点亮", "完成"],
      particle: true,
      particleStyle: "碎屑粒子",
      particleDirection: "向上喷发",
      ripple: true,
      sound: false,
    });
  }

  if (wantsStrong) {
    Object.assign(patch, {
      textEnabled: true,
      fontSize: 26,
      textDuration: 1100,
      textOpacity: 100,
      textWeight: "加粗",
      textShadow: "柔和",
      particle: true,
      particleCount: 28,
      particleSpread: 82,
      particleDuration: 980,
      particleSize: 16,
      particleOpacity: 96,
      ripple: true,
      rippleSize: 92,
      rippleDuration: 900,
      rippleOpacity: 82,
      sound: !wantsNoSound,
      volume: wantsNoSound ? 0 : 76,
      shake: 54,
    });
  }

  if (wantsLess) {
    Object.assign(patch, {
      fontSize: Math.max(14, (currentConfig.fontSize || 18) - 4),
      particleCount: Math.max(4, Math.round((patch.particleCount ?? currentConfig.particleCount ?? 12) * 0.6)),
      particleSpread: Math.max(18, Math.round((patch.particleSpread ?? currentConfig.particleSpread ?? 40) * 0.7)),
      particleOpacity: Math.max(30, Math.round((patch.particleOpacity ?? currentConfig.particleOpacity ?? 70) * 0.72)),
      rippleOpacity: Math.max(20, Math.round((patch.rippleOpacity ?? currentConfig.rippleOpacity ?? 50) * 0.72)),
      volume: Math.max(0, Math.round((patch.volume ?? currentConfig.volume ?? 60) * 0.55)),
      shake: Math.max(0, Math.round((patch.shake ?? currentConfig.shake ?? 20) * 0.45)),
    });
  }

  if (wantsMore) {
    Object.assign(patch, {
      textEnabled: currentConfig.textEnabled !== false,
      particle: true,
      particleCount: Math.min(36, Math.round((currentConfig.particleCount || 12) * 1.45)),
      particleSpread: Math.min(110, Math.round((currentConfig.particleSpread || 44) * 1.25)),
      particleOpacity: Math.min(100, Math.round((currentConfig.particleOpacity || 70) * 1.18)),
      ripple: true,
      rippleSize: Math.min(120, Math.round((currentConfig.rippleSize || 52) * 1.22)),
      rippleOpacity: Math.min(100, Math.round((currentConfig.rippleOpacity || 56) * 1.14)),
      shake: Math.min(80, Math.round((currentConfig.shake || 18) * 1.35)),
    });
  }

  if (wantsNoSound) Object.assign(patch, { sound: false, volume: 0 });
  if (wantsSound && !wantsNoSound) Object.assign(patch, { sound: true, volume: Math.max(currentConfig.volume || 0, 58), soundFile: "tick-light.wav" });
  if (wantsNoText) Object.assign(patch, { textEnabled: false });
  if (wantsText && !wantsNoText) {
    Object.assign(patch, {
      textEnabled: true,
      textKind: "文本飘字",
      textContent: wantsCyber ? "focus" : "nice",
      textTags: wantsCyber ? ["focus", "build", "ship"] : ["nice", "done", "继续"],
    });
  }
  if (wantsNoParticle) Object.assign(patch, { particle: false, particleCount: 0 });
  if (wantsParticle && !wantsNoParticle) Object.assign(patch, { particle: true, particleCount: patch.particleCount ?? 18 });
  if (wantsRipple) Object.assign(patch, { ripple: true, rippleSize: patch.rippleSize ?? 68 });

  if (!Object.keys(patch).length) {
    Object.assign(patch, {
      textEnabled: false,
      textColor: HEX_COLOR_BY_INTENT.focus,
      particle: true,
      particleCount: 12,
      particleSpread: 44,
      particleDuration: 640,
      particleSize: 10,
      ripple: true,
      rippleSize: 54,
      rippleDuration: 640,
      sound: false,
      shake: 12,
    });
  }

  return sanitizePatch(patch);
}

export function createLocalAiSchemeResponse({ prompt, currentConfig, actionLabel }) {
  const normalizedPrompt = normalizePrompt(prompt);
  const patch = buildBasePatch(normalizedPrompt, currentConfig || {});
  const nextConfig = mergeActionConfig(currentConfig || {}, patch);
  const diffSummary = describeDiff(patch);
  const reply = [
    `我已按「${actionLabel || "当前动作"}」生成一版可执行配置。`,
    diffSummary.length ? `重点调整：${diffSummary.join("、")}。` : "这次主要做了整体风格收敛。",
  ].join("");

  return {
    source: "local-prototype",
    intent: "generate_or_modify_scheme",
    reply,
    patch,
    nextConfig,
    diffSummary,
  };
}

export async function requestAiSchemeEdit({ prompt, currentConfig, actionLabel }) {
  await new Promise((resolve) => window.setTimeout(resolve, 360));
  return createLocalAiSchemeResponse({ prompt, currentConfig, actionLabel });
}
