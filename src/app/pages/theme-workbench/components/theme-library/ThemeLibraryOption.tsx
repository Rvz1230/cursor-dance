import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import { ICON_OPTIONS } from "@/components/ui/theme-identity";
import type { WorkbenchActionConfig, WorkbenchThemeMeta } from "../../hooks/workbenchStateTypes";
import { ThemeSignature } from "./ThemeSignature";

interface ThemeLibraryOptionProps {
  theme: WorkbenchThemeMeta;
  actionConfig?: WorkbenchActionConfig;
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
  actionConfig,
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
        "group relative flex min-h-[47px] w-full cursor-default items-center gap-2.5 rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        selected
          ? "shadow-sm ring-1 ring-slate-200"
          : "",
      )}
      onClick={onSelect}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-slate-950 transition-[height]",
          selected ? "h-5" : "h-0",
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          "relative grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border",
          selected ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50",
        )}
        title={`${theme.name} 的效果样张（由主题数据派生）`}
        aria-hidden="true"
      >
        <ThemeSignature actionConfig={actionConfig} />
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
            className="size-6 shrink-0 rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`${theme.name} 更多操作`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[188px] rounded-xl p-1" align="end" sideOffset={4} onClick={(event) => event.stopPropagation()}>
          {showIcons ? (
            <>
              <div className="mb-1 px-1 pt-1 text-xs font-semibold text-slate-500">换图标</div>
              <div className="grid grid-cols-6 gap-1 p-1">
                {ICON_OPTIONS.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "grid size-7 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                      theme.icon === name ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
                    )}
                    aria-label={`使用 ${name} 图标`}
                    onClick={() => {
                      onUpdateIcon?.(theme.id, name);
                      closeMenu();
                    }}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <MenuAction label="复制为自定义主题" onClick={() => { closeMenu(); onDuplicate(); }} />
              <MenuAction label="重命名" onClick={() => { closeMenu(); setEditingName(theme.name); }} />
              <MenuAction label="换图标" onClick={() => setShowIcons(true)} />
              <MenuAction label="导出为 .json" onClick={() => { closeMenu(); onExport(); }} />
              <MenuAction label="删除" danger disabled={!canDelete} onClick={() => { closeMenu(); onDelete(); }} />
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MenuAction({
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent",
        danger && !disabled ? "text-rose-600" : "text-slate-700",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {disabled ? <span className="shrink-0 text-xs text-slate-300">不可用</span> : null}
    </button>
  );
}
