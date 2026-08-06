export type BezierPoints = readonly [number, number, number, number];

interface EasingDefinition {
  readonly value: string;
  readonly points: BezierPoints;
}

export const EASINGS = [
  { value: "线性", points: [0, 0, 1, 1] },
  { value: "缓出", points: [0, 0, 0.2, 1] },
  { value: "缓入", points: [0.4, 0, 1, 1] },
  { value: "缓入缓出", points: [0.4, 0, 0.2, 1] },
  { value: "弹跳", points: [0.34, 1.56, 0.64, 1] },
  { value: "弹性", points: [0.22, 1, 0.36, 1.18] },
] as const satisfies readonly EasingDefinition[];

export const EASING_NAMES = EASINGS.map(({ value }) => value);

function bezierY(t: number, y1: number, y2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t;
}

export function getBezierOvershoot(points: BezierPoints): number {
  const [, y1, , y2] = points;
  let peak = 1;
  for (let index = 0; index <= 200; index += 1) {
    peak = Math.max(peak, bezierY(index / 200, y1, y2));
  }
  return Math.round((peak - 1) * 1000) / 10;
}

export function getEasingPoints(value: string): BezierPoints | null {
  return EASINGS.find((easing) => easing.value === value)?.points ?? null;
}

export function getCssEasing(value: string | BezierPoints): string {
  if (value === "线性") return "linear";
  const points = typeof value === "string" ? getEasingPoints(value) : value;
  if (!points) return "cubic-bezier(0, 0, 0.2, 1)";
  return `cubic-bezier(${points.map((point) => Number(point.toFixed(3))).join(", ")})`;
}
