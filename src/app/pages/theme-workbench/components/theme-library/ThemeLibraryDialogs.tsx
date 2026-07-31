import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ThemeLibraryDialogs({
  pendingDeleteTheme,
  setPendingDeleteTheme,
  handleDeleteTheme,
  pendingSwitchThemeId,
  setPendingSwitchThemeId,
  currentThemeName,
  handleCancelSwitch,
  handleDiscardAndSwitch,
  handleSaveAndSwitch,
  isSwitching,
}) {
  return (
    <>
      <AlertDialog open={Boolean(pendingDeleteTheme)} onOpenChange={(open) => {
        if (!open) setPendingDeleteTheme(null);
      }}>
        <AlertDialogContent>
          <AlertDialogTitle className="text-base font-semibold text-slate-900">删除主题？</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm leading-6 text-slate-600 text-pretty">
            确定删除主题"{pendingDeleteTheme?.name}"吗？此操作会在下次保存时写入扩展配置。
          </AlertDialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
              onClick={handleDeleteTheme}
            >
              删除主题
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingSwitchThemeId)} onOpenChange={(open) => {
        if (!open) setPendingSwitchThemeId(null);
      }}>
        <AlertDialogContent>
          <AlertDialogTitle className="text-base font-semibold text-slate-900">
            「{currentThemeName}」有未保存的更改
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm leading-6 text-slate-600 text-pretty">
            切换主题前要保存这些更改吗？不保存的更改不会丢失，但关闭页面后会消失。
          </AlertDialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              onClick={handleCancelSwitch}
            >
              取消
            </AlertDialogCancel>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              onClick={handleDiscardAndSwitch}
            >
              不保存直接切换
            </button>
            <AlertDialogAction
              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-60"
              onClick={handleSaveAndSwitch}
              disabled={isSwitching}
            >
              {isSwitching ? "保存中..." : "保存并切换"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
