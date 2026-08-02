/** @platform shared — 工作区页头。形态见 docs/ui-spec/library/components.html。 */

import type { ReactNode } from "react";
import { cn } from "./utils";

interface PageHeaderProps {
  title: string;
  /** 一句话说明这一页是干什么的。窄屏下会换行，所以用 text-pretty 避免孤字。 */
  description?: ReactNode;
  /** 右上角的操作区（分段控件、按钮等）。窄屏时整块落到标题下方。 */
  actions?: ReactNode;
  className?: string;
}

/**
 * 每个工作区顶部那块「标题 + 说明 + 右上操作」此前在各页面里各写一遍，
 * 导致间距、字号层级、窄屏折行行为都不一致。
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-slate-900 text-balance">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
