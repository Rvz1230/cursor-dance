import type { WorkbenchActionConfig } from "../../hooks/workbenchStateTypes";

interface ThemeSignatureProps {
  actionConfig?: WorkbenchActionConfig;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function colorPalette(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) return [fallback];
  const colors = value.filter((color): color is string => typeof color === "string" && color.length > 0);
  return colors.length ? colors : [fallback];
}

export function ThemeSignature({ actionConfig = {} }: ThemeSignatureProps) {
  const rippleColor = stringValue(actionConfig.rippleColor, "#0F172A");
  const textColor = stringValue(actionConfig.textColor, rippleColor);
  const palette = colorPalette(actionConfig.particlePalette, textColor);
  const particleStyle = stringValue(actionConfig.particleStyle, "点状粒子");
  const normalizedRadius = Math.min(1, Math.max(0, (numberValue(actionConfig.rippleSize, 48) - 20) / 100));
  const normalizedWidth = Math.min(1, Math.max(0, (numberValue(actionConfig.rippleLineWidth, 2) - 1) / 7));
  const radius = 5 + normalizedRadius * 8;
  const lineWidth = 0.8 + normalizedWidth * 1.4;
  const points = [-0.6, 0, 0.6].map((angle, index) => ({
    x: 14 + Math.cos(angle) * (radius + 3),
    y: 14 + Math.sin(angle) * (radius + 3) * 0.6,
    color: palette[index % palette.length],
  }));

  return (
    <svg viewBox="0 0 44 28" className="size-full" aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke={rippleColor}
        strokeWidth={lineWidth}
        opacity="0.9"
      />
      {points.map((point, index) => (
        <ThemeParticle
          key={`${point.x}-${point.y}`}
          style={particleStyle}
          color={point.color}
          x={point.x}
          y={point.y}
          rotate={index * 20}
        />
      ))}
      <rect x="30" y="11" width="10" height="2.4" rx="1.2" fill={textColor} />
    </svg>
  );
}

function ThemeParticle({
  style,
  color,
  x,
  y,
  rotate,
}: {
  style: string;
  color: string;
  x: number;
  y: number;
  rotate: number;
}) {
  if (style.includes("钻石")) {
    return <rect x={x - 1.8} y={y - 1.8} width="3.6" height="3.6" rx="0.4" fill={color} transform={`rotate(45 ${x} ${y})`} />;
  }
  if (style.includes("方块") || style.includes("碎屑")) {
    return <rect x={x - 1.8} y={y - 1.8} width="3.6" height="3.6" rx="0.5" fill={color} transform={`rotate(${rotate} ${x} ${y})`} />;
  }
  if (style.includes("火花") || style.includes("星")) {
    return <path d={`M ${x} ${y - 2.5} L ${x + 0.8} ${y - 0.8} L ${x + 2.5} ${y} L ${x + 0.8} ${y + 0.8} L ${x} ${y + 2.5} L ${x - 0.8} ${y + 0.8} L ${x - 2.5} ${y} L ${x - 0.8} ${y - 0.8} Z`} fill={color} />;
  }
  return <circle cx={x} cy={y} r="2" fill={color} />;
}
