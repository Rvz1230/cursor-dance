/** 氛围动效预设模式 */
export const ATMOSPHERE_PRESET_OPTIONS = [
  { value: "none", label: "关闭" },
  { value: "creative-mouse", label: "Creative Mouse" },
];

/** 返回默认氛围配置 */
export function getDefaultAtmosphere() {
  return { mode: "none" };
}
