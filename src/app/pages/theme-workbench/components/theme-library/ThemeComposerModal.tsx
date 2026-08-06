import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileJson, Plus, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { DataPill } from "@/components/ui/data-pill";
import { Select } from "@/components/ui/select";
import { pickThemeFile } from "../../lib/workbenchConfig";

export function ThemeComposerModal({
  open,
  mode,
  setMode,
  themes,
  themeId,
  createTheme,
  importThemeFromText,
  closeComposer,
  notify,
}) {
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createBaseThemeId, setCreateBaseThemeId] = useState(themeId);
  const [createError, setCreateError] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const fileInputRef = useRef(null);

  const baseThemeOptions = useMemo(
    () => [
      { value: "blank", label: "空白主题" },
      ...themes.map((theme) => ({ value: theme.id, label: theme.name })),
    ],
    [themes]
  );

  function handleCreate(event) {
    event.preventDefault();
    try {
      createTheme({
        name: createName,
        description: createDescription,
        basedOnThemeId: createBaseThemeId,
      });
      setCreateError("");
      setCreateName("");
      setCreateDescription("");
      setCreateBaseThemeId(themeId);
      closeComposer();
      notify?.({ tone: "success", title: "已创建主题", description: createName.trim() || "新主题已进入工作台。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "新建主题失败。";
      setCreateError(message);
      notify?.({ tone: "error", title: "新建主题失败", description: message });
    }
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      importThemeFromText(text, file.name);
      setImportError("");
      setImportSuccess(`已导入 ${file.name}`);
      closeComposer();
      notify?.({ tone: "success", title: "已导入主题", description: file.name });
    } catch (error) {
      setImportSuccess("");
      const message = error instanceof Error ? error.message : "导入主题失败。";
      setImportError(message);
      notify?.({ tone: "error", title: "导入主题失败", description: message });
    }
  }

  // 桌面端走 cursorDanceDialog（IPC + showOpenDialog）；扩展端无桥时返回 null,
  // 由调用方回落到 <input type=file> 路径。
  async function handlePickFromNativeDialog() {
    try {
      const picked = await pickThemeFile();
      if (!picked) {
        // 没桥（扩展端）→ 触发隐藏 file input；
        // 有桥但用户取消 → picked 也是 null；用「桥是否存在」区分。
        if (typeof window !== "undefined" && window.cursorDanceDialog) {
          // 用户在原生对话框中取消，不报错也不通知。
          return;
        }
        fileInputRef.current?.click();
        return;
      }
      importThemeFromText(picked.contents, picked.fileName);
      setImportError("");
      setImportSuccess(`已导入 ${picked.fileName}`);
      closeComposer();
      notify?.({ tone: "success", title: "已导入主题", description: picked.fileName });
    } catch (error) {
      setImportSuccess("");
      const message = error instanceof Error ? error.message : "导入主题失败。";
      setImportError(message);
      notify?.({ tone: "error", title: "导入主题失败", description: message });
    }
  }

  const dialogTitle = mode === "import" ? "导入主题" : "新建主题";
  const dialogDescription = mode === "import"
    ? "从本地 JSON 文件导入主题包，导入后会自动进入工作台。"
    : "创建一个可编辑主题，从空白模板开始，或基于现有主题继续调整。";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) closeComposer();
    }}>
      <DialogContent titleId="theme-composer-title" title={dialogTitle}>
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-7">
          <div className="flex flex-col gap-1">
            <div id="theme-composer-title" className="text-base font-semibold text-slate-900 text-balance">{dialogTitle}</div>
            <DialogDescription className="text-xs leading-relaxed text-slate-500 text-pretty">{dialogDescription}</DialogDescription>
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="create">新建主题</TabsTrigger>
              <TabsTrigger value="import">导入 JSON</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "create" ? (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label htmlFor="theme-create-name" className="text-xs font-medium text-slate-600">主题名称</label>
                <Input
                  id="theme-create-name"
                  value={createName}
                  onChange={(event) => {
                    setCreateName(event.target.value);
                    setCreateError("");
                  }}
                  placeholder="例如：Warm Click Studio"
                  className="bg-white"
                  autoFocus
                  required
                  aria-required="true"
                  aria-describedby={createError ? "theme-create-error" : "theme-create-hint"}
                  aria-invalid={Boolean(createError)}
                />
                <p id="theme-create-hint" className="text-xs leading-relaxed text-slate-500 text-pretty">
                  新主题会先进入工作台，保存后写入当前配置。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">起始模板</label>
                <Select value={createBaseThemeId} options={baseThemeOptions} onChange={setCreateBaseThemeId} label="选择起始模板" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="theme-create-description" className="text-xs font-medium text-slate-600">主题说明</label>
                <textarea
                  id="theme-create-description"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="一句话说明这个主题更适合什么场景。"
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                />
              </div>

              {createError ? <div id="theme-create-error" className="rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{createError}</div> : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeComposer}>取消</Button>
                <Button type="submit">
                  <Plus className="mr-2 size-4" />
                  创建主题
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    <FileJson className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 text-balance">导入本地 JSON 主题包</div>
                    <div className="mt-1 text-xs leading-relaxed text-pretty text-slate-500">
                      支持直接导入单个主题对象，也支持带 `themePack` / `theme` 包裹的 JSON 文件。
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Button variant="outline" onClick={handlePickFromNativeDialog}>
                        <Upload className="mr-2 size-4" aria-hidden="true" />
                        选择 JSON 文件
                      </Button>
                      <DataPill>导入后会自动选中</DataPill>
                    </div>
                  </div>
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportChange} />

              {importSuccess ? (
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    <span>{importSuccess}</span>
                  </div>
                </div>
              ) : null}

              {importError ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{importError}</div> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
