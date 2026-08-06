import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

export interface WorkbenchCommand {
  id: string;
  group: "工作区" | "编辑" | "视图";
  label: string;
  shortcut?: string;
  run: () => void;
  keywords?: string[];
}

export function filterWorkbenchCommands(commands: WorkbenchCommand[], query: string): WorkbenchCommand[] {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return commands;
  return commands.filter((command) =>
    [command.label, command.group, ...(command.keywords ?? [])]
      .some((value) => value.toLocaleLowerCase().includes(keyword)),
  );
}

interface WorkbenchCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: WorkbenchCommand[];
}

export function WorkbenchCommandPalette({
  open,
  onOpenChange,
  commands,
}: WorkbenchCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterWorkbenchCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function runCommand(command: WorkbenchCommand | undefined) {
    if (!command) return;
    onOpenChange(false);
    command.run();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        titleId="workbench-command-palette-title"
        title="命令面板"
        showClose={false}
        className="top-[18%] max-h-[min(520px,calc(100dvh-3rem))] max-w-[560px] translate-y-0 bg-white"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="relative border-b border-slate-200 p-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => filtered.length ? (current + 1) % filtered.length : 0);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => filtered.length ? (current - 1 + filtered.length) % filtered.length : 0);
              } else if (event.key === "Enter") {
                event.preventDefault();
                runCommand(filtered[selectedIndex]);
              }
            }}
            placeholder="搜索工作区或命令…"
            className="h-10 border-0 bg-transparent pl-9 pr-14 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            role="combobox"
            aria-expanded="true"
            aria-controls="workbench-command-list"
            aria-activedescendant={filtered[selectedIndex] ? `workbench-command-${filtered[selectedIndex].id}` : undefined}
          />
          <kbd className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-1.5 py-0.5 text-2xs text-slate-500">esc</kbd>
        </div>

        <div id="workbench-command-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length ? filtered.map((command, index) => {
            const startsGroup = index === 0 || filtered[index - 1].group !== command.group;
            const selected = index === selectedIndex;
            return (
              <div key={command.id}>
                {startsGroup ? (
                  <div className="px-2 pb-1 pt-2 text-xs font-semibold text-slate-500">{command.group}</div>
                ) : null}
                <button
                  id={`workbench-command-${command.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 transition-colors",
                    selected ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50",
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => runCommand(command)}
                >
                  <ArrowRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.shortcut ? <kbd className="shrink-0 rounded-md bg-white px-1 py-0.5 text-2xs text-slate-500 ring-1 ring-slate-200">{command.shortcut}</kbd> : null}
                </button>
              </div>
            );
          }) : (
            <div className="px-4 py-10 text-center text-xs text-slate-500">没有匹配的命令</div>
          )}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-2xs text-slate-500">
          ↑↓ 选择 · ↵ 执行 · esc 关闭
        </div>
      </DialogContent>
    </Dialog>
  );
}
