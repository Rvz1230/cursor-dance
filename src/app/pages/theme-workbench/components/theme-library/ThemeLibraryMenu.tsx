import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ThemeLibraryMenuProps {
  align?: "start" | "end";
  themeCount: number;
  currentThemeName: string;
  onImport: () => void;
  onExportCurrent: () => void;
}

export function ThemeLibraryMenu({
  align = "end",
  themeCount,
  currentThemeName,
  onImport,
  onExportCurrent,
}: ThemeLibraryMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-xl text-slate-500 hover:bg-white"
          aria-label="主题库操作"
          title="主题库操作"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] rounded-xl p-1" align={align} sideOffset={4}>
        <button
          type="button"
          className="flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          onClick={() => {
            setOpen(false);
            onImport();
          }}
        >
          <span className="min-w-0 flex-1">导入…</span>
          <span className="shrink-0 text-xs text-slate-500">.json</span>
        </button>
        <button
          type="button"
          className="flex w-full items-baseline gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-slate-400"
          onClick={() => {
            setOpen(false);
            onExportCurrent();
          }}
          disabled={!themeCount}
        >
          <span className="min-w-0 flex-1 truncate">导出当前主题</span>
          <span className="max-w-20 shrink-0 truncate text-xs text-slate-500">{currentThemeName}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
