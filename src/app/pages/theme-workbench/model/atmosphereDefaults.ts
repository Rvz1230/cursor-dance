/** 氛围动效预设模式 */
export const ATMOSPHERE_PRESET_OPTIONS = [
  { value: "none", label: "关闭" },
  { value: "creative-mouse", label: "Creative Mouse" },
];

/** 返回默认氛围配置 */
export function getDefaultAtmosphere() {
  return { mode: "none" };
}

/** 导出保留引用（原有模块常量和选项可暂留，待后续细分自定义时使用） */
export const BLEND_MODE_OPTIONS = [
  { value: "none", label: "无" },
  { value: "difference", label: "差值" },
  { value: "screen", label: "滤色" },
  { value: "multiply", label: "正片叠底" },
  { value: "overlay", label: "叠加" },
];

export const PARALLAX_INTENSITY_OPTIONS = [
  { value: "subtle", label: "轻柔" },
  { value: "medium", label: "中等" },
  { value: "strong", label: "强烈" },
];
