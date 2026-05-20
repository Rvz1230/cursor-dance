const NUMERIC_LIMITS = {
  fontSize: [12, 36],
  textDuration: [240, 1800],
  textOpacity: [20, 100],
  textOffsetX: [-72, 72],
  textOffsetY: [-72, 24],
  textOutlineWidth: [0, 3],
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
  animationDuration: [120, 1800],
  animationScale: [50, 180],
  animationOpacity: [10, 100],
  animationOffsetX: [-72, 72],
  animationOffsetY: [-72, 72],
  imageDuration: [120, 1800],
  imageSize: [24, 180],
  imageOpacity: [10, 100],
  imageOffsetX: [-120, 120],
  imageOffsetY: [-120, 120],
};

const ENUM_OPTIONS = {
  triggerTiming: ["按下时", "抬起时", "菜单弹出前", "第二次按下时", "第二次抬起后", "按住达到阈值", "松开后触发", "滚动开始时", "连续滚动中", "进入时", "停留后"],
  triggerZone: ["当前页面可点击区域", "仅按钮和链接", "全部可交互元素", "右键菜单前", "可交互元素", "空白区域", "双击命中区域", "主操作按钮", "内容卡片", "按住后释放", "长按可交互元素", "全局长按区", "向上 / 向下滚轮", "仅向上滚动", "仅向下滚动", "进入可交互元素", "全页面 hover"],
  textKind: ["数字飘字", "文本飘字"],
  textStyle: ["阿拉伯数字 (1, 2, 3)", "中文数字 (一, 二, 三)", "英文单词 (one, two, three)"],
  textMode: ["默认模式 (+1)", "模板模式"],
  textTagPlayMode: ["按顺序显示", "随机显示"],
  textEasing: ["线性", "缓入", "缓出", "缓入缓出", "弹跳", "弹性"],
  textWeight: ["常规", "中等", "加粗"],
  textShadow: ["无", "柔和", "清晰"],
  particleStyle: ["点状粒子", "碎屑粒子", "火花"],
  particleDirection: ["四周扩散", "向上喷发", "沿点击方向"],
  particleColorMode: ["跟随主题", "跟随飘字色", "随机轻变化"],
  rippleStyle: ["单环", "双环", "柔和面波"],
  rippleEasing: ["线性", "缓出", "缓入缓出", "弹性"],
  soundTriggerMode: ["每次触发", "连击叠加", "节流播放"],
  soundBlendMode: ["保持原音量", "压低页面音频", "仅插件音效"],
  soundFile: ["woodfish-soft.wav", "woodfish-deep.wav", "tick-light.wav"],
  cursorOverride: ["跟随当前状态", "木鱼（继承默认）", "木鱼（增强态）", "木鱼（按压态）", "切换到 pointer"],
  animationStyle: ["聚焦脉冲", "斜切闪片", "弹跳徽记"],
};

const BOOLEAN_FIELDS = new Set([
  "textEnabled",
  "comboEnabled",
  "particle",
  "ripple",
  "sound",
  "animationEnabled",
  "imageEnabled",
]);

const STRING_FIELDS = new Set([
  "textTemplate",
  "textContent",
  "textColor",
  "imageDataUrl",
]);

const ARRAY_FIELDS = new Set(["textTags"]);

const AI_SCHEME_PATCH_FIELDS = new Set([
  ...Object.keys(NUMERIC_LIMITS),
  ...Object.keys(ENUM_OPTIONS),
  ...BOOLEAN_FIELDS,
  ...STRING_FIELDS,
  ...ARRAY_FIELDS,
]);

const DEFAULT_API_ENDPOINT = "/api/ai/scheme-proposals";
const VALID_PROPOSAL_MODES = new Set(["modify_action", "generate_theme", "explain_config", "tune_proposal"]);
export const AI_EXTENSION_VERSION = "0.1.0";
export const AI_SCHEMA_VERSION = "2026-05-20";
const MAX_PROPOSAL_CONTEXT_BYTES = 8 * 1024;

const FIELD_LABELS = {
  textEnabled: "飘字",
  textKind: "飘字类型",
  textContent: "飘字文案",
  textTags: "候选文案",
  textColor: "主色",
  fontSize: "字号",
  textDuration: "飘字时长",
  textOpacity: "飘字透明度",
  particle: "粒子",
  particleCount: "粒子数量",
  particleSpread: "粒子范围",
  particleDuration: "粒子时长",
  particleSize: "粒子尺寸",
  particleOpacity: "粒子透明度",
  particleStyle: "粒子样式",
  particleDirection: "粒子方向",
  particleColorMode: "粒子颜色",
  ripple: "波纹",
  rippleSize: "波纹尺寸",
  rippleDuration: "波纹时长",
  rippleOpacity: "波纹透明度",
  rippleStyle: "波纹样式",
  sound: "音效",
  volume: "音量",
  soundFile: "音效文件",
  shake: "震动强度",
  cursorOverride: "光标反馈",
  cursorSize: "光标尺寸",
  holdMs: "触发延迟",
};

const AI_TASK_MODES = {
  modify_action: "修改当前动作",
  explain_config: "解释配置",
  generate_theme: "生成主题方案",
  tune_proposal: "微调上一版方案",
};

function createProposalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNumber(fieldName, value) {
  const limits = NUMERIC_LIMITS[fieldName];
  if (!limits) return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return limits[0];
  return Math.min(limits[1], Math.max(limits[0], Math.round(numericValue)));
}

function mergeActionConfig(baseConfig = {}, ...overlays) {
  return overlays.reduce(
    (mergedConfig, overlay) => ({
      ...mergedConfig,
      ...(overlay || {}),
      textTags: Array.isArray(overlay?.textTags)
        ? [...overlay.textTags]
        : mergedConfig.textTags,
    }),
    {
      ...baseConfig,
      textTags: Array.isArray(baseConfig?.textTags) ? [...baseConfig.textTags] : [],
    }
  );
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
}

function sanitizePatchValue(fieldName, value) {
  if (Object.prototype.hasOwnProperty.call(NUMERIC_LIMITS, fieldName)) {
    return clampNumber(fieldName, value);
  }
  if (Object.prototype.hasOwnProperty.call(ENUM_OPTIONS, fieldName)) {
    return ENUM_OPTIONS[fieldName].includes(value) ? value : undefined;
  }
  if (BOOLEAN_FIELDS.has(fieldName)) {
    return typeof value === "boolean" ? value : undefined;
  }
  if (fieldName === "textColor") {
    return normalizeHexColor(value) ?? undefined;
  }
  if (STRING_FIELDS.has(fieldName)) {
    return typeof value === "string" ? value.slice(0, 500) : undefined;
  }
  if (ARRAY_FIELDS.has(fieldName)) {
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return undefined;
}

function normalizeIntentText(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

function wantsDefaultNumberPlusOneMode(prompt) {
  const normalized = normalizeIntentText(prompt);
  return (
    (normalized.includes("数字") || normalized.includes("+1") || normalized.includes("加1"))
    && (
      normalized.includes("+1模式")
      || normalized.includes("数字+1")
      || normalized.includes("数字加1")
      || normalized.includes("默认模式")
      || normalized.includes("换成数字")
      || normalized.includes("改成数字")
      || normalized.includes("数字飘字")
    )
  );
}

function wantsTemplateNumberMode(prompt) {
  const normalized = normalizeIntentText(prompt);
  return normalized.includes("模板") && (normalized.includes("数字") || normalized.includes("${number}") || normalized.includes("number"));
}

function wantsTextFloatMode(prompt) {
  const normalized = normalizeIntentText(prompt);
  return normalized.includes("文本飘字") || normalized.includes("文字飘字") || normalized.includes("文案飘字");
}

function wantsSoundOff(prompt) {
  const normalized = normalizeIntentText(prompt);
  return normalized.includes("不要声音") || normalized.includes("关闭声音") || normalized.includes("关掉声音") || normalized.includes("静音") || normalized.includes("无声音") || normalized.includes("不要音效") || normalized.includes("关闭音效");
}

function wantsParticleReduction(prompt) {
  const normalized = normalizeIntentText(prompt);
  return (normalized.includes("粒子") || normalized.includes("颗粒")) && (normalized.includes("少一点") || normalized.includes("减少") || normalized.includes("降低") || normalized.includes("低调"));
}

function wantsParticleOff(prompt) {
  const normalized = normalizeIntentText(prompt);
  return normalized.includes("关闭粒子") || normalized.includes("关掉粒子") || normalized.includes("不要粒子") || normalized.includes("无粒子");
}

function wantsRippleOnly(prompt) {
  const normalized = normalizeIntentText(prompt);
  return normalized.includes("只保留波纹") || normalized.includes("仅保留波纹") || normalized.includes("只要波纹") || normalized.includes("仅要波纹");
}

function repairPatchForUserIntent(patch, requestState = {}) {
  const prompt = requestState.prompt || "";
  const currentConfig = requestState.currentConfig || {};
  const repairedPatch = { ...patch };

  if (wantsDefaultNumberPlusOneMode(prompt)) {
    Object.assign(repairedPatch, {
      textEnabled: true,
      textKind: "数字飘字",
      textStyle: repairedPatch.textStyle || "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textContent: "+1",
      textTemplate: repairedPatch.textTemplate || "${number}",
      textTags: [],
      comboEnabled: Boolean(repairedPatch.comboEnabled),
    });
  }

  if (wantsTemplateNumberMode(prompt)) {
    Object.assign(repairedPatch, {
      textEnabled: true,
      textKind: "数字飘字",
      textStyle: repairedPatch.textStyle || "阿拉伯数字 (1, 2, 3)",
      textMode: "模板模式",
      textTemplate: typeof repairedPatch.textTemplate === "string" && repairedPatch.textTemplate.includes("${number}")
        ? repairedPatch.textTemplate
        : "你当前点击了${number}次",
      textContent: "",
    });
  }

  if (repairedPatch.textKind === "数字飘字") {
    repairedPatch.textEnabled = true;
    repairedPatch.textTags = Array.isArray(repairedPatch.textTags) ? repairedPatch.textTags : [];
    repairedPatch.textStyle = repairedPatch.textStyle || "阿拉伯数字 (1, 2, 3)";
    repairedPatch.textMode = repairedPatch.textMode || "默认模式 (+1)";
    repairedPatch.textTemplate = repairedPatch.textTemplate || "${number}";
    if (repairedPatch.textMode === "默认模式 (+1)") {
      repairedPatch.textContent = "+1";
    }
  }

  if (repairedPatch.textKind === "文本飘字") {
    repairedPatch.textEnabled = true;
    repairedPatch.comboEnabled = false;
    repairedPatch.textContent = typeof repairedPatch.textContent === "string" && repairedPatch.textContent.trim()
      ? repairedPatch.textContent
      : (typeof currentConfig.textContent === "string" && currentConfig.textContent.trim() ? currentConfig.textContent : "Nice");
    repairedPatch.textTags = Array.isArray(repairedPatch.textTags) ? repairedPatch.textTags : [];
  }

  if (wantsTextFloatMode(prompt)) {
    Object.assign(repairedPatch, {
      textEnabled: true,
      textKind: "文本飘字",
      textMode: "模板模式",
      textContent: typeof repairedPatch.textContent === "string" && repairedPatch.textContent.trim()
        ? repairedPatch.textContent
        : (typeof currentConfig.textContent === "string" && currentConfig.textContent.trim() ? currentConfig.textContent : "Nice"),
      textTags: Array.isArray(repairedPatch.textTags) ? repairedPatch.textTags : [],
      comboEnabled: false,
    });
  }

  if (wantsSoundOff(prompt)) {
    Object.assign(repairedPatch, {
      sound: false,
      volume: 0,
    });
  }

  if (wantsParticleReduction(prompt) && !wantsParticleOff(prompt)) {
    const currentCount = Number.isFinite(Number(currentConfig.particleCount)) ? Number(currentConfig.particleCount) : 18;
    Object.assign(repairedPatch, {
      particle: true,
      particleCount: Math.max(1, Math.min(12, Math.round(currentCount * 0.5))),
      particleOpacity: repairedPatch.particleOpacity ?? Math.min(55, Number(currentConfig.particleOpacity) || 55),
    });
  }

  if (wantsParticleOff(prompt)) {
    Object.assign(repairedPatch, {
      particle: false,
      particleCount: 0,
    });
  }

  if (wantsRippleOnly(prompt)) {
    Object.assign(repairedPatch, {
      textEnabled: false,
      particle: false,
      particleCount: 0,
      ripple: true,
      sound: false,
      volume: 0,
      animationEnabled: false,
      imageEnabled: false,
    });
  }

  return sanitizeAiSchemePatch(repairedPatch);
}

export function sanitizeAiSchemePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([fieldName]) => AI_SCHEME_PATCH_FIELDS.has(fieldName))
      .map(([fieldName, value]) => [fieldName, sanitizePatchValue(fieldName, value)])
      .filter(([, value]) => value !== undefined)
  );
}

export function getAiPatchSanitizeMeta(rawPatch, sanitizedPatch = sanitizeAiSchemePatch(rawPatch)) {
  const rawKeys = rawPatch && typeof rawPatch === "object" && !Array.isArray(rawPatch) ? Object.keys(rawPatch) : [];
  const sanitizedKeys = Object.keys(sanitizedPatch || {});
  return {
    rawFieldCount: rawKeys.length,
    acceptedFieldCount: sanitizedKeys.length,
    droppedFieldCount: Math.max(0, rawKeys.length - sanitizedKeys.length),
    droppedFields: rawKeys.filter((fieldName) => !sanitizedKeys.includes(fieldName)),
  };
}

export function validateAiSchemeRequest(payload) {
  const errors = [];
  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
  const actionId = typeof payload?.actionId === "string" ? payload.actionId : "leftClick";
  const actionLabel = typeof payload?.actionLabel === "string" ? payload.actionLabel : "";
  const taskMode = Object.prototype.hasOwnProperty.call(AI_TASK_MODES, payload?.taskMode)
    ? payload.taskMode
    : "modify_action";
  const currentConfig =
    payload?.currentConfig && typeof payload.currentConfig === "object" && !Array.isArray(payload.currentConfig)
      ? payload.currentConfig
      : {};
  const proposalContext =
    payload?.proposalContext && typeof payload.proposalContext === "object" && !Array.isArray(payload.proposalContext)
      ? payload.proposalContext
      : null;
  const extensionVersion = typeof payload?.extensionVersion === "string" ? payload.extensionVersion.slice(0, 32) : "";
  const schemaVersion = typeof payload?.schemaVersion === "string" ? payload.schemaVersion.slice(0, 32) : "";

  if (!prompt) errors.push("prompt is required");
  if (prompt.length > 1200) errors.push("prompt is too long");
  if (proposalContext && JSON.stringify(proposalContext).length > MAX_PROPOSAL_CONTEXT_BYTES) {
    errors.push("proposalContext is too large");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      prompt,
      actionId,
      actionLabel,
      taskMode,
      currentConfig,
      proposalContext,
      extensionVersion,
      schemaVersion,
    },
  };
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

function formatDiffValue(value) {
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (Array.isArray(value)) return value.join("、") || "空";
  if (value === undefined || value === null || value === "") return "空";
  return String(value);
}

export function buildAiSchemeDiffItems(currentConfig = {}, patch = {}) {
  return Object.entries(sanitizeAiSchemePatch(patch))
    .filter(([fieldName, nextValue]) => currentConfig?.[fieldName] !== nextValue)
    .map(([fieldName, nextValue]) => ({
      fieldName,
      label: FIELD_LABELS[fieldName] || fieldName,
      before: currentConfig?.[fieldName],
      after: nextValue,
      beforeLabel: formatDiffValue(currentConfig?.[fieldName]),
      afterLabel: formatDiffValue(nextValue),
    }));
}

function normalizeAiSchemeInfo(scheme = {}, requestState = {}) {
  const modeLabel = AI_TASK_MODES[requestState.taskMode] || "AI 方案";
  return {
    name: typeof scheme?.name === "string" && scheme.name.trim() ? scheme.name.trim().slice(0, 48) : modeLabel,
    summary: typeof scheme?.summary === "string" && scheme.summary.trim() ? scheme.summary.trim().slice(0, 160) : "基于当前配置生成的 AI 方案。",
    styleTags: Array.isArray(scheme?.styleTags)
      ? scheme.styleTags.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 6)
      : [],
    rationale: typeof scheme?.rationale === "string" && scheme.rationale.trim() ? scheme.rationale.trim().slice(0, 500) : "",
  };
}

function normalizeAiSchemeTarget(target = {}, requestState = {}) {
  const rawPatch = target.patch && typeof target.patch === "object" ? target.patch : {};
  const patch = repairPatchForUserIntent(sanitizeAiSchemePatch(rawPatch), requestState);
  return {
    type: target.type || "action",
    actionId: typeof target.actionId === "string" && target.actionId ? target.actionId : requestState.actionId || "leftClick",
    label: typeof target.label === "string" && target.label ? target.label : requestState.actionLabel || "当前动作",
    patch,
    sanitizeMeta: getAiPatchSanitizeMeta(rawPatch, patch),
  };
}

function normalizeAiSchemeTargets(payload = {}, requestState = {}) {
  const rawTargets = Array.isArray(payload.targets) && payload.targets.length
    ? payload.targets
    : [{
        type: payload.target?.type || "action",
        actionId: payload.target?.actionId || requestState.actionId,
        label: payload.target?.label || requestState.actionLabel,
        patch: payload.patch,
      }];
  return rawTargets
    .map((target) => normalizeAiSchemeTarget(target, requestState))
    .filter((target) => target.type === "action");
}

function getPrimaryTarget(targets, requestState = {}) {
  return targets.find((target) => target.actionId === requestState.actionId) || targets[0] || normalizeAiSchemeTarget({}, requestState);
}

export function getAiProposalPatchForAction(proposal, actionId) {
  const target = proposal?.targets?.find((item) => item.type === "action" && item.actionId === actionId);
  return target?.patch || null;
}

export function getAiProposalNextConfigForAction(proposal, actionId, currentConfig = {}) {
  const patch = getAiProposalPatchForAction(proposal, actionId);
  return patch ? mergeActionConfig(currentConfig, patch) : null;
}

function normalizeProposalMode(payload = {}, requestState = {}) {
  const candidate = payload.mode || payload.intent || requestState.taskMode || "modify_action";
  if (candidate === "generate_action") return "generate_theme";
  return VALID_PROPOSAL_MODES.has(candidate) ? candidate : "modify_action";
}

export function normalizeAiSchemeProposal(payload = {}, requestState = {}) {
  const targets = normalizeAiSchemeTargets(payload, requestState);
  const primaryTarget = getPrimaryTarget(targets, requestState);
  const patch = primaryTarget.patch;
  const currentConfig = requestState.currentConfig || {};
  const mode = normalizeProposalMode(payload, requestState);
  const riskLevel = ["low", "medium", "high"].includes(payload.riskLevel) ? payload.riskLevel : "low";
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
    : [];

  return {
    proposalId: typeof payload.proposalId === "string" && payload.proposalId ? payload.proposalId : createProposalId(),
    schemaVersion: typeof payload.schemaVersion === "string" && payload.schemaVersion ? payload.schemaVersion : requestState.schemaVersion || AI_SCHEMA_VERSION,
    mode,
    intent: payload.intent || mode,
    scheme: normalizeAiSchemeInfo(payload.scheme, requestState),
    target: {
      type: primaryTarget.type,
      actionId: primaryTarget.actionId,
      label: primaryTarget.label,
    },
    targets,
    riskLevel,
    warnings,
    source: payload.source || "api",
    reply: typeof payload.reply === "string" && payload.reply.trim() ? payload.reply.trim() : "我已生成一版可执行配置。",
    patch,
    sanitizeMeta: payload.sanitizeMeta || primaryTarget.sanitizeMeta,
    nextConfig: mergeActionConfig(currentConfig, patch),
    diffItems: buildAiSchemeDiffItems(currentConfig, patch),
    diffSummary: Array.isArray(payload.diffSummary)
      ? payload.diffSummary.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
      : describeDiff(patch),
    tuningOptions: Array.isArray(payload.tuningOptions)
      ? payload.tuningOptions.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 6)
      : [],
  };
}

export function buildAiProposalContext(proposal) {
  if (!proposal) return null;
  const context = {
    proposalId: proposal.proposalId,
    schemaVersion: proposal.schemaVersion || AI_SCHEMA_VERSION,
    mode: proposal.mode,
    scheme: proposal.scheme
      ? {
          name: proposal.scheme.name,
          summary: proposal.scheme.summary,
          styleTags: proposal.scheme.styleTags,
        }
      : undefined,
    targets: Array.isArray(proposal.targets)
      ? proposal.targets.slice(0, 6).map((target) => ({
          type: target.type,
          actionId: target.actionId,
          label: target.label,
          patch: sanitizeAiSchemePatch(target.patch),
        }))
      : [],
    diffSummary: Array.isArray(proposal.diffSummary) ? proposal.diffSummary.slice(0, 5) : [],
  };

  return JSON.stringify(context).length <= MAX_PROPOSAL_CONTEXT_BYTES ? context : {
    proposalId: context.proposalId,
    schemaVersion: context.schemaVersion,
    mode: context.mode,
    targets: context.targets.slice(0, 3),
  };
}

export function getAiRequestErrorMessage(error) {
  const code = error?.code || "";
  const status = error?.status;
  const message = error instanceof Error
    ? error.message
    : (typeof error?.message === "string" ? error.message : String(error || ""));

  if (code === "timeout") return "AI 请求超时，请稍后重试。";
  if (code === "network") return "后端未连接，请确认 AI API 服务已启动。";
  if (status === 401 || status === 403) return "AI API 权限校验失败，请检查访问 token。";
  if (status === 400 || status === 413 || code === "invalid_request") return message || "请求内容超出限制，请缩短描述后重试。";
  if (status === 422 || code === "invalid_schema") return "AI 返回结构无效，已拒绝应用，请重新生成。";
  if (status === 502 || status === 503 || code === "provider_failed") return message || "DeepSeek 服务暂时失败，请稍后重试。";
  return message || "生成失败，请稍后重试。";
}

async function requestRemoteAiSchemeEdit({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext }) {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    throw new Error("Browser fetch is unavailable.");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  const endpoint = import.meta.env?.VITE_CURSORDANCE_AI_API_ENDPOINT || DEFAULT_API_ENDPOINT;
  const accessToken = import.meta.env?.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN || "";
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  try {
    const response = await window.fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        currentConfig,
        proposalContext: buildAiProposalContext(proposalContext),
        actionLabel,
        actionId,
        taskMode,
        extensionVersion: AI_EXTENSION_VERSION,
        schemaVersion: AI_SCHEMA_VERSION,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let errorMessage = `AI API responded with ${response.status}`;
      let errorCode = response.status === 401 || response.status === 403 ? "permission_denied" : "api_failed";
      try {
        const errorPayload = await response.json();
        if (typeof errorPayload?.error === "string" && errorPayload.error.trim()) {
          errorMessage = errorPayload.error.trim();
        }
        if (typeof errorPayload?.details === "string" && errorPayload.details.trim()) {
          errorMessage = `${errorMessage}: ${errorPayload.details.trim()}`;
        }
        if (typeof errorPayload?.code === "string" && errorPayload.code.trim()) {
          errorCode = errorPayload.code.trim();
        }
      } catch {
        // Keep the original status-based error when the backend does not return JSON.
      }
      const requestError = new Error(errorMessage);
      requestError.status = response.status;
      requestError.code = errorCode;
      throw requestError;
    }
    const payload = await response.json();
    return normalizeAiSchemeProposal(
      {
        ...payload,
        source: payload.source || "api",
      },
      { currentConfig, actionLabel, actionId, taskMode, schemaVersion: payload.schemaVersion || AI_SCHEMA_VERSION }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("AI 请求超时，请确认模型服务可用后重试。");
      timeoutError.code = "timeout";
      throw timeoutError;
    }
    if (error instanceof TypeError) {
      const networkError = new Error("后端未连接，请确认 AI API 服务已启动。");
      networkError.code = "network";
      throw networkError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function requestAiSchemeEdit({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext }) {
  return requestRemoteAiSchemeEdit({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext });
}
