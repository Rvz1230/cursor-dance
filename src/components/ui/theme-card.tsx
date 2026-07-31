import { useState } from "react";
import { Copy, Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import { DataPill } from "@/components/ui/data-pill";
import { ICON_OPTIONS, resolveThemeIcon, toneClasses } from "@/components/ui/theme-identity";

export function ThemeCard({
  theme,
  selected,
  onClick,
  onDuplicate,
  onExport,
  onDelete,
  onRename,
  onUpdateIcon,
  canDelete = true,
  collapsed = false,
  isDirty = false,
}: {
  theme: {
    id: string;
    name: string;
    kind: string;
    summary: string;
    tone: string;
    icon?: string;
  };
  selected?: boolean;
  onClick?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onRename?: (id: string, name: string) => void;
  onUpdateIcon?: (id: string, iconName: string) => void;
  canDelete?: boolean;
  collapsed?: boolean;
  isDirty?: boolean;
}) {
  const tones = toneClasses(theme.tone);
  const [editingName, setEditingName] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const ThemeIcon = resolveThemeIcon(theme.icon);

  function commitRename() {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== theme.name && onRename) {
      onRename(theme.id, trimmed);
    }
    setEditingName("");
  }

  function startRename() {
    setEditingName(theme.name);
  }
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group relative flex size-11 items-center justify-center rounded-xl border bg-white transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
          selected ? "border-slate-950 bg-white shadow-sm ring-1 ring-slate-950/10" : "border-slate-200"
        )}
        aria-label={`选择主题 ${theme.name}`}
        title={theme.name}
      >
        <span className={cn("flex size-8 items-center justify-center rounded-xl", selected ? "bg-slate-950 text-white" : tones.icon)}>
          <ThemeIcon className="size-4" />
        </span>
        {selected ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-teal-500 ring-2 ring-white" aria-hidden="true" /> : null}
        {isDirty ? <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-white" aria-label="有未保存的更改" /> : null}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 active:scale-[0.995]",
        selected ? "border-slate-950/20 bg-white shadow-sm ring-1 ring-slate-950/10" : "border-slate-200/80"
      )}
    >
      {selected ? <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-slate-950" aria-hidden="true" /> : null}
      {isDirty ? <span className="absolute right-10 top-3 size-1.5 rounded-full bg-amber-400" aria-label="有未保存的更改" /> : null}
      <button type="button" onClick={onClick} className="w-full px-3 py-2.5 pr-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
        <div className="flex items-start gap-2.5">
          <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
            <PopoverTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                className={cn("mt-0.5 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:ring-2 hover:ring-slate-950/10", selected ? "bg-slate-950 text-white" : tones.icon)}
                aria-label="更换主题图标"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); } }}
              >
                <ThemeIcon className="size-4" />
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-[232px] p-2 grid grid-cols-5 gap-1" align="start" sideOffset={4}>
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    theme.icon === name ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  aria-label={`使用 ${name} 图标`}
                  title={name}
                  onClick={() => {
                    onUpdateIcon?.(theme.id, name);
                    setIconPickerOpen(false);
                  }}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {editingName !== "" ? (
                <>
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { event.preventDefault(); commitRename(); }
                      if (event.key === "Escape") { event.preventDefault(); setEditingName(""); }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    maxLength={30}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5 text-sm text-slate-700 outline-none ring-2 ring-slate-950/20 ring-offset-0"
                    autoFocus
                    onFocus={(event) => event.target.select()}
                  />
                  <DataPill tone={theme.kind === "内置" ? "teal" : "amber"} className="shrink-0">{theme.kind}</DataPill>
                </>
              ) : (
                <>
                  <div
                    className="min-w-0 truncate text-sm font-medium text-slate-900 select-none"
                    title={theme.name}
                    onDoubleClick={(event) => { event.stopPropagation(); startRename(); }}
                  >{theme.name}</div>
                  <button
                    type="button"
                    className="shrink-0 flex size-5 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"
                    onClick={(event) => { event.stopPropagation(); startRename(); }}
                    aria-label="编辑主题名称"
                    title="编辑名称"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <DataPill tone={theme.kind === "内置" ? "teal" : "amber"} className="shrink-0">{theme.kind}</DataPill>
                </>
              )}
            </div>
            <div className="mt-1 text-xs leading-5 text-pretty text-slate-600">{theme.summary}</div>
          </div>
        </div>
      </button>
      <Popover open={actionMenuOpen} onOpenChange={setActionMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
            aria-label={`${theme.name} 更多操作`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="end">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setActionMenuOpen(false);
              onDuplicate?.();
            }}
          >
            <Copy className="size-4" />
            复制
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setActionMenuOpen(false);
              onExport?.();
            }}
          >
            <Download className="size-4" />
            导出
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
            onClick={() => {
              setActionMenuOpen(false);
              onDelete?.();
            }}
            disabled={!canDelete}
          >
            <Trash2 className="size-4" />
            删除
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
