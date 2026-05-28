import { sanitizeAiSchemePatch } from "./sanitize.js";
import { repairPatchForUserIntent } from "./intent-repair.js";
import { mergeActionConfig } from "./sanitize.js";

const PATCH_FIELD_HINTS = [
  "textEnabled (boolean)",
  "textKind ('数字飘字' | '文本飘字')",
  "textStyle ('阿拉伯数字 (1, 2, 3)' | '中文数字 (一, 二, 三)' | '英文单词 (one, two, three)')",
  "textMode ('默认模式 (+1)' | '模板模式')",
  "textTemplate (string, use ${number} placeholder)",
  "textContent (string)",
  "textTags (string[])",
  "textColor (hex color, e.g. #0284C7)",
  "fontSize (12-36)",
  "textDuration (240-1800 ms)",
  "textOpacity (20-100)",
  "textEasing ('线性' | '缓入' | '缓出' | '缓入缓出' | '弹跳' | '弹性')",
  "comboEnabled (boolean)",
  "particle (boolean)",
  "particleCount (0-40)",
  "particleStyle ('点状粒子' | '碎屑粒子' | '火花' | '星光' | '钻石' | '心形' | '方块' | '三角')",
  "particleOpacity (20-100)",
  "particleDuration (180-1600 ms)",
  "particleSize (4-28)",
  "particleSpread (8-120)",
  "particleDirection ('四周扩散' | '向上喷发' | '沿点击方向')",
  "particleColorMode ('跟随主题' | '跟随飘字色' | '随机轻变化')",
  "ripple (boolean)",
  "rippleSize (20-140)",
  "rippleDuration (180-1600 ms)",
  "rippleOpacity (10-100)",
  "rippleStyle ('单环' | '双环' | '柔和面波' | '脉冲波纹' | '回声环' | '能量脉冲')",
  "rippleEasing ('线性' | '缓出' | '缓入缓出' | '弹性')",
  "rippleLineWidth (1-6)",
  "sound (boolean)",
  "volume (0-100)",
  "soundFile ('woodfish-soft.wav' | 'woodfish-deep.wav' | 'tick-light.wav')",
  "soundTriggerMode ('每次触发' | '连击叠加' | '节流播放')",
  "shake (0-90)",
  "cursorSize (32-64)",
  "animationEnabled (boolean)",
  "animationStyle ('聚焦脉冲' | '斜切闪片' | '弹跳徽记' | '漩涡旋转' | '星光闪耀' | '轨道环绕' | '螺旋上升')",
  "animationDuration (120-1800 ms)",
  "animationScale (50-180)",
  "animationOpacity (10-100)",
  "imageEnabled (boolean)",
  "imageSize (24-180)",
  "imageOpacity (10-100)",
  "imageDuration (120-1800 ms)",
].join(", ");

const ACTION_IDS = ["leftClick", "rightClick", "doubleClick", "longPress", "wheel", "hover"];

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "apply_config_patch",
      description:
        "Apply a partial config patch to a mouse action. Use this after reasoning about what the user needs. Only include fields you want to change. The patch will be safety-sanitized before applying. Available fields: " +
        PATCH_FIELD_HINTS,
      parameters: {
        type: "object",
        properties: {
          actionId: {
            type: "string",
            enum: ACTION_IDS,
            description: "The action ID to apply the patch to.",
          },
          patch: {
            type: "object",
            description: "Partial action config. Only include fields to change.",
            additionalProperties: true,
          },
          reason: {
            type: "string",
            description: "Brief Chinese explanation of why this change addresses the user's intent.",
          },
        },
        required: ["actionId", "patch"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_config",
      description:
        "Read the full current config for a specific action. Use when you need to inspect state before making changes, or when the user asks what the current setup looks like.",
      parameters: {
        type: "object",
        properties: {
          actionId: {
            type: "string",
            enum: ACTION_IDS,
            description: "The action ID to read config for.",
          },
        },
        required: ["actionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rollback",
      description:
        "Undo the most recent apply_config_patch. Use this when a config change didn't produce the expected effect and you need to revert it before trying a different approach.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize_proposal",
      description:
        "Finalize the proposal after making all necessary config changes. Wraps up the agent run and returns the full proposal. Call when satisfied or when the user's intent is fully addressed.",
      parameters: {
        type: "object",
        properties: {
          scheme: {
            type: "object",
            description: "Theme scheme metadata.",
            properties: {
              name: { type: "string", description: "Short theme name in Chinese." },
              summary: { type: "string", description: "One-sentence summary." },
              styleTags: { type: "array", items: { type: "string" }, description: "2-5 style tags." },
              rationale: { type: "string", description: "Design rationale." },
            },
            required: ["name", "summary", "styleTags", "rationale"],
            additionalProperties: false,
          },
          reply: {
            type: "string",
            description: "Concise Chinese message summarizing what was done.",
          },
          riskLevel: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Risk level.",
          },
          warnings: {
            type: "array",
            items: { type: "string" },
            description: "Any warnings.",
          },
          tuningOptions: {
            type: "array",
            items: { type: "string" },
            description: "3-6 short Chinese follow-up options.",
          },
        },
        required: ["scheme", "reply", "riskLevel", "tuningOptions"],
        additionalProperties: false,
      },
    },
  },
];

export const AGENT_SYSTEM_PROMPT_EXTENSION = [
  "你是一个 Agent，可以用工具读取和修改鼠标反馈配置。",
  "遵循 ReAct 模式：先思考用户需求，再调用工具执行修改，观察结果，必要时再调整。",
  "流程：get_current_config 查看现状 → apply_config_patch 修改 → 评估 → 如果效果不对则 rollback 回退 → finalize_proposal 结束。",
  "每次 apply_config_patch 只修改真正需要改变的字段，不要重写整个配置。",
  "修改后如果效果不符合预期，用 rollback 撤销最近一次修改，然后换一种方式重试。",
  "数字飘字 +1：textEnabled=true, textKind='数字飘字', textStyle='阿拉伯数字 (1, 2, 3)', textMode='默认模式 (+1)', textContent='+1', textTemplate='${number}', textTags=[], comboEnabled=false。",
  "文本飘字：textEnabled=true, textKind='文本飘字', comboEnabled=false。",
  "不要声音 → sound: false, volume: 0。关闭粒子 → particle: false, particleCount: 0。",
  "柔和/低调 → 降低 opacity、count、duration、shake。明显 → 提高它们。",
  "不要震动 → shake: 0。关闭波纹 → ripple: false。",
].join("\n");

export function describeAgentToolCall(toolCall) {
  const name = toolCall?.function?.name;
  if (!name) return "未知工具调用";
  switch (name) {
    case "apply_config_patch": {
      const args = toolCall.function.arguments;
      const actionId = typeof args === "string" ? "?" : args?.actionId || "?";
      const keys = Object.keys(typeof args === "string" ? {} : args?.patch || {});
      return `修改 ${actionId}（${keys.length} 项: ${keys.slice(0, 4).join(", ") || "无"}）`;
    }
    case "get_current_config": {
      const args = toolCall.function.arguments;
      const actionId = typeof args === "string" ? "?" : args?.actionId || "?";
      return `读取 ${actionId} 配置`;
    }
    case "finalize_proposal":
      return "生成最终方案";
    default:
      return name;
  }
}

function describeConfigEffect(config) {
  const parts = [];
  if (config.textEnabled) {
    const kind = config.textKind === "数字飘字" ? "数字" : "文本";
    parts.push(`${kind}飘字: ${config.textContent || config.textTemplate || "启用"}`);
  } else {
    parts.push("飘字: 关闭");
  }
  if (config.particle) {
    parts.push(`粒子: ${config.particleStyle || "默认"} x${config.particleCount ?? "?"}`);
  } else {
    parts.push("粒子: 关闭");
  }
  if (config.ripple) {
    parts.push(`波纹: ${config.rippleStyle || "默认"} 尺寸${config.rippleSize ?? "?"}`);
  } else {
    parts.push("波纹: 关闭");
  }
  if (config.sound) {
    parts.push(`音效: ${config.soundFile || "默认"} 音量${config.volume ?? "?"}`);
  } else {
    parts.push("音效: 关闭");
  }
  if (config.shake) parts.push(`震动: ${config.shake}`);
  if (config.cursorOverride) parts.push(`光标: ${config.cursorOverride}`);
  return parts.join(" | ");
}

export function createToolExecutor(initialConfigs = {}) {
  const snapshots = [];
  const configs = { ...initialConfigs };

  function takeSnapshot() {
    snapshots.push(JSON.parse(JSON.stringify(configs)));
  }

  function executeApplyConfigPatch(args, requestState = {}) {
    const actionId = args?.actionId;
    const patch = args?.patch;
    if (!actionId || !patch || typeof patch !== "object") {
      return { ok: false, error: "缺少 actionId 或 patch 参数。" };
    }

    takeSnapshot();

    const current = configs[actionId] || {};
    let sanitized = sanitizeAiSchemePatch(patch);

    if (requestState.prompt) {
      sanitized = repairPatchForUserIntent(sanitized, {
        ...requestState,
        currentConfig: current,
      });
    }

    const merged = mergeActionConfig(current, sanitized);
    configs[actionId] = merged;

    const changedFields = Object.keys(sanitized);
    return {
      ok: true,
      actionId,
      appliedFields: changedFields,
      appliedCount: changedFields.length,
      summary: `已更新 ${actionId} 的 ${changedFields.length} 个字段: ${changedFields.join(", ") || "无"}`,
      effect: describeConfigEffect(merged),
    };
  }

  function executeGetCurrentConfig(args) {
    const actionId = args?.actionId || "leftClick";
    const config = configs[actionId] || {};
    return {
      ok: true,
      actionId,
      config,
      effect: describeConfigEffect(config),
      snapshotCount: snapshots.length,
    };
  }

  function executeRollback() {
    if (!snapshots.length) {
      return { ok: false, error: "没有可回滚的快照。" };
    }
    const previous = snapshots.pop();
    Object.keys(previous).forEach((key) => {
      configs[key] = previous[key];
    });
    return {
      ok: true,
      remainingSnapshots: snapshots.length,
      summary: `已回滚到上一个快照。剩余 ${snapshots.length} 个历史快照。`,
    };
  }

  return {
    getConfigs() {
      return { ...configs };
    },
    getSnapshots() {
      return snapshots.length;
    },
    execute(name, args, requestState = {}) {
      switch (name) {
        case "apply_config_patch":
          return executeApplyConfigPatch(args, requestState);
        case "get_current_config":
          return executeGetCurrentConfig(args);
        case "rollback":
          return executeRollback();
        default:
          return { ok: false, error: `未知工具: ${name}` };
      }
    },
  };
}
