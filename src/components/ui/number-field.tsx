/** @platform shared — 可输入的数值框。形态见 docs/ui-spec/library/components.html。 */

import { useEffect, useState } from "react";
import { Input } from "./input";
import { cn } from "./utils";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * 把一次编辑结果转成「要不要提交、提交什么」。抽成纯函数是为了能单测——
 * 项目里没有 DOM 测试环境（434 个测试全是纯逻辑），而这里的语义恰恰是最容易写错的部分：
 * 空串 / 非数字要**放弃编辑保持原值**，不能静默变成 min；值没变就不该触发 onChange。
 *
 * 返回 null 表示「什么都不做」。
 */
export function resolveNumberCommit(
  raw: string,
  current: number,
  min: number,
  max: number,
): number | null {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const next = clampNumber(parsed, min, max);
  return next === current ? null : next;
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  /** 有 label 时上下堆叠；没有时就是一个紧凑读数框（用在滑块右侧）。 */
  label?: string;
  unit?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  compact?: boolean;
}

/**
 * 为什么需要内部草稿状态而不是直接 `value={value}` + 每次 onChange 就 clamp：
 *
 * 逐键 clamp 会让区间内的值输不进去。min=12 时想输「50」，按下「5」的那一刻
 * 就被 clamp 成 12，第二个键变成「122」——用户永远打不出 50。
 * 所以：获得焦点期间保留原始字符串，**失焦或按 Enter 才 clamp 并提交**。
 * Esc 放弃编辑、回到外部值。
 */
export function NumberField({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  label,
  unit,
  disabled,
  className,
  ariaLabel,
  compact = false,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  // 外部值变化时丢弃草稿（预设、撤销、AI 补丁都会从外面改这个值）
  useEffect(() => { setDraft(null); }, [value]);

  function commit(raw: string) {
    setDraft(null);
    const next = resolveNumberCommit(raw, value, min, max);
    if (next !== null) onChange(next);
  }

  const field = (
    <span className={cn("flex items-center gap-1", !label && className)}>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        value={draft ?? String(value)}
        className={cn(
          "tabular-nums",
          compact ? "h-5 w-14 rounded-md px-1 text-right text-xs" : "h-8",
          !compact && (label ? "text-center" : "w-20 px-2 text-right"),
        )}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(null);
          }
        }}
      />
      {unit ? <span className="shrink-0 text-2xs text-slate-400">{unit}</span> : null}
    </span>
  );

  if (!label) return field;

  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {field}
    </label>
  );
}
