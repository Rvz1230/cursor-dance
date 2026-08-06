import { useState } from "react";
import { Copy, Download, MoreHorizontal, Pencil, Shapes, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import { ICON_OPTIONS, resolveThemeIcon, toneClasses } from "@/components/ui/theme-identity";
import type { WorkbenchThemeMeta } from "../../hooks/workbenchStateTypes";

interface ThemeLibraryOptionProps {
  theme: WorkbenchThemeMeta;
  selected: boolean;
  roving: boolean;
  canDelete: boolean;
  isDirty: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  onRename?: (id: string, name: string) => void;
  onUpdateIcon?: (id: string, iconName: string) => void;
}

export function ThemeLibraryOption({
  theme,
  selected,
  roving,
  canDelete,
  isDirty,
  onSelect,
  onFocus,
  onKeyDown,
  onDuplicate,
  onExport,
  onDelete,
  onRename,
  onUpdateIcon,
}: ThemeLibraryOptionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [editingName, setEditingName] = useState("");
  const tones = toneClasses(theme.tone);
  const ThemeIcon = resolveThemeIcon(theme.icon);

  function closeMenu() {
    setMenuOpen(false);
    setShowIcons(false);
  }

  function commitRename() {
    const nextName = editingName.trim();
    if (nextName && nextName !== theme.name) onRename?.(theme.id, nextName);
    setEditingName("");
  }

  return (
    <div
      data-theme-library-item={theme.id}
      role="option"
      aria-selected={selected}
      tabIndex={roving ? 0 : -1}
      className={cn(
        "group relative flex min-h-12 cursor-default items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        selected
          ? "border-slate-300 bg-white shadow-sm"
          : "border-transparent hover:border-slate-200 hover:bg-white/70",
      )}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {selected ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-slate-950" aria-hidden="true" /> : null}
      <span
        className={cn(
          "relative grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border",
          selected ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50",
        )}
        title={`${theme.name} 的主题标识`}
        aria-hidden="true"
      >
        <span className={cn("absolute -bottom-3 -right-2 size-8 rounded-full opacity-70", tones.icon)} />
        <ThemeIcon className="relative size-4 text-slate-700" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          {editingName ? (
            <input
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              onBlur={commitRename}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") { event.preventDefault(); commitRename(); }
                if (event.key === "Escape") { event.preventDefault(); setEditingName(""); }
              }}
              className="h-6 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-800 outline-none ring-2 ring-slate-200"
              maxLength={30}
              aria-label={`重命名“${theme.name}”`}
              autoFocus
              onFocus={(event) => event.target.select()}
            />
          ) : (
            <span className="min-w-0 truncate text-xs font-medium text-slate-900" title={theme.name}>{theme.name}</span>
          )}
          {isDirty ? <span className="size-1.5 shrink-0 rounded-full bg-amber-400" title="有未保存的更改" aria-label="有未保存的更改" /> : null}
          {theme.kind === "自定义" ? <span className="ml-auto shrink-0 text-2xs font-medium text-slate-500">自定义</span> : null}
        </span>
        <span className="mt-px block truncate text-2xs text-slate-500" title={theme.summary}>{theme.summary}</span>
      </span>

      <Popover open={menuOpen} onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) setShowIcons(false);
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            className="size-7 shrink-0 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`${theme.name} 更多操作`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end" sideOffset={4} onClick={(event) => event.stopPropagation()}>
          {showIcons ? (
            <>
              <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                <span className="text-2xs font-medium text-slate-500">选择主题图标</span>
                <button type="button" className="text-2xs text-slate-500 hover:text-slate-900" onClick={() => setShowIcons(false)}>返回</button>
              </div>
              <div className="grid grid-cols-5 gap-1 p-1">
                {ICON_OPTIONS.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "grid size-8 place-items-center rounded-lg",
                      theme.icon === name ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
                    )}
                    aria-label={`使用 ${name} 图标`}
                    onClick={() => {
                      onUpdateIcon?.(theme.id, name);
                      closeMenu();
                    }}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <MenuAction icon={Pencil} label="重命名" onClick={() => { closeMenu(); setEditingName(theme.name); }} />
              <MenuAction icon={Shapes} label="更换图标…" onClick={() => setShowIcons(true)} />
              <MenuAction icon={Copy} label="复制" onClick={() => { closeMenu(); onDuplicate(); }} />
              <MenuAction icon={Download} label="导出" onClick={() => { closeMenu(); onExport(); }} />
              <div className="my-1 h-px bg-slate-100" />
              <MenuAction icon={Trash2} label="删除" danger disabled={!canDelete} onClick={() => { closeMenu(); onDelete(); }} />
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent",
        danger && !disabled ? "text-rose-600 hover:bg-rose-50" : "text-slate-700",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
