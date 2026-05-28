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
