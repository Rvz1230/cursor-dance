import { FIELD_LABELS } from "./field-defs.js";
import { sanitizeAiSchemePatch } from "./sanitize.js";

export function formatDiffValue(value) {
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (Array.isArray(value)) return value.join("、") || "空";
  if (value === undefined || value === null || value === "") return "空";
  return String(value);
}

export function describeDiff(patch) {
  const summary = [];

  // Text / 飘字
  if (patch.textEnabled === false) {
    summary.push("关闭飘字，降低视觉打扰");
  } else if (patch.textEnabled === true || patch.textKind || patch.textContent || patch.textTemplate) {
    const kind = patch.textKind === "文本飘字" ? "文本" : "数字";
    const detail = patch.textContent || patch.textTemplate || "";
    summary.push(`飘字切换为${kind}飘字${detail ? "：" + detail : ""}`);
  }
  if (patch.fontSize != null) summary.push(`字号调整为 ${patch.fontSize}`);
  if (patch.textDuration != null) summary.push(`飘字时长 ${patch.textDuration}ms`);
  if (patch.textEasing) summary.push(`飘字缓动改为${patch.textEasing}`);
  if (patch.comboEnabled === true) summary.push("启用连击累加");
  if (patch.comboEnabled === false) summary.push("关闭连击累加");

  // Particle / 粒子
  if (patch.particle === false) {
    summary.push("关闭粒子反馈");
  } else if (patch.particle === true || patch.particleCount != null || patch.particleStyle) {
    const style = patch.particleStyle || "";
    const count = patch.particleCount != null ? ` x${patch.particleCount}` : "";
    summary.push(`启用粒子反馈${style ? "：" + style : ""}${count}`);
  }
  if (patch.particle && patch.particleDirection) summary.push(`粒子方向：${patch.particleDirection}`);
  if (patch.particle && patch.particleColorMode) summary.push(`粒子颜色：${patch.particleColorMode}`);

  // Ripple / 波纹
  if (patch.ripple === false) {
    summary.push("关闭波纹反馈");
  } else if (patch.ripple === true || patch.rippleSize != null || patch.rippleStyle) {
    const style = patch.rippleStyle || "";
    const size = patch.rippleSize != null ? ` 尺寸${patch.rippleSize}` : "";
    summary.push(`启用波纹反馈${style ? "：" + style : ""}${size}`);
  }
  if (patch.ripple && patch.rippleEasing) summary.push(`波纹缓动改为${patch.rippleEasing}`);

  // Audio / 音效
  if (patch.sound === false) {
    summary.push("关闭音效");
  } else if (patch.sound === true || patch.volume != null || patch.soundFile) {
    const vol = patch.volume != null ? ` 音量${patch.volume}` : "";
    summary.push(`启用音效反馈${vol}`);
  }
  if (patch.sound && patch.soundFile) summary.push(`音效文件：${patch.soundFile}`);
  if (patch.sound && patch.soundTriggerMode) summary.push(`播放策略：${patch.soundTriggerMode}`);

  // Cursor / 光标
  if (patch.shake === 0) summary.push("关闭光标震动");
  if (patch.shake > 0) summary.push(`光标震动强度 ${patch.shake}`);
  if (patch.cursorSize != null) summary.push(`光标尺寸 ${patch.cursorSize}`);
  if (patch.textColor) summary.push(`主色调整为 ${patch.textColor}`);

  // Animation / 动画
  if (patch.animationEnabled === false) {
    summary.push("关闭光标动画");
  } else if (patch.animationEnabled === true || patch.animationStyle) {
    summary.push(`启用光标动画${patch.animationStyle ? "：" + patch.animationStyle : ""}`);
  }

  // Image / 图像
  if (patch.imageEnabled === false) {
    summary.push("关闭图像反馈");
  } else if (patch.imageEnabled === true || patch.imageSize != null) {
    summary.push(`启用图像反馈${patch.imageSize != null ? " 尺寸" + patch.imageSize : ""}`);
  }

  return summary.slice(0, 5);
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
