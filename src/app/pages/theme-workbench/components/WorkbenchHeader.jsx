import { Bot, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { BrandMark } from "@/components/ui/brand-mark.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { WorkspaceItem } from "./WorkbenchControls.jsx";

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
  resetCurrentTheme,
  aiPanelOpen,
  setAiPanelOpen,
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-2.5">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950 text-balance">CursorDance</div>
            <div className="text-xs text-slate-500 text-pretty">主题工作台</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          {workspaceItems.map((item) => (
            <WorkspaceItem key={item.id} item={item} active={workspaceId === item.id} onClick={() => setWorkspaceId(item.id)} compact />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {workspaceId === "workbench" ? (
            <Button
              variant={aiPanelOpen ? "default" : "outline"}
              onClick={() => setAiPanelOpen?.(!aiPanelOpen)}
            >
              <Bot className="mr-2 h-4 w-4" />
              AI 助手
            </Button>
          ) : null}
          <div className="hidden h-8 items-center gap-2 rounded-xl bg-slate-50 px-2.5 text-sm text-slate-600 xl:flex">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="全局启用开关" />
            <span>全局启用</span>
          </div>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={saveChanges} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                保存
                {unsaved ? <span className="ml-1.5 size-1.5 rounded-full bg-amber-400" aria-label="有未保存的更改" /> : null}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetCurrentTheme}>
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
