import {
  Ban,
  Clock3,
  Hand,
  HelpCircle,
  Layers3,
  Link2,
  MousePointer2,
  Settings2,
  TextCursorInput,
  Type,
  Volume2,
  Wand2,
  Waves,
} from "lucide-react";

export const WORKSPACES = [
  { id: "workbench", label: "主题工作台", icon: Wand2 },
  { id: "bindings", label: "动作绑定", icon: Layers3 },
  { id: "states", label: "光标状态", icon: MousePointer2 },
  { id: "sites", label: "站点规则", icon: Link2 },
];

const FALLBACK_THEMES = [
  {
    id: "woodfish",
    name: "木鱼方案",
    kind: "自定义",
    summary: "数字飘字 · 声音反馈 · 轻波纹",
    tone: "amber",
  },
  {
    id: "lite-default",
    name: "轻量默认风",
    kind: "内置",
    summary: "低打扰 · 日常浏览",
    tone: "teal",
  },
  {
    id: "demo-highlight",
    name: "Demo Highlight",
    kind: "内置",
    summary: "高亮展示 · 录屏友好",
    tone: "sky",
  },
  {
    id: "petal",
    name: "花瓣流光",
    kind: "自定义",
    summary: "柔和粒子 · 粉色短文案",
    tone: "rose",
  },
];

export const THEME_TONES = ["amber", "teal", "sky", "rose"];

const THEME_TONE_BY_ID = {
  woodfish: "amber",
  "lite-default": "teal",
  "demo-highlight": "sky",
  petal: "rose",
};

export const ACTIONS = [
  { id: "leftClick", label: "左键单击", hint: "最常用的触发入口" },
  { id: "rightClick", label: "右键单击", hint: "适合菜单或次要动作" },
  { id: "doubleClick", label: "双击", hint: "更强的强调反馈" },
  { id: "longPress", label: "长按", hint: "按住蓄力后触发" },
  { id: "wheel", label: "滚轮", hint: "轻反馈和页面尾迹" },
  { id: "hover", label: "悬停", hint: "切状态或轻提示" },
];

export const CURSOR_STATES = [
  { id: "default", label: "默认", detail: "Normal · 48 × 48", icon: MousePointer2, defaultMode: "源" },
  { id: "pointer", label: "手型", detail: "Pointer · 48 × 48", icon: Hand, defaultMode: "继承" },
  { id: "text", label: "文本", detail: "Text · 48 × 48", icon: TextCursorInput, defaultMode: "继承" },
  { id: "help", label: "帮助", detail: "Help · 48 × 48", icon: HelpCircle, defaultMode: "继承" },
  { id: "wait", label: "等待", detail: "Wait · 48 × 48", icon: Clock3, defaultMode: "覆盖" },
  { id: "notAllowed", label: "禁用", detail: "Not allowed · 48 × 48", icon: Ban, defaultMode: "继承" },
];

const toneMap = {
  amber: {
    chip: "bg-amber-100 text-amber-700 ring-amber-200",
    icon: "bg-amber-100 text-amber-700",
    border: "border-amber-200",
  },
  teal: {
    chip: "bg-teal-100 text-teal-700 ring-teal-200",
    icon: "bg-teal-100 text-teal-700",
    border: "border-teal-200",
  },
  sky: {
    chip: "bg-sky-100 text-sky-700 ring-sky-200",
    icon: "bg-sky-100 text-sky-700",
    border: "border-sky-200",
  },
  rose: {
    chip: "bg-rose-100 text-rose-700 ring-rose-200",
    icon: "bg-rose-100 text-rose-700",
    border: "border-rose-200",
  },
};

function getDefaultThemePacks() {
  if (typeof window === "undefined") return [];
  return Array.isArray(window.CursorDanceDefaultConfig?.themePacks) ? window.CursorDanceDefaultConfig.themePacks : [];
}

function getThemeSummaryActionConfig(themePack) {
  if (themePack?.workbenchDraft?.actionConfigs?.leftClick) {
    return themePack.workbenchDraft.actionConfigs.leftClick;
  }
  if (themePack?.id && THEME_TONE_BY_ID[themePack.id]) {
    return createThemeDraft(themePack.id).actionConfigs.leftClick;
  }
  return null;
}

function buildThemeSummary(themePack) {
  const actionConfig = getThemeSummaryActionConfig(themePack);
  const effects = themePack?.behavior?.click?.effects ?? {};
  const parts = [];

  if (actionConfig?.textEnabled || effects.text?.enabled !== false) {
    parts.push(actionConfig?.textKind === "文本飘字" ? "文本飘字" : "数字飘字");
  }
  if (actionConfig?.sound) {
    parts.push("声音反馈");
  }
  if (actionConfig?.ripple || effects.ripple?.enabled !== false) {
    parts.push("轻波纹");
  }
  if (actionConfig?.particle || effects.particle?.enabled !== false) {
    parts.push("粒子反馈");
  }

  return parts.slice(0, 3).join(" · ") || "默认反馈主题";
}

export function toThemeKindLabel(kind) {
  return kind === "builtin" || kind === "内置" ? "内置" : "自定义";
}

export function getThemeTone(themeId, fallbackIndex = 0) {
  return THEME_TONE_BY_ID[themeId] || THEME_TONES[fallbackIndex % THEME_TONES.length];
}

export function buildThemeLibraryItem(themePack, fallbackIndex = 0) {
  const description = themePack?.description || "未填写说明";
  return {
    id: themePack?.id || `theme-${fallbackIndex + 1}`,
    name: themePack?.name || `主题 ${fallbackIndex + 1}`,
    kind: toThemeKindLabel(themePack?.kind),
    summary: buildThemeSummary(themePack),
    description,
    tone: getThemeTone(themePack?.id, fallbackIndex),
  };
}

export function buildThemeLibrarySeed(themePacks = getDefaultThemePacks()) {
  if (!themePacks.length) return FALLBACK_THEMES;
  return themePacks.map((themePack, index) => buildThemeLibraryItem(themePack, index));
}

export const THEMES = buildThemeLibrarySeed();

export const TRIGGER_OPTIONS = {
  leftClick: {
    timing: ["按下时", "抬起时"],
    zones: ["当前页面可点击区域", "仅按钮和链接", "全部可交互元素"],
  },
  rightClick: {
    timing: ["按下时", "菜单弹出前"],
    zones: ["右键菜单前", "可交互元素", "空白区域"],
  },
  doubleClick: {
    timing: ["第二次按下时", "第二次抬起后"],
    zones: ["双击命中区域", "主操作按钮", "内容卡片"],
  },
  longPress: {
    timing: ["按住达到阈值", "松开后触发"],
    zones: ["按住后释放", "长按可交互元素", "全局长按区"],
  },
  wheel: {
    timing: ["滚动开始时", "连续滚动中"],
    zones: ["向上 / 向下滚轮", "仅向上滚动", "仅向下滚动"],
  },
  hover: {
    timing: ["进入时", "停留后"],
    zones: ["进入可交互元素", "仅按钮和链接", "全页面 hover"],
  },
};

export const SOUND_FILE_OPTIONS = ["woodfish-soft.wav", "woodfish-deep.wav", "tick-light.wav"];

export const CURSOR_OVERRIDE_OPTIONS = [
  "跟随当前状态",
  "木鱼（继承默认）",
  "木鱼（增强态）",
  "木鱼（按压态）",
  "切换到 pointer",
];

export const TEXT_KIND_OPTIONS = ["数字飘字", "文本飘字"];
export const NUMBER_STYLE_OPTIONS = ["阿拉伯数字 (1, 2, 3)", "中文数字 (一, 二, 三)", "英文单词 (one, two, three)"];
export const TEXT_MODE_OPTIONS = ["默认模式 (+1)", "模板模式"];
export const TEXT_TAG_PLAY_OPTIONS = ["按顺序显示", "随机显示"];
export const TEXT_EASING_OPTIONS = ["线性", "缓入", "缓出", "缓入缓出", "弹跳", "弹性"];
export const TEXT_WEIGHT_OPTIONS = ["常规", "中等", "加粗"];
export const TEXT_SHADOW_OPTIONS = ["无", "柔和", "清晰"];
export const PARTICLE_STYLE_OPTIONS = ["点状粒子", "碎屑粒子", "火花"];
export const PARTICLE_DIRECTION_OPTIONS = ["四周扩散", "向上喷发", "沿点击方向"];
export const PARTICLE_COLOR_MODE_OPTIONS = ["跟随主题", "跟随飘字色", "随机轻变化"];
export const RIPPLE_STYLE_OPTIONS = ["单环", "双环", "柔和面波"];
export const RIPPLE_EASING_OPTIONS = ["线性", "缓出", "缓入缓出", "弹性"];
export const AUDIO_TRIGGER_OPTIONS = ["每次触发", "连击叠加", "节流播放"];
export const AUDIO_BLEND_OPTIONS = ["保持原音量", "压低页面音频", "仅插件音效"];
export const CURSOR_SIZE_OPTIONS = ["32 × 32", "40 × 40", "48 × 48", "56 × 56", "64 × 64"];
export const CURSOR_HOTSPOT_OPTIONS = ["0, 0", "8, 8", "12, 12", "16, 16", "16, 32", "24, 24"];

export const PANEL_META = {
  trigger: { icon: MousePointer2, tone: "bg-emerald-100 text-emerald-700" },
  text: { icon: Type, tone: "bg-amber-100 text-amber-700" },
  particles: { icon: Waves, tone: "bg-sky-100 text-sky-700" },
  audio: { icon: Volume2, tone: "bg-rose-100 text-rose-700" },
  cursor: { icon: Settings2, tone: "bg-slate-200 text-slate-700" },
};

export function toneClasses(tone) {
  return toneMap[tone] ?? toneMap.teal;
}

export function formatActionLabel(actionId) {
  return ACTIONS.find((item) => item.id === actionId)?.label ?? "左键单击";
}

export function buildDefaultCursorStateActions() {
  return Object.fromEntries(CURSOR_STATES.map((item) => [item.id, "leftClick"]));
}

export function buildDefaultCursorStateAssets() {
  return Object.fromEntries(
    CURSOR_STATES.map((item) => [
      item.id,
      {
        imageDataUrl: "",
        hotspotX: 16,
        hotspotY: 32,
        size: 48,
      },
    ])
  );
}

export function getDefaultActionConfigs(themeId) {
  const common = {
    leftClick: {
      textKind: "数字飘字",
      textStyle: "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textTemplate: "你当前点击了${number}次",
      textEnabled: true,
      textContent: "+1",
      textTags: ["功德 +1", "继续点击", "已触发"],
      textTagPlayMode: "按顺序显示",
      textColor: "#B45309",
      textDuration: 1000,
      textEasing: "缓出",
      textOpacity: 100,
      textWeight: "加粗",
      textOutlineWidth: 0,
      textShadow: "无",
      comboEnabled: true,
      textOffsetX: 0,
      textOffsetY: -26,
      particle: true,
      particleCount: 18,
      particleSpread: 56,
      particleStyle: "点状粒子",
      particleDirection: "四周扩散",
      particleColorMode: "跟随主题",
      particleDuration: 760,
      particleSize: 14,
      particleOpacity: 88,
      ripple: true,
      rippleSize: 68,
      rippleDuration: 820,
      rippleStyle: "单环",
      rippleEasing: "缓出",
      rippleLineWidth: 2,
      rippleOpacity: 72,
      sound: true,
      fontSize: 22,
      volume: 78,
      playbackRate: 100,
      soundDelay: 0,
      soundFadeOut: 80,
      soundTriggerMode: "每次触发",
      soundBlendMode: "保持原音量",
      shake: 42,
      cursorOverride: "木鱼（继承默认）",
      cursorSize: 48,
      triggerTiming: "抬起时",
      triggerZone: "当前页面可点击区域",
      holdMs: 0,
      soundFile: "woodfish-soft.wav",
    },
    rightClick: {
      textKind: "文本飘字",
      textStyle: "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textTemplate: "你当前点击了${number}次",
      textEnabled: false,
      textContent: "menu",
      textTags: ["展开菜单", "右键操作", "更多选项"],
      textTagPlayMode: "按顺序显示",
      textColor: "#475569",
      textDuration: 820,
      textEasing: "缓出",
      textOpacity: 100,
      textWeight: "中等",
      textOutlineWidth: 0,
      textShadow: "无",
      comboEnabled: false,
      textOffsetX: 0,
      textOffsetY: -18,
      particle: false,
      particleCount: 10,
      particleSpread: 30,
      particleStyle: "点状粒子",
      particleDirection: "沿点击方向",
      particleColorMode: "跟随主题",
      particleDuration: 520,
      particleSize: 10,
      particleOpacity: 70,
      ripple: false,
      rippleSize: 42,
      rippleDuration: 520,
      rippleStyle: "单环",
      rippleEasing: "缓出",
      rippleLineWidth: 2,
      rippleOpacity: 56,
      sound: false,
      fontSize: 18,
      volume: 60,
      playbackRate: 96,
      soundDelay: 0,
      soundFadeOut: 40,
      soundTriggerMode: "节流播放",
      soundBlendMode: "保持原音量",
      shake: 18,
      cursorOverride: "跟随当前状态",
      cursorSize: 44,
      triggerTiming: "菜单弹出前",
      triggerZone: "右键菜单前",
      holdMs: 0,
      soundFile: "tick-light.wav",
    },
    doubleClick: {
      textKind: "数字飘字",
      textStyle: "英文单词 (one, two, three)",
      textMode: "模板模式",
      textTemplate: "combo ${number}",
      textEnabled: true,
      textContent: "combo",
      textTags: ["双击完成", "连击命中", "combo"],
      textTagPlayMode: "随机显示",
      textColor: "#0F766E",
      textDuration: 1100,
      textEasing: "弹性",
      textOpacity: 100,
      textWeight: "加粗",
      textOutlineWidth: 1,
      textShadow: "柔和",
      comboEnabled: true,
      textOffsetX: 0,
      textOffsetY: -30,
      particle: true,
      particleCount: 24,
      particleSpread: 72,
      particleStyle: "火花",
      particleDirection: "四周扩散",
      particleColorMode: "随机轻变化",
      particleDuration: 980,
      particleSize: 16,
      particleOpacity: 96,
      ripple: true,
      rippleSize: 82,
      rippleDuration: 920,
      rippleStyle: "双环",
      rippleEasing: "弹性",
      rippleLineWidth: 3,
      rippleOpacity: 84,
      sound: true,
      fontSize: 24,
      volume: 80,
      playbackRate: 104,
      soundDelay: 0,
      soundFadeOut: 90,
      soundTriggerMode: "连击叠加",
      soundBlendMode: "压低页面音频",
      shake: 50,
      cursorOverride: "木鱼（增强态）",
      cursorSize: 52,
      triggerTiming: "第二次抬起后",
      triggerZone: "双击命中区域",
      holdMs: 320,
      soundFile: "woodfish-deep.wav",
    },
    longPress: {
      textKind: "文本飘字",
      textStyle: "中文数字 (一, 二, 三)",
      textMode: "默认模式 (+1)",
      textTemplate: "你当前点击了${number}次",
      textEnabled: false,
      textContent: "蓄",
      textTags: ["按住中", "蓄力完成", "松开触发"],
      textTagPlayMode: "按顺序显示",
      textColor: "#7C3AED",
      textDuration: 900,
      textEasing: "缓入缓出",
      textOpacity: 94,
      textWeight: "中等",
      textOutlineWidth: 0,
      textShadow: "柔和",
      comboEnabled: false,
      textOffsetX: 0,
      textOffsetY: -22,
      particle: false,
      particleCount: 14,
      particleSpread: 44,
      particleStyle: "碎屑粒子",
      particleDirection: "向上喷发",
      particleColorMode: "跟随主题",
      particleDuration: 720,
      particleSize: 12,
      particleOpacity: 78,
      ripple: false,
      rippleSize: 58,
      rippleDuration: 760,
      rippleStyle: "柔和面波",
      rippleEasing: "缓入缓出",
      rippleLineWidth: 2,
      rippleOpacity: 60,
      sound: true,
      fontSize: 20,
      volume: 72,
      playbackRate: 92,
      soundDelay: 60,
      soundFadeOut: 120,
      soundTriggerMode: "每次触发",
      soundBlendMode: "压低页面音频",
      shake: 58,
      cursorOverride: "木鱼（按压态）",
      cursorSize: 50,
      triggerTiming: "松开后触发",
      triggerZone: "按住后释放",
      holdMs: 560,
      soundFile: "woodfish-deep.wav",
    },
    wheel: {
      textKind: "文本飘字",
      textStyle: "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textTemplate: "你当前点击了${number}次",
      textEnabled: false,
      textContent: "roll",
      textTags: ["向上滚动", "向下滚动", "继续滚动"],
      textTagPlayMode: "随机显示",
      textColor: "#0284C7",
      textDuration: 700,
      textEasing: "线性",
      textOpacity: 90,
      textWeight: "常规",
      textOutlineWidth: 0,
      textShadow: "无",
      comboEnabled: false,
      textOffsetX: 0,
      textOffsetY: -14,
      particle: true,
      particleCount: 10,
      particleSpread: 36,
      particleStyle: "点状粒子",
      particleDirection: "沿点击方向",
      particleColorMode: "跟随飘字色",
      particleDuration: 460,
      particleSize: 10,
      particleOpacity: 72,
      ripple: false,
      rippleSize: 36,
      rippleDuration: 480,
      rippleStyle: "单环",
      rippleEasing: "线性",
      rippleLineWidth: 1,
      rippleOpacity: 44,
      sound: false,
      fontSize: 16,
      volume: 40,
      playbackRate: 110,
      soundDelay: 0,
      soundFadeOut: 30,
      soundTriggerMode: "节流播放",
      soundBlendMode: "保持原音量",
      shake: 16,
      cursorOverride: "跟随当前状态",
      cursorSize: 44,
      triggerTiming: "连续滚动中",
      triggerZone: "向上 / 向下滚轮",
      holdMs: 180,
      soundFile: "tick-light.wav",
    },
    hover: {
      textKind: "文本飘字",
      textStyle: "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textTemplate: "你当前点击了${number}次",
      textEnabled: false,
      textContent: "hover",
      textTags: ["已聚焦", "经过目标", "可点击"],
      textTagPlayMode: "随机显示",
      textColor: "#475569",
      textDuration: 680,
      textEasing: "缓入缓出",
      textOpacity: 88,
      textWeight: "常规",
      textOutlineWidth: 0,
      textShadow: "无",
      comboEnabled: false,
      textOffsetX: 0,
      textOffsetY: -12,
      particle: false,
      particleCount: 8,
      particleSpread: 24,
      particleStyle: "点状粒子",
      particleDirection: "向上喷发",
      particleColorMode: "跟随主题",
      particleDuration: 420,
      particleSize: 8,
      particleOpacity: 60,
      ripple: false,
      rippleSize: 32,
      rippleDuration: 420,
      rippleStyle: "柔和面波",
      rippleEasing: "缓入缓出",
      rippleLineWidth: 1,
      rippleOpacity: 38,
      sound: false,
      fontSize: 16,
      volume: 0,
      playbackRate: 100,
      soundDelay: 0,
      soundFadeOut: 0,
      soundTriggerMode: "节流播放",
      soundBlendMode: "保持原音量",
      shake: 0,
      cursorOverride: "切换到 pointer",
      cursorSize: 44,
      triggerTiming: "停留后",
      triggerZone: "进入可交互元素",
      holdMs: 220,
      soundFile: "tick-light.wav",
    },
  };

  if (themeId === "lite-default") {
    return {
      ...common,
      leftClick: { ...common.leftClick, sound: false, particle: false, fontSize: 18, shake: 12, textColor: "#0F766E" },
      doubleClick: { ...common.doubleClick, sound: false, ripple: false, particle: true, fontSize: 18, shake: 18, textColor: "#0F766E" },
      wheel: { ...common.wheel, particle: false, ripple: false },
    };
  }

  if (themeId === "demo-highlight") {
    return {
      ...common,
      leftClick: { ...common.leftClick, fontSize: 26, volume: 84, shake: 55, particleCount: 26, rippleSize: 88 },
      doubleClick: { ...common.doubleClick, fontSize: 28, particle: true, ripple: true, sound: true, shake: 68, particleCount: 32, rippleSize: 96 },
      hover: { ...common.hover, ripple: true },
    };
  }

  if (themeId === "petal") {
    return {
      ...common,
      leftClick: { ...common.leftClick, textStyle: "中文数字 (一, 二, 三)", volume: 68, shake: 26, textColor: "#BE185D" },
      doubleClick: { ...common.doubleClick, textStyle: "中文数字 (一, 二, 三)", volume: 64, textColor: "#BE185D" },
      wheel: { ...common.wheel, particle: true, ripple: true },
    };
  }

  return common;
}

export function createThemeDraft(themeId) {
  return {
    siteMode: themeId === "demo-highlight" ? "当前启用" : "跟随全局",
    actionConfigs: getDefaultActionConfigs(themeId),
    cursorModes: Object.fromEntries(CURSOR_STATES.map((item) => [item.id, item.defaultMode])),
    cursorStateActions: buildDefaultCursorStateActions(),
    cursorStateAssets: buildDefaultCursorStateAssets(),
  };
}

export function buildThemeDrafts(themes = THEMES) {
  return Object.fromEntries((themes || []).map((theme) => [theme.id, createThemeDraft(theme.id)]));
}

export function getTimingFieldMeta(actionId) {
  if (actionId === "longPress") {
    return { label: "长按阈值", hint: "按住多久以后才算长按。", min: 200, max: 900 };
  }
  if (actionId === "doubleClick") {
    return { label: "双击间隔", hint: "两次点击之间允许的最大间隔。", min: 180, max: 520 };
  }
  if (actionId === "hover") {
    return { label: "停留阈值", hint: "鼠标停多久之后再触发 hover 效果。", min: 80, max: 700 };
  }
  if (actionId === "wheel") {
    return { label: "合并间隔", hint: "连续滚动时，多久合并为一次反馈。", min: 80, max: 520 };
  }
  return { label: "触发延迟", hint: "动作识别后，延迟多久开始反馈。", min: 0, max: 320 };
}

export function getConflictsForAction(actionId, actionConfigs) {
  const current = actionConfigs[actionId];
  const conflicts = [];

  if (actionId === "longPress" && current.sound && actionConfigs.leftClick.sound) {
    conflicts.push("长按和左键单击都在使用音效，后续需要明确谁先触发。");
  }

  if (actionId === "hover" && (current.ripple || current.particle)) {
    conflicts.push("悬停已经带视觉反馈，后续要明确是否覆盖 pointer 状态。");
  }

  if (!current.textEnabled && !current.particle && !current.ripple && !current.sound) {
    conflicts.push("当前动作没有绑定任何反馈，用户点击时会感觉没效果。");
  }

  return conflicts;
}
