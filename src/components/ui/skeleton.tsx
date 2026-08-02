/** @platform shared — 骨架屏。形态见 docs/ui-spec/library/components.html。 */

import { cn } from "./utils";

/**
 * 用来替掉 `DeferredPanelFallback` 的居中 spinner：懒加载时一个转圈让整页看起来
 * 像空了，而骨架屏保留了「马上会出现什么形状」的信息，视觉上不跳版。
 *
 * 用 animate-pulse 而不是自定义 shimmer：DESIGN.md 不收装饰性动效，
 * 而 pulse 是 Tailwind 自带的、单属性（opacity）的动画。
 *
 * 暂不导出：目前只有 PanelSkeleton 需要它。等真有调用方再放出去——
 * 先导出一个没人用的 API 只会让 knip 报噪音。
 */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200", className)}
    />
  );
}

/**
 * 面板级骨架：一个图标位 + 两行文字 + 若干控件行。
 * 行数按被替换面板的实际密度给，不要所有地方都用同一个数——
 * 骨架的意义就是形状要对得上。
 */
export function PanelSkeleton({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="正在加载"
      className={cn("rounded-xl border border-slate-200 bg-white p-3 shadow-sm", className)}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-40" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-7 w-full" />
        ))}
      </div>
    </div>
  );
}
