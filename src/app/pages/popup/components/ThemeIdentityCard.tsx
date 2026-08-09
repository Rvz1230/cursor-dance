import { useMemo, type CSSProperties } from "react";
import { CircleDashed, ImagePlus, Monitor, MousePointer2, Sparkles, Type, Volume2, Wand2 } from "lucide-react";
import { resolveThemeIcon } from "@/components/ui/theme-identity";
import { getCursorTrailConfig } from "@/shared/config/cursor-trail";
import AnimatedPreview from "../AnimatedPreview";

export function themeIcon(theme) {
  return resolveThemeIcon(theme?.icon);
}

export function themeAccent(ac) {
  if (ac?.particlePalette?.[0]) return ac.particlePalette[0];
  if (ac?.rippleColor) return ac.rippleColor;
  if (ac?.textColor) return ac.textColor;
  return "#94A3B8";
}

function effectSummary(ac) {
  if (!ac) return [];
  const s = [];
  if (ac.textEnabled) s.push("飘字");
  if (ac.ripple) s.push("波纹");
  if (ac.particle) s.push("粒子");
  if (ac.sound) s.push("音效");
  if (ac.animationEnabled) s.push("动效");
  if (ac.imageEnabled) s.push("图片");
  if (ac.cursorGlowColor?.trim()) s.push("光晕");
  return s;
}

function particleDirLabel(dir) {
  const map = { "四周扩散": "扩散", up: "向上", down: "向下", left: "向左", right: "向右" };
  return map[dir] || "扩散";
}

// ── effect chips (grouped: Motion / Feedback) ────────────────

function ParticleBlock({ ac, accent }) {
  if (!ac?.particle) return null;
  const style = ac.particleStyle || "点状粒子";
  const count = ac.particleCount || 0;
  const dir = particleDirLabel(ac.particleDirection);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}12`, color: accent }}
    >
      <Sparkles className="size-3.5" />
      <span>{style}</span>
      <span className="text-2xs opacity-60">·</span>
      <span className="tabular-nums">{count}</span>
      <span className="opacity-60">{dir}</span>
    </span>
  );
}

function RippleBlock({ ac, accent }) {
  if (!ac?.ripple) return null;
  const style = ac.rippleStyle || "单环";
  const size = ac.rippleSize || 0;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}28`, color: accent }}
    >
      <CircleDashed className="size-3.5" />
      <span>{style}</span>
      <span className="text-2xs opacity-60">·</span>
      <span className="tabular-nums">{size}px</span>
    </span>
  );
}

function TextBlock({ ac }) {
  if (!ac?.textEnabled) return null;
  const text = ac.textContent || "✦";
  const color = ac.textColor || "#94A3B8";
  const size = ac.textSize || 0;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${color}10`, color }}
    >
      <Type className="size-3.5" />
      <span className="font-medium truncate max-w-[72px]">"{text}"</span>
      {size > 0 && <><span className="text-2xs opacity-60">·</span><span className="tabular-nums">{size}px</span></>}
    </span>
  );
}

function SoundBlock({ ac }) {
  if (!ac?.sound) return null;
  const vol = ac.volume != null ? ac.volume : 0;

  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium bg-slate-100 text-slate-500">
      <Volume2 className="size-3.5" />
      <span className="tabular-nums">{vol}%</span>
    </span>
  );
}

function AnimationBlock({ ac, accent }) {
  if (!ac?.animationEnabled) return null;
  const style = ac.animationStyle || "聚焦脉冲";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}12`, color: accent }}
    >
      <Wand2 className="size-3.5" />
      <span>{style}</span>
    </span>
  );
}

function ImageBlock({ ac, accent }) {
  if (!ac?.imageEnabled) return null;
  const size = ac.imageSize || 56;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}28`, color: accent }}
    >
      <ImagePlus className="size-3.5" />
      <span>图片</span>
      <span className="text-2xs opacity-60">·</span>
      <span className="tabular-nums">{size}px</span>
    </span>
  );
}

function CursorFeedbackBlock({ ac, accent }) {
  const hasGlow = ac?.cursorGlowColor?.trim();
  const hasShake = ac?.shake;
  if (!hasGlow && !hasShake) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}08`, color: accent }}
    >
      <MousePointer2 className="size-3.5" />
      {hasGlow && <span>光晕</span>}
      {hasShake && !hasGlow && <span>震动</span>}
    </span>
  );
}

function CursorTrailBlock({ atmosphere, accent }) {
  const trail = getCursorTrailConfig(atmosphere);
  if (!trail.enabled) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}08`, color: accent }}
    >
      <MousePointer2 className="size-3.5" />
      <span>拖尾</span>
    </span>
  );
}

// ── BubbleBackground — breathing background orbs ─────────────

function BubbleBackground({ accent }) {
  const bubbles = useMemo(() => {
    const seed = [...accent].reduce((a, c) => a + c.charCodeAt(0), 1);
    // sine hash — reliably uniform, no linear correlation
    const r = (i) => {
      const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: 14 }, (_, i) => ({
      left: r(i * 7 + 1) * 92 + 4,
      top: r(i * 11 + 3) * 86 + 5,
      size: 4 + r(i * 13 + 5) * 72,
      opacityBase: 0.008 + r(i * 17 + 7) * 0.05,
      opacityPeak: 0.02 + r(i * 19 + 9) * 0.10,
      floatDuration: 10 + r(i * 23 + 11) * 18,
      floatAmount: 3 + r(i * 29 + 13) * 11,
      breathAmount: 0.02 + r(i * 31 + 15) * 0.07,
      initX: -6 + r(i * 37 + 17) * 12,
      initY: -6 + r(i * 41 + 19) * 12,
      delay: r(i * 43 + 21) * 10,
    }));
  }, [accent]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="cd-popup-bubble absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            top: `${b.top}%`,
            backgroundColor: accent,
            animationDuration: `${b.floatDuration}s`,
            animationDelay: `${b.delay}s`,
            "--bubble-opacity-base": b.opacityBase,
            "--bubble-opacity-peak": b.opacityPeak,
            "--bubble-opacity-low": b.opacityBase * 0.5,
            "--bubble-opacity-high": b.opacityPeak * 0.7,
            "--bubble-x-0": `${b.initX}px`,
            "--bubble-y-0": `${b.initY}px`,
            "--bubble-x-1": `${b.initX - b.floatAmount * 0.5}px`,
            "--bubble-y-1": `${b.initY - b.floatAmount * 0.6}px`,
            "--bubble-x-2": `${b.initX + b.floatAmount * 0.6}px`,
            "--bubble-y-2": `${b.initY + b.floatAmount * 0.4}px`,
            "--bubble-x-3": `${b.initX - b.floatAmount * 0.4}px`,
            "--bubble-y-3": `${b.initY + b.floatAmount * 0.5}px`,
            "--bubble-scale-1": 1 + b.breathAmount,
            "--bubble-scale-2": 1 - b.breathAmount * 0.4,
            "--bubble-scale-3": 1 + b.breathAmount * 0.3,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

// ── IdentityCard ─────────────────────────────────────────────

export function ThemeIdentityCard({ actionConfig, accent, name, Icon: ThemeIcon, siteAction, atmosphere }) {
  const tags = effectSummary(actionConfig);
  const hasTrail = getCursorTrailConfig(atmosphere).enabled;
  const hasEffects = tags.length > 0 || hasTrail;
  const hasSiteRule = siteAction?.enable;

  return (
    <div
      className="relative h-full overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm"
      style={{ backgroundColor: `${accent}06` }}
    >
      {/* bg blob */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full opacity-[0.04]"
        style={{ backgroundColor: accent }}
      />

      {/* breathing bubbles */}
      <BubbleBackground accent={accent} />

      {/* accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />

      <div className="flex h-full flex-col px-4 py-2">
        {/* theme icon + name + site badge — always visible */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}14` }}
          >
            <ThemeIcon className="size-[15px]" style={{ color: accent }} />
          </div>
          <h2 className="text-base font-semibold truncate" style={{ color: accent }}>{name}</h2>
          {hasSiteRule && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-500">
              <Monitor className="size-2.5" />
              站点规则
            </span>
          )}
        </div>

        {!hasEffects ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <p className="text-xs text-slate-400">暂无特效配置</p>
            <p className="text-2xs text-slate-400">可前往工作台配置效果</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-h-0 pt-2 gap-2">
            {/* animated preview — compact */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <AnimatedPreview actionConfig={actionConfig} accent={accent} />
            </div>

            {/* effect groups */}
            <div className="shrink-0 space-y-1">
              {/* Motion group */}
              {(actionConfig?.particle || actionConfig?.ripple || actionConfig?.animationEnabled) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-xs font-semibold text-slate-400">动效</span>
                  <div className="flex flex-wrap gap-1">
                    <ParticleBlock ac={actionConfig} accent={accent} />
                    <RippleBlock ac={actionConfig} accent={accent} />
                    <AnimationBlock ac={actionConfig} accent={accent} />
                  </div>
                </div>
              )}
              {/* Feedback group */}
              {(actionConfig?.textEnabled || actionConfig?.sound || actionConfig?.imageEnabled || actionConfig?.cursorGlowColor?.trim() || actionConfig?.shake || hasTrail) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-xs font-semibold text-slate-400">反馈</span>
                  <div className="flex flex-wrap gap-1">
                    <TextBlock ac={actionConfig} />
                    <SoundBlock ac={actionConfig} />
                    <ImageBlock ac={actionConfig} accent={accent} />
                    <CursorFeedbackBlock ac={actionConfig} accent={accent} />
                    <CursorTrailBlock atmosphere={atmosphere} accent={accent} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
