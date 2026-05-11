import { Bell, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { DataPill, WorkspaceItem } from "./WorkbenchControls.jsx";

export function WorkbenchHeader({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
  enabled,
  setEnabled,
  unsaved,
  isSaving,
  saveError,
  saveChanges,
  previewActiveTheme,
  resetCurrentTheme,
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-700 text-white">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-950 text-balance">CursorDance</div>
            <div className="text-xs text-slate-500 text-pretty">主题工作台</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          {workspaceItems.map((item) => (
            <WorkspaceItem key={item.id} item={item} active={workspaceId === item.id} onClick={() => setWorkspaceId(item.id)} compact />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DataPill tone={unsaved ? "amber" : "teal"}>{unsaved ? "待保存" : "已保存"}</DataPill>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 xl:flex">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="全局启用开关" />
            <span>全局启用</span>
          </div>
          <Button variant="outline" className="rounded-2xl px-4" onClick={previewActiveTheme}>
            <Play className="mr-2 h-4 w-4" />
            网页预览
          </Button>
          <Button className="rounded-2xl bg-emerald-700 px-4 text-white hover:bg-emerald-800" onClick={saveChanges}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
          <Button variant="outline" className="rounded-2xl px-4" onClick={resetCurrentTheme}>
            <RotateCcw className="mr-2 h-4 w-4" />
            恢复默认
          </Button>
        </div>
      </div>
      {saveError ? (
        <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {saveError}
        </div>
      ) : null}
    </header>
  );
}
