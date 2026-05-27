import { sanitizeAiSchemePatch } from "./sanitize.js";

function normalizeIntentText(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

const INTENT_RULES = [
  {
    name: "soundOff",
    priority: 10,
    detect: (p) => /不要声音|关闭声音|关掉声音|静音|无声音|不要音效|关闭音效/.test(p),
    repair: (patch) => ({ ...patch, sound: false, volume: 0 }),
  },
  {
    name: "defaultNumberPlusOne",
    priority: 20,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return (
        (n.includes("数字") || n.includes("+1") || n.includes("加1"))
        && (
          n.includes("+1模式") || n.includes("数字+1") || n.includes("数字加1")
          || n.includes("默认模式") || n.includes("换成数字") || n.includes("改成数字")
          || n.includes("数字飘字")
        )
      );
    },
    repair: (patch) => ({
      ...patch,
      textEnabled: true,
      textKind: "数字飘字",
      textStyle: patch.textStyle || "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textContent: "+1",
      textTemplate: patch.textTemplate || "${number}",
      textTags: [],
      comboEnabled: Boolean(patch.comboEnabled),
    }),
  },
  {
    name: "templateNumber",
    priority: 20,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return n.includes("模板") && (n.includes("数字") || n.includes("${number}") || n.includes("number"));
    },
    repair: (patch) => ({
      ...patch,
      textEnabled: true,
      textKind: "数字飘字",
      textStyle: patch.textStyle || "阿拉伯数字 (1, 2, 3)",
      textMode: "模板模式",
      textTemplate: typeof patch.textTemplate === "string" && patch.textTemplate.includes("${number}")
        ? patch.textTemplate
        : "你当前点击了${number}次",
      textContent: "",
    }),
  },
  {
    name: "textFloatMode",
    priority: 20,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return n.includes("文本飘字") || n.includes("文字飘字") || n.includes("文案飘字");
    },
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      return {
        ...patch,
        textEnabled: true,
        textKind: "文本飘字",
        textMode: "模板模式",
        textContent: typeof patch.textContent === "string" && patch.textContent.trim()
          ? patch.textContent
          : (typeof currentConfig.textContent === "string" && currentConfig.textContent.trim()
            ? currentConfig.textContent
            : "Nice"),
        textTags: Array.isArray(patch.textTags) ? patch.textTags : [],
        comboEnabled: false,
      };
    },
  },
  {
    name: "rippleOnly",
    priority: 15,
    detect: (p) => /只保留波纹|仅保留波纹|只要波纹|仅要波纹/.test(p),
    repair: (patch) => ({
      ...patch,
      textEnabled: false,
      particle: false,
      particleCount: 0,
      ripple: true,
      sound: false,
      volume: 0,
      animationEnabled: false,
      imageEnabled: false,
    }),
  },
  {
    name: "particleOff",
    priority: 10,
    detect: (p) => /关闭粒子|关掉粒子|不要粒子|无粒子/.test(p),
    repair: (patch) => ({ ...patch, particle: false, particleCount: 0 }),
  },
  {
    name: "particleReduction",
    priority: 8,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return (n.includes("粒子") || n.includes("颗粒")) && (n.includes("少一点") || n.includes("减少") || n.includes("降低") || n.includes("低调"));
    },
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      const currentCount = Number.isFinite(Number(currentConfig.particleCount)) ? Number(currentConfig.particleCount) : 18;
      const currentOpacity = Number.isFinite(Number(currentConfig.particleOpacity)) ? Number(currentConfig.particleOpacity) : 55;
      return {
        ...patch,
        particle: true,
        particleCount: Math.max(1, Math.min(12, Math.round(currentCount * 0.5))),
        particleOpacity: patch.particleOpacity ?? Math.min(55, currentOpacity),
      };
    },
  },
  {
    name: "shakeOff",
    priority: 10,
    detect: (p) => /不要震动|关闭震动|关掉震动|无震动|不震动/.test(p),
    repair: (patch) => ({ ...patch, shake: 0 }),
  },
  {
    name: "rippleOff",
    priority: 10,
    detect: (p) => /不要波纹|关闭波纹|关掉波纹|无波纹/.test(p),
    repair: (patch) => ({ ...patch, ripple: false }),
  },
  {
    name: "animationOff",
    priority: 10,
    detect: (p) => /不要动画|关闭动画|关掉动画|无动画/.test(p),
    repair: (patch) => ({ ...patch, animationEnabled: false }),
  },
  {
    name: "imageOff",
    priority: 10,
    detect: (p) => /不要图像|关闭图像|关掉图像|不要图片|关闭图片/.test(p),
    repair: (patch) => ({ ...patch, imageEnabled: false }),
  },
  {
    name: "comboOff",
    priority: 10,
    detect: (p) => /不要连击|关闭连击|关掉连击|取消连击/.test(p),
    repair: (patch) => ({ ...patch, comboEnabled: false }),
  },
  {
    name: "softerFeedback",
    priority: 8,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return (n.includes("柔和") || n.includes("温柔") || n.includes("软一点")) && !n.includes("不柔和");
    },
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      const currentParticleOpacity = Number.isFinite(Number(currentConfig.particleOpacity)) ? Number(currentConfig.particleOpacity) : 70;
      const currentRippleOpacity = Number.isFinite(Number(currentConfig.rippleOpacity)) ? Number(currentConfig.rippleOpacity) : 60;
      const currentTextOpacity = Number.isFinite(Number(currentConfig.textOpacity)) ? Number(currentConfig.textOpacity) : 85;
      return {
        ...patch,
        particleOpacity: patch.particleOpacity ?? Math.max(15, Math.round(currentParticleOpacity * 0.6)),
        rippleOpacity: patch.rippleOpacity ?? Math.max(10, Math.round(currentRippleOpacity * 0.6)),
        textOpacity: patch.textOpacity ?? Math.max(20, Math.round(currentTextOpacity * 0.7)),
        textEasing: patch.textEasing || "缓出",
        rippleEasing: patch.rippleEasing || "缓出",
      };
    },
  },
  {
    name: "moreVisibleFeedback",
    priority: 8,
    detect: (p) => /更明显|更显眼|明显一点|更突出|强化/.test(p),
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      const currentParticleCount = Number.isFinite(Number(currentConfig.particleCount)) ? Number(currentConfig.particleCount) : 18;
      const currentParticleOpacity = Number.isFinite(Number(currentConfig.particleOpacity)) ? Number(currentConfig.particleOpacity) : 70;
      const currentRippleOpacity = Number.isFinite(Number(currentConfig.rippleOpacity)) ? Number(currentConfig.rippleOpacity) : 60;
      return {
        ...patch,
        particleCount: patch.particleCount ?? Math.min(40, Math.round(currentParticleCount * 1.4)),
        particleOpacity: patch.particleOpacity ?? Math.min(100, Math.round(currentParticleOpacity * 1.3)),
        rippleOpacity: patch.rippleOpacity ?? Math.min(100, Math.round(currentRippleOpacity * 1.3)),
        textOpacity: patch.textOpacity ?? Math.min(100, 95),
      };
    },
  },
  {
    name: "biggerCursor",
    priority: 8,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return (n.includes("光标") || n.includes("鼠标")) && (n.includes("大一点") || n.includes("变大") || n.includes("更大") || n.includes("放大"));
    },
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      const currentSize = Number.isFinite(Number(currentConfig.cursorSize)) ? Number(currentConfig.cursorSize) : 40;
      return {
        ...patch,
        cursorSize: patch.cursorSize ?? Math.min(64, Math.round(currentSize * 1.3)),
      };
    },
  },
  {
    name: "smallerCursor",
    priority: 8,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return (n.includes("光标") || n.includes("鼠标")) && (n.includes("小一点") || n.includes("变小") || n.includes("更小") || n.includes("缩小"));
    },
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      const currentSize = Number.isFinite(Number(currentConfig.cursorSize)) ? Number(currentConfig.cursorSize) : 40;
      return {
        ...patch,
        cursorSize: patch.cursorSize ?? Math.max(32, Math.round(currentSize * 0.75)),
      };
    },
  },
  {
    name: "rippleSmaller",
    priority: 8,
    detect: (p) => {
      const n = normalizeIntentText(p);
      return n.includes("波纹") && (n.includes("小一点") || n.includes("变小") || n.includes("缩小") || n.includes("低调"));
    },
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      const currentRippleSize = Number.isFinite(Number(currentConfig.rippleSize)) ? Number(currentConfig.rippleSize) : 60;
      return {
        ...patch,
        ripple: true,
        rippleSize: patch.rippleSize ?? Math.max(20, Math.round(currentRippleSize * 0.6)),
      };
    },
  },
  {
    name: "numberTextKindImplicit",
    priority: 5,
    detect: (_p, _ctx, patch) => patch?.textKind === "数字飘字",
    repair: (patch) => ({
      ...patch,
      textEnabled: true,
      textTags: Array.isArray(patch.textTags) ? patch.textTags : [],
      textStyle: patch.textStyle || "阿拉伯数字 (1, 2, 3)",
      textMode: patch.textMode || "默认模式 (+1)",
      textTemplate: patch.textTemplate || "${number}",
      textContent: patch.textMode === "默认模式 (+1)" ? "+1" : (patch.textContent || ""),
    }),
  },
  {
    name: "textTextKindImplicit",
    priority: 5,
    detect: (_p, _ctx, patch) => patch?.textKind === "文本飘字",
    repair: (patch, ctx) => {
      const currentConfig = ctx?.currentConfig || {};
      return {
        ...patch,
        textEnabled: true,
        comboEnabled: false,
        textContent: typeof patch.textContent === "string" && patch.textContent.trim()
          ? patch.textContent
          : (typeof currentConfig.textContent === "string" && currentConfig.textContent.trim()
            ? currentConfig.textContent
            : "Nice"),
        textTags: Array.isArray(patch.textTags) ? patch.textTags : [],
      };
    },
  },
];

export function repairPatchForUserIntent(patch, requestState = {}) {
  const prompt = normalizeIntentText(requestState.prompt || "");
  const currentConfig = requestState.currentConfig || {};

  return INTENT_RULES
    .filter((rule) => rule.detect(prompt, { currentConfig, ...requestState }, patch))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .reduce(
      (p, rule) => sanitizeAiSchemePatch(rule.repair(p, requestState)),
      sanitizeAiSchemePatch(patch)
    );
}
