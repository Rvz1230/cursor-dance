import { ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/components/ui/utils";

/**
 * 图标底色只表达「这张卡启用了没有」——深底=启用、浅灰=关闭。
 *
 * 取代原先按效果种类分配的九色底（emerald/amber/sky/teal/rose/cyan/fuchsia/slate/violet）：
 * 八张卡排一列就是八种颜色，颜色不承载任何信息，反而把「启用」这个真正要看的状态淹了。
 * 见 DESIGN.md 色彩与 docs/ui-spec/library/components.html 的改前/改后对照。
 */
const ICON_TONE_ENABLED = "bg-slate-900 text-white";
const ICON_TONE_DISABLED = "bg-slate-100 text-slate-500";

export function Panel({
  title,
  action,
  icon: Icon,
  children,
  className,
  contentClassName,
  collapsible = false,
  defaultOpen = true,
  summary,
  enabled = true,
  id,
}: {
  title: string
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
  contentClassName?: string
  collapsible?: boolean
  defaultOpen?: boolean
  summary?: React.ReactNode
  /** 驱动图标底色。不传时按启用渲染。 */
  enabled?: boolean
  id?: string
}) {
  const header = (
    <div className="flex min-w-0 items-center gap-3">
      {Icon ? (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            enabled ? ICON_TONE_ENABLED : ICON_TONE_DISABLED,
          )}
        >
          <Icon className="size-4" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-medium text-slate-900 text-balance">{title}</h3>
        </div>
        {summary ? <div className="mt-0.5 truncate text-xs text-slate-500 text-pretty">{summary}</div> : null}
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <Accordion key={defaultOpen ? "open" : "closed"} type="single" collapsible defaultValue={defaultOpen ? "content" : undefined} className={className} id={id}>
        <AccordionItem value="content" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <AccordionTrigger className="group flex min-w-0 flex-1 items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
              {header}
              <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
            </AccordionTrigger>
            {action ? <div className="ml-3 shrink-0">{action}</div> : null}
          </div>
          <AccordionContent className="px-4 py-3">{children}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <section id={id} className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="basis-32 shrink-0 flex-1">{header}</div>
        {action ? <div className="flex max-w-full shrink-0 items-center self-center">{action}</div> : null}
      </div>
      <div className={cn("px-4 py-3", contentClassName)}>{children}</div>
    </section>
  );
}
