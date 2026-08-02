/** @platform shared — 空态。形态见 docs/ui-spec/library/components.html。 */

import type { ComponentType, ReactNode } from "react";
import { cn } from "./utils";

/**
 * `neutral` = 本来就还没有内容；`filtered` = 有内容但被筛掉了；
 * `blocked` = 缺权限/前置条件，需要用户去别处解决。
 *
 * 分三种是因为这三种的**下一步动作完全不同**：第一种要「创建」，
 * 第二种要「清空筛选」，第三种要「去授权」。都画成一个灰盒子会让用户不知道该干什么。
 */
type EmptyStateTone = "neutral" | "filtered" | "blocked";

const TONE_RING: Readonly<Record<EmptyStateTone, string>> = {
  neutral: "bg-white text-slate-400 ring-slate-200",
  filtered: "bg-white text-slate-400 ring-slate-200",
  blocked: "bg-amber-50 text-amber-600 ring-amber-200",
};

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  /** 主操作。空态没有出路就只是一句抱歉，所以强烈建议给。 */
  action?: ReactNode;
  tone?: EmptyStateTone;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mx-auto grid size-10 place-items-center rounded-full shadow-sm ring-1",
            TONE_RING[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <p className={cn("text-xs font-medium text-slate-700", Icon && "mt-3")}>{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-[220px] text-2xs leading-relaxed text-slate-500 text-pretty">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
