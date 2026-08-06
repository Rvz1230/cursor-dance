import { useState } from "react";
import { Download, FileJson, MoreHorizontal } from "lucide-react";
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
      <PopoverContent className="w-52 p-1" align={align} sideOffset={6}>
        <div className="px-2.5 pb-1 pt-1.5 text-2xs font-medium text-slate-400">
          主题库 · {themeCount} 个主题
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
          onClick={() => {
            setOpen(false);
            onImport();
          }}
        >
          <FileJson className="size-4 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 flex-1">导入 JSON…</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          onClick={() => {
            setOpen(false);
            onExportCurrent();
          }}
          disabled={!themeCount}
        >
          <Download className="size-4 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">导出“{currentThemeName}”</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
