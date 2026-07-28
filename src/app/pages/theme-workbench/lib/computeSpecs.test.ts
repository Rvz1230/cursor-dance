import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDefaultActionConfigs } from "../model/actionConfigPresets";

// ── TypeScript (workbench) implementations ────────────────────────────

import {
  computeParticleSpecs as tsComputeParticleSpecs,
  computeRippleLayers as tsComputeRippleLayers,
  computeOrbitalParticleSpecs as tsComputeOrbitalParticleSpecs,
  getParticleShapeStyle as tsGetParticleShapeStyle,
  getParticleTint as tsGetParticleTint,
  getAnimationVisualStyle as tsGetAnimationVisualStyle,
  getTextContent as tsGetTextContent,
  hexToRgba as tsHexToRgba,
  getAnimationEasingCss as tsGetAnimationEasingCss,
  formatNumber as tsFormatNumber,
  getTextWeightValue as tsGetTextWeightValue,
} from "./computeSpecs";

// ── Runtime (content script) implementations ──────────────────────────

const COMPUTE_SPECS_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../extension/config-runtime/compute-specs.js",
);
const ACTION_CONFIG_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../extension/config-runtime/action-config.js",
);

/** Install the compute-specs.js IIFE with minimal stubs for its dependencies. */
function installRuntimeHelpers() {
  const hexToRgba = (hex, alpha) => {
    const normalized = (hex || "#f59e0b").replace("#", "");
    const value =
      normalized.length === 3
        ? normalized.split("").map((c) => c + c).join("")
        : normalized;
    const int = Number.parseInt(value, 16);
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
  };

  // Field lists matching action-config.js – used for config picking
  const ACTION_TRIGGER_FIELDS = ["triggerTiming", "triggerZone", "holdMs"];
  const ACTION_TEXT_FIELDS = [
    "textKind", "textStyle", "textMode", "textTemplate", "textEnabled",
    "textContent", "textTags", "textTagPlayMode", "textColor", "textDuration",
    "textEasing", "textOpacity", "textFontFamily", "textWeight",
    "textOutlineWidth", "textShadow", "comboEnabled", "textOffsetX",
    "textOffsetY", "fontSize", "textGradient", "textGradientStart",
    "textGradientEnd", "comboWindowMs", "textDelay",
  ];
  const ACTION_PARTICLE_FIELDS = [
    "particle", "particleCount", "particleSpread", "particleStyle",
    "particleDirection", "particleColorMode", "particleDuration",
    "particleSize", "particleOpacity", "particlePalette", "particleGravity",
    "particleWind", "particleBounce", "particleTrail", "particleDelay",
    "particleStagger", "particleMotionMode", "orbitalCount", "orbitalRadius",
    "orbitalSpeed",
  ];
  const ACTION_RIPPLE_FIELDS = [
    "ripple", "rippleSize", "rippleDuration", "rippleStyle", "rippleEasing",
    "rippleLineWidth", "rippleOpacity", "rippleColor", "rippleDelay",
  ];
  const ACTION_AUDIO_FIELDS = [
    "sound", "volume", "playbackRate", "soundDelay", "soundFadeOut",
    "soundTriggerMode", "soundBlendMode", "soundFile",
  ];
  const ACTION_ANIMATION_FIELDS = [
    "animationEnabled", "animationStyle", "animationDuration",
    "animationEasing", "animationScale", "animationOpacity",
    "animationOffsetX", "animationOffsetY", "animationColor", "animationGlow",
    "animationDelay",
  ];
  const ACTION_IMAGE_FIELDS = [
    "imageEnabled", "imageDataUrl", "imageDuration", "imageSize",
    "imageOpacity", "imageOffsetX", "imageOffsetY", "imageDelay",
  ];
  const ACTION_CURSOR_FEEDBACK_FIELDS = [
    "shake", "cursorOverride", "cursorSize", "cursorTrailEnabled",
    "cursorTrailCount", "cursorTrailOpacity", "cursorGlowColor",
  ];

  function pickFields(config, fields) {
    return Object.fromEntries(fields.map((f) => [f, config?.[f]]));
  }

  // Also load getParticleColor from action-config.js since compute-specs may not use it directly
  // but it's part of the shared helpers bundle.
  const actionConfigSource = fs.readFileSync(ACTION_CONFIG_PATH, "utf-8");

  globalThis.CursorDanceConfigHelpers = {};
  globalThis.window = globalThis as unknown as Window & typeof globalThis;

  // First eval action-config.js to set up its helpers (hexToRgba, formatNumber, etc.)
  new Function(actionConfigSource)();

  // Ensure our stubs are in place (action-config.js already registered hexToRgba etc.)
  const helpers = globalThis.CursorDanceConfigHelpers;

  // Override config-picking functions to work with flat action configs
  helpers.getActionParticleConfig = (config) => pickFields(config, ACTION_PARTICLE_FIELDS);
  helpers.getActionRippleConfig = (config) => pickFields(config, ACTION_RIPPLE_FIELDS);
  helpers.getActionTextConfig = (config) => pickFields(config, ACTION_TEXT_FIELDS);
  helpers.getActionAnimationConfig = (config) => pickFields(config, ACTION_ANIMATION_FIELDS);
  helpers.getActionImageConfig = (config) => pickFields(config, ACTION_IMAGE_FIELDS);
  helpers.getActionAudioConfig = (config) => pickFields(config, ACTION_AUDIO_FIELDS);
  helpers.getActionCursorFeedbackConfig = (config) => pickFields(config, ACTION_CURSOR_FEEDBACK_FIELDS);

  // Now eval compute-specs.js
  const source = fs.readFileSync(COMPUTE_SPECS_PATH, "utf-8");
  new Function(source)();
}

let installed = false;
function ensureRuntime() {
  if (!installed) {
    installRuntimeHelpers();
    installed = true;
  }
}

function getRuntimeHelpers() {
  ensureRuntime();
  return globalThis.CursorDanceConfigHelpers;
}

// ── Test cases ────────────────────────────────────────────────────────

const DEFAULT_CONFIGS = {
  leftClick: getDefaultActionConfigs("mono-geo").leftClick,
  rightClick: getDefaultActionConfigs("mono-geo").rightClick,
  doubleClick: getDefaultActionConfigs("mono-geo").doubleClick,
  longPress: getDefaultActionConfigs("mono-geo").longPress,
  wheel: getDefaultActionConfigs("mono-geo").wheel,
  hover: getDefaultActionConfigs("mono-geo").hover,
};

const EDGE_CONFIGS = {
  "zero-count": { ...DEFAULT_CONFIGS.leftClick, particleCount: 0, ripple: false, textEnabled: false },
  "max-spread": { ...DEFAULT_CONFIGS.leftClick, particleSpread: 90, particleCount: 1 },
  "wind-bounce": { ...DEFAULT_CONFIGS.leftClick, particleWind: 100, particleBounce: 100, particleGravity: 0 },
  "heavy-gravity": { ...DEFAULT_CONFIGS.leftClick, particleGravity: 100, particleWind: 0, particleBounce: 0 },
  "upward-only": { ...DEFAULT_CONFIGS.leftClick, particleDirection: "向上喷发" },
  "scatter-mode": { ...DEFAULT_CONFIGS.leftClick, particleDirection: "随机散射" },
  "no-particle": { ...DEFAULT_CONFIGS.leftClick, particle: false, ripple: false },
};

// ── Helper: compare two specs deeply ──────────────────────────────────

function isClose(a, b) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-10;
  return a === b;
}

function compareArrays(label, rtArr, tsArr, fields) {
  expect(rtArr.length, `${label}: array length`).toBe(tsArr.length);
  for (let i = 0; i < rtArr.length; i++) {
    for (const field of fields) {
      const rtVal = rtArr[i][field];
      const tsVal = tsArr[i][field];
      expect(isClose(rtVal, tsVal), `${label}[${i}].${field}: rt=${rtVal} ts=${tsVal}`).toBe(true);
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("computeSpecs parity: runtime IIFE vs TypeScript module", () => {
  describe("hexToRgba", () => {
    const rt = () => getRuntimeHelpers().hexToRgba;
    it("produces identical output for common inputs", () => {
      const cases: Array<[string, number]> = [
        ["#F59E0B", 0.5],
        ["#34D399", 1],
        ["#fff", 0.25],
        ["#000000", 0.8],
        ["", 0.3],
      ];
      for (const [hex, alpha] of cases) {
        expect(rt()(hex, alpha)).toBe(tsHexToRgba(hex, alpha));
      }
    });
  });

  describe("getAnimationEasingCss", () => {
    const rt = () => getRuntimeHelpers().getAnimationEasing;
    it("produces identical output for all easing labels", () => {
      const labels = ["线性", "缓入", "缓入缓出", "弹跳", "弹性", "未知标签"];
      for (const label of labels) {
        expect(rt()(label)).toBe(tsGetAnimationEasingCss(label));
      }
    });
  });

  describe("formatNumber", () => {
    const rt = () => getRuntimeHelpers().formatNumber;
    it("produces identical output for all styles", () => {
      const cases: Array<[string, number]> = [
        ["阿拉伯数字 (1, 2, 3)", 1],
        ["中文数字 (一, 二, 三)", 3],
        ["英文单词 (one, two, three)", 5],
      ];
      for (const [style, num] of cases) {
        expect(rt()(style, num)).toBe(tsFormatNumber(style, num));
      }
    });
  });

  describe("getTextWeightValue", () => {
    const rt = () => getRuntimeHelpers().getTextWeightValue;
    it("produces identical output", () => {
      for (const label of ["加粗", "中等", "常规", "未知"]) {
        expect(rt()(label)).toBe(tsGetTextWeightValue(label));
      }
    });
  });

  describe("getTextContent", () => {
    const rt = () => getRuntimeHelpers().getTextContent;
    it("produces identical output for all default configs", () => {
      const runIndices = [0, 1, 3, 7];
      for (const [name, config] of Object.entries(DEFAULT_CONFIGS)) {
        for (const runIndex of runIndices) {
          const rtResult = rt()(config, runIndex, "leftClick");
          const tsResult = tsGetTextContent(config, runIndex, "leftClick");
          expect(rtResult, `${name} runIndex=${runIndex}`).toBe(tsResult);
        }
      }
    });
  });

  describe("computeRippleLayers", () => {
    const rt = () => getRuntimeHelpers().computeRippleLayers;
    const LAYER_FIELDS = ["size", "opacity", "delay", "filled", "scaleFrom", "scaleMid", "scaleTo"];
    it("produces identical output for all default configs", () => {
      for (const [name, config] of Object.entries(DEFAULT_CONFIGS)) {
        const rtResult = rt()(config);
        const tsResult = tsComputeRippleLayers(config);
        compareArrays(`ripple ${name}`, rtResult, tsResult, LAYER_FIELDS);
      }
    });
    it("handles all ripple styles", () => {
      const styles = ["单环", "双环", "柔和面波", "脉冲波纹", "回声环", "能量脉冲"];
      for (const style of styles) {
        const config = { ...DEFAULT_CONFIGS.leftClick, rippleStyle: style };
        const rtResult = rt()(config);
        const tsResult = tsComputeRippleLayers(config);
        compareArrays(`ripple style=${style}`, rtResult, tsResult, LAYER_FIELDS);
      }
    });
  });

  describe("computeParticleSpecs", () => {
    const rt = () => getRuntimeHelpers().computeParticleSpecs;
    const SPEC_FIELDS = ["x", "y", "midX", "midY", "delay", "size", "endScale"];
    it("produces identical output for all default configs", () => {
      const runIndices = [0, 1, 3, 7];
      for (const [name, config] of Object.entries(DEFAULT_CONFIGS)) {
        for (const runIndex of runIndices) {
          const rtResult = rt()(config, runIndex);
          const tsResult = tsComputeParticleSpecs(config, runIndex);
          compareArrays(`particle ${name} runIndex=${runIndex}`, rtResult, tsResult, SPEC_FIELDS);
        }
      }
    });
    it("handles all particle directions", () => {
      const dirs = ["四周扩散", "向上喷发", "随机散射", "旋转扫射"];
      for (const dir of dirs) {
        const config = { ...DEFAULT_CONFIGS.leftClick, particleDirection: dir };
        const rtResult = rt()(config, 1);
        const tsResult = tsComputeParticleSpecs(config, 1);
        compareArrays(`particle dir=${dir}`, rtResult, tsResult, SPEC_FIELDS);
      }
    });
    it("handles all particle styles", () => {
      const styles = ["点状粒子", "火花", "碎屑粒子", "星光", "钻石", "心形", "方块", "三角"];
      for (const style of styles) {
        const config = { ...DEFAULT_CONFIGS.leftClick, particleStyle: style };
        const rtResult = rt()(config, 2);
        const tsResult = tsComputeParticleSpecs(config, 2);
        compareArrays(`particle style=${style}`, rtResult, tsResult, SPEC_FIELDS);
      }
    });
  });

  describe("computeOrbitalParticleSpecs", () => {
    const rt = () => getRuntimeHelpers().computeOrbitalParticleSpecs;
    const SPEC_FIELDS = ["sx", "sy", "ex", "ey", "delay", "size", "speed"];
    it("produces identical output for all default configs", () => {
      for (const [name, config] of Object.entries(DEFAULT_CONFIGS)) {
        const rtResult = rt()(config);
        const tsResult = tsComputeOrbitalParticleSpecs(config);
        compareArrays(`orbital ${name}`, rtResult, tsResult, SPEC_FIELDS);
      }
    });
  });

  describe("getParticleShapeStyle", () => {
    const rt = () => getRuntimeHelpers().getParticleShapeStyle;
    const SHAPE_FIELDS = ["width", "height", "borderRadius", "rotation", "boxShadow"];
    it("produces identical output for all particle styles", () => {
      const styles = ["点状粒子", "火花", "碎屑粒子", "星光", "钻石", "心形", "方块", "三角"];
      for (const style of styles) {
        const config = { ...DEFAULT_CONFIGS.leftClick, particleStyle: style };
        for (const size of [6, 12, 24]) {
          for (const index of [0, 3, 7]) {
            const rtResult = rt()(config, index, size);
            const tsResult = tsGetParticleShapeStyle(config, index, size);
            for (const field of SHAPE_FIELDS) {
              const rtVal = rtResult[field];
              const tsVal = tsResult[field];
              expect(isClose(rtVal, tsVal), `shape style=${style} index=${index} size=${size} .${field}: rt=${rtVal} ts=${tsVal}`).toBe(true);
            }
            if (rtResult.clipPath || tsResult.clipPath) {
              expect(rtResult.clipPath, `shape style=${style} .clipPath`).toBe(tsResult.clipPath);
            }
          }
        }
      }
    });
  });

  describe("getAnimationVisualStyle", () => {
    const rt = () => getRuntimeHelpers().getAnimationVisualStyle;
    const STYLE_FIELDS = ["borderRadius", "background", "clipPath", "boxShadow", "border"];
    it("produces identical output for all animation styles", () => {
      const styles = ["聚焦脉冲", "斜切闪片", "弹跳徽记", "漩涡旋转", "星光闪耀", "轨道环绕", "螺旋上升"];
      for (const style of styles) {
        const config = { ...DEFAULT_CONFIGS.doubleClick, animationStyle: style };
        const rtResult = rt()(config);
        const tsResult = tsGetAnimationVisualStyle(config);
        for (const field of STYLE_FIELDS) {
          const rtVal = rtResult[field];
          const tsVal = tsResult[field];
          if (rtVal === undefined && tsVal === undefined) continue;
          expect(rtVal, `anim style=${style} .${field}: rt=${rtVal} ts=${tsVal}`).toBe(tsVal);
        }
      }
    });
    it("handles glow animation configs", () => {
      const config = { ...DEFAULT_CONFIGS.doubleClick, animationGlow: true, animationColor: "#FF6B6B" };
      const rtResult = rt()(config);
      const tsResult = tsGetAnimationVisualStyle(config);
      expect(rtResult.boxShadow).toBe(tsResult.boxShadow);
    });
  });

  describe("edge cases", () => {
    it("handles zero particle count", () => {
      const rt = getRuntimeHelpers().computeParticleSpecs;
      const config = { ...DEFAULT_CONFIGS.leftClick, particleCount: 0 };
      expect(rt(config, 0)).toEqual([]);
      expect(tsComputeParticleSpecs(config, 0)).toEqual([]);
    });
    it("handles extreme particle physics values", () => {
      const rt = getRuntimeHelpers().computeParticleSpecs;
      for (const [name, config] of Object.entries(EDGE_CONFIGS)) {
        const rtResult = rt(config, 3);
        const tsResult = tsComputeParticleSpecs(config, 3);
        compareArrays(`edge ${name}`, rtResult, tsResult, ["x", "y", "midX", "midY", "delay", "size", "endScale"]);
      }
    });
  });
});
