/**
 * Shared, framework-free control data.
 *
 * The UI-specific tables live here; runtime easing data is re-exported from the
 * effect core so renderers do not pull UI-only font, palette and shape metadata.
 */

export {
  EASINGS,
  EASING_NAMES,
  getBezierOvershoot,
  getCssEasing,
  getEasingPoints,
  type BezierPoints,
} from "@/shared/effect-core/easing-data";

export interface FontDefinition {
  readonly value: string;
  readonly stack: string;
  readonly group: "无衬线" | "圆体" | "等宽" | "衬线";
}

export const FONTS = [
  { value: "系统默认", stack: "system-ui, -apple-system, sans-serif", group: "无衬线" },
  { value: "SF Pro Text", stack: '"SF Pro Text", system-ui, sans-serif', group: "无衬线" },
  { value: "Helvetica Neue", stack: '"Helvetica Neue", Helvetica, Arial, sans-serif', group: "无衬线" },
  { value: "Inter", stack: "Inter, system-ui, sans-serif", group: "无衬线" },
  { value: "苹方", stack: '"PingFang SC", system-ui, sans-serif', group: "无衬线" },
  { value: "微软雅黑", stack: '"Microsoft YaHei", system-ui, sans-serif', group: "无衬线" },
  { value: "SF Pro Rounded", stack: '"SF Pro Rounded", system-ui, sans-serif', group: "圆体" },
  { value: "Quicksand", stack: "Quicksand, system-ui, sans-serif", group: "圆体" },
  { value: "SF Mono", stack: '"SF Mono", Menlo, monospace', group: "等宽" },
  { value: "Menlo", stack: "Menlo, Consolas, monospace", group: "等宽" },
  { value: "JetBrains Mono", stack: '"JetBrains Mono", Menlo, monospace', group: "等宽" },
  { value: "Georgia", stack: 'Georgia, "Times New Roman", serif', group: "衬线" },
  { value: "宋体", stack: '"Songti SC", Georgia, serif', group: "衬线" },
] as const satisfies readonly FontDefinition[];

export const CONTENT_PALETTE = [
  "#F59E0B",
  "#0EA5E9",
  "#0D9488",
  "#F43F5E",
  "#8B5CF6",
  "#FFFFFF",
  "#0F172A",
] as const;

export const SHAPE_PATH = {
  圆点: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
  方块: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  星形: '<path d="M12 4l2.4 6.2H21l-5.3 3.7 2 6.1L12 16.4 6.3 20l2-6.1L3 10.2h6.6z" fill="currentColor"/>',
  钻石: '<path d="M12 4l7 8-7 8-7-8z" fill="currentColor"/>',
} as const;

export type ShapeName = keyof typeof SHAPE_PATH;

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : null;
}
