import { ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/components/ui/utils";

export function Panel({
  title,
  action,
  icon: Icon,
  iconTone = "bg-slate-200 text-slate-700",
  children,
  className,
  contentClassName,
  collapsible = false,
  defaultOpen = true,
  summary,
  enabled,
  id,
}: {
  title: string
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  iconTone?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
  collapsible?: boolean
  defaultOpen?: boolean
  summary?: string
  enabled?: boolean
  id?: string
}) {
  const header = (
    <div className="flex min-w-0 items-center gap-3">
      {Icon ? (
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconTone)}>
          <Icon className="size-4" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900 text-balance">{title}</h3>
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
        <div className="min-w-0 flex-1">{header}</div>
        {action ? <div className="flex max-w-full shrink-0 items-center self-center">{action}</div> : null}
      </div>
      <div className={cn("px-4 py-3", contentClassName)}>{children}</div>
    </section>
  );
}
