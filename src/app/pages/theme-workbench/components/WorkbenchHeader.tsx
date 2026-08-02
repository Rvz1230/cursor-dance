import { Bot, Loader2, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";
import { Switch } from "@/components/ui/switch";
import { WorkspaceItem } from "./WorkbenchControls";

export function WorkbenchHeader({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
  enabled,
  setEnabled,
  unsaved,
  undo = undefined,
  redo = undefined,
  isSaving,
  saveError = "",
  saveChanges,
  resetCurrentTheme,
  aiPanelOpen = false,
  setAiPanelOpen = (_value: boolean) => {},
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-2.5">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900 text-balance">CursorDance</div>
            <div className="text-xs text-slate-500 text-pretty">主题工作台</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          {workspaceItems.map((item) => (
            <WorkspaceItem key={item.id} item={item} active={workspaceId === item.id} onClick={() => setWorkspaceId(item.id)} compact />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/*
            撤销 / 重做要有可见入口。只有 ⌘Z 的功能等于隐藏功能——
            没人会去猜一个没有按钮的快捷键存在。两端工具栏都要有（决策 #1 / #6）。
          */}
          {undo || redo ? (
            <div className="flex h-8 items-center rounded-xl bg-slate-50 px-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-lg"
                onClick={undo?.run}
                disabled={!undo?.label}
                title={undo?.label ? `撤销：${undo.label}（⌘Z）` : "没有可撤销的改动"}
                aria-label={undo?.label ? `撤销：${undo.label}` : "没有可撤销的改动"}
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-lg"
                onClick={redo?.run}
                disabled={!redo?.label}
                title={redo?.label ? `重做：${redo.label}（⌘⇧Z）` : "没有可重做的改动"}
                aria-label={redo?.label ? `重做：${redo.label}` : "没有可重做的改动"}
              >
                <Redo2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
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
