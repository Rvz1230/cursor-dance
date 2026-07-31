const MODE_RULES = {
  modify_action: [
    "只修改当前动作，targets 默认只返回当前 actionId。",
    "必须返回可执行 patch；如果用户意图明确但字段缺失，要补齐必要字段。",
  ],
  tune_proposal: [
    "当前是微调模式：必须基于 proposalContext 做增量微调。",
    "只返回本次需要调整的字段，不要完全重写上一版方案。",
  ],
};

const FIELD_MODULES = {
  text: {
    keywords: ["飘字", "数字", "文字", "文案", "文本", "计数", "连击", "combo", "+1", "加一", "内容", "模板", "候选"],
    rules: [
      "飘字类型 textKind 可选：数字飘字、文本飘字。",
      "数字飘字必须设置：textEnabled=true, textKind=\"数字飘字\", textStyle, textMode。",
      "数字 +1 默认模式必须设置：textEnabled=true, textKind=\"数字飘字\", textStyle=\"阿拉伯数字 (1, 2, 3)\", textMode=\"默认模式 (+1)\", textContent=\"+1\", textTemplate=\"${number}\", textTags=[], comboEnabled=false，除非用户明确要求连击累加。",
      "数字模板模式必须设置：textEnabled=true, textKind=\"数字飘字\", textMode=\"模板模式\", textTemplate 必须包含 \"${number}\"。",
      "文本飘字必须设置：textEnabled=true, textKind=\"文本飘字\", textContent 为主文案, textTags 为候选文案数组, comboEnabled=false。",
      "不要把 textContent 改成 '+1' 却遗漏 textKind；如果用户说数字、+1、加一、默认模式，必须切换 textKind 和 textMode。",
    ],
  },
  particle: {
    keywords: ["粒子", "颗粒", "火花", "星光", "碎屑", "钻石", "心形", "方块", "三角", "喷发", "扩散"],
    rules: [
      "粒子字段：particle, particleCount, particleSpread, particleStyle, particleDirection, particleColorMode, particleDuration, particleSize, particleOpacity。",
    ],
  },
  ripple: {
    keywords: ["波纹", "水波", "涟漪", "环", "脉冲", "回声", "面波"],
    rules: [
      "波纹字段：ripple, rippleSize, rippleDuration, rippleStyle, rippleEasing, rippleLineWidth, rippleOpacity。",
    ],
  },
  audio: {
    keywords: ["声音", "音效", "静音", "音量", "播放", "混音", "木鱼", "听", "响"],
    rules: [
      "音效字段：sound, volume, soundFile, soundTriggerMode, soundBlendMode。用户说不要声音时必须设置 sound=false, volume=0。",
    ],
  },
  cursor: {
    keywords: ["光标", "鼠标", "震动", "大小", "指针", "尺寸"],
    rules: ["光标反馈字段：shake, cursorOverride, cursorSize。"],
  },
  animation: {
    keywords: ["动画", "弹跳", "旋转", "聚焦", "斜切", "轨道", "螺旋", "闪耀", "徽记"],
    rules: [
      "动画字段：animationEnabled, animationStyle, animationDuration, animationScale, animationOpacity, animationOffsetX, animationOffsetY。",
    ],
  },
  image: {
    keywords: ["图片", "图像", "贴图", "图标", "表情", "emoji", "gif"],
    rules: [
      "图像字段：imageEnabled, imageDataUrl, imageDuration, imageSize, imageOpacity, imageOffsetX, imageOffsetY。",
    ],
  },
};

export function selectPromptModules(prompt = "", currentConfig = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) return Object.keys(FIELD_MODULES);

  const active = new Set();
  for (const [name, module] of Object.entries(FIELD_MODULES)) {
    if (module.keywords.some((keyword) => prompt.includes(keyword))) active.add(name);
  }

  if (currentConfig?.textEnabled) active.add("text");
  if (currentConfig?.particle) active.add("particle");
  if (currentConfig?.ripple) active.add("ripple");
  if (currentConfig?.sound) active.add("audio");
  if (currentConfig?.animationEnabled) active.add("animation");
  if (currentConfig?.imageEnabled) active.add("image");
  active.add("cursor");

  return [...active];
}

export function buildSystemPrompt(taskMode = "modify_action", prompt = "", currentConfig = {}) {
  const modeRules = MODE_RULES[taskMode] || MODE_RULES.modify_action;
  const fieldRules = selectPromptModules(prompt, currentConfig)
    .flatMap((name) => FIELD_MODULES[name]?.rules || []);

  return [
    "你是 CursorDance 的 AI 方案设计师，兼具资深 UED 和可执行配置工程师能力。",
    "你的任务不是机械改字段，而是理解用户场景，生成可预览、可解释、可微调的鼠标反馈方案。",
    "只输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。",
    "返回的是方案提案 proposal，不是最终写入结果。",
    "重要：你只能处理与鼠标点击效果、光标反馈、页面交互视觉特效相关的需求。",
    "如果用户的需求与这些完全无关（例如问天气、写代码、闲聊、写诗、翻译等），必须礼貌拒绝：",
    "targets 返回空数组 []，reply 中说明你只能处理 CursorDance 鼠标反馈配置，",
    "tuningOptions 给出 3 个与鼠标反馈相关的引导性示例，riskLevel 设为 \"low\"。",
    "mode 取值为 modify_action 或 tune_proposal。",
    "scheme 描述方案名称、摘要、风格标签和设计理由。",
    "targets 是需要修改的动作列表。target.type 当前只能是 action。",
    "patch 只能表达需要修改的字段，不能返回 CSS、HTML、JS、代码或未知字段。",
    "你必须按 CursorDance 的配置字段操作，字段名和值必须完全匹配下面的配置字典。",
    ...fieldRules,
    ...modeRules,
    "riskLevel 必须是 low、medium 或 high。",
    "优先保持低干扰、可预览、可撤销；如果用户要求低调，就降低粒子、声音、震动和持续时间。",
    "tuningOptions 给出 3 到 6 个用户下一步可点击的短选项。",
    "所有回复字段使用中文。",
  ].join("\n");
}

export function buildUserPrompt({
  prompt,
  actionId,
  actionLabel,
  currentConfig,
  taskMode,
  proposalContext,
  extensionVersion,
  schemaVersion,
}) {
  return [
    `扩展版本：${extensionVersion || "unknown"}`,
    `Schema 版本：${schemaVersion || "unknown"}`,
    `任务模式：${taskMode || "modify_action"}`,
    `当前动作 ID：${actionId || "leftClick"}`,
    `当前动作名称：${actionLabel || "当前动作"}`,
    "可用动作 ID：leftClick, rightClick, doubleClick, longPress, wheel, hover",
    "当前配置 JSON：",
    JSON.stringify(currentConfig || {}),
    proposalContext ? "上一版 proposal 精简上下文 JSON：" : "",
    proposalContext ? JSON.stringify(proposalContext) : "",
    "用户需求：",
    prompt || "",
    "请返回 JSON（重要：reply 字段放在最前面，让用户尽早看到回复内容）：{ \"reply\": string, \"mode\": string, \"scheme\": { \"name\": string, \"summary\": string, \"styleTags\": string[], \"rationale\": string }, \"targets\": [{ \"type\": \"action\", \"actionId\": string, \"label\": string, \"patch\": object }], \"diffSummary\": string[], \"riskLevel\": \"low\" | \"medium\" | \"high\", \"warnings\": string[], \"tuningOptions\": string[] }",
  ].join("\n");
}
