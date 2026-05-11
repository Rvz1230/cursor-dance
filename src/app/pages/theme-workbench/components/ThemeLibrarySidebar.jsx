import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, FileJson, Plus, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { DataPill, SmallSelect, ThemeCard } from "./WorkbenchControls.jsx";

function ThemeComposerModal({
  open,
  mode,
  setMode,
  themes,
  themeId,
  createTheme,
  importThemeFromText,
  closeComposer,
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

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeComposer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeComposer]);

  function handleCreate() {
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
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "新建主题失败。");
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
    } catch (error) {
      setImportSuccess("");
      setImportError(error instanceof Error ? error.message : "导入主题失败。");
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/22 px-4 py-8" onClick={closeComposer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-composer-title"
        className="flex max-h-[min(720px,calc(100dvh-4rem))] w-full max-w-[640px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-[#f8fafc] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div id="theme-composer-title" className="text-base font-semibold text-slate-900">主题管理</div>
            <div className="mt-1 text-sm text-slate-500">新建一个可编辑主题，或导入现有 JSON 主题包。</div>
          </div>
          <Button variant="ghost" className="h-9 rounded-full px-4 text-sm" onClick={closeComposer}>
            关闭
          </Button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <Tabs value={mode} className="mb-4">
            <TabsList value={mode} className="w-full justify-start bg-white" onValueChange={setMode}>
              <TabsTrigger value="create">新建主题</TabsTrigger>
              <TabsTrigger value="import">导入 JSON</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "create" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase text-slate-500">主题名称</label>
                <Input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="例如：Warm Click Studio"
                  className="bg-white"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase text-slate-500">起始模板</label>
                <SmallSelect value={createBaseThemeId} options={baseThemeOptions} onChange={setCreateBaseThemeId} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase text-slate-500">主题说明</label>
                <textarea
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="一句话说明这个主题更适合什么场景。"
                  rows={4}
                  className="w-full rounded-2xl border border-black/5 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                />
              </div>

              {createError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{createError}</div> : null}

              <div className="flex items-center justify-between gap-3">
                <DataPill tone="amber">新主题会先进入工作台，保存后写入扩展配置</DataPill>
                <Button className="rounded-full px-4" onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  创建主题
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-black/5">
                    <FileJson className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">导入本地 JSON 主题包</div>
                    <div className="mt-1 text-sm text-pretty text-slate-500">
                      支持直接导入单个主题对象，也支持带 `themePack` / `theme` 包裹的 JSON 文件。
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Button variant="outline" className="rounded-full px-4" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        选择 JSON 文件
                      </Button>
                      <DataPill>导入后会自动选中</DataPill>
                    </div>
                  </div>
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportChange} />

              {importSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{importSuccess}</span>
                  </div>
                </div>
              ) : null}

              {importError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{importError}</div> : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ThemeLibrarySidebar({ themes, themeId, setThemeId, createTheme, importThemeFromText }) {
  const [query, setQuery] = useState("");
  const [composerMode, setComposerMode] = useState("");

  const filteredThemes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return themes;
    return themes.filter((theme) =>
      [theme.name, theme.summary, theme.kind]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [query, themes]);

  return (
    <aside className="flex w-[304px] flex-col border-r border-slate-200 bg-[#f3f6f8]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <div className="text-xs font-medium uppercase text-slate-500">主题包</div>
            <div className="mt-1 text-xs text-slate-500">{themes.length} 个主题可管理</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={composerMode === "import" ? "default" : "ghost"}
              size="icon"
              aria-label="导入主题包"
              className="h-9 w-9 rounded-2xl"
              onClick={() => setComposerMode((current) => (current === "import" ? "" : "import"))}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant={composerMode === "create" ? "default" : "outline"}
              className="h-9 rounded-2xl px-3 text-xs"
              onClick={() => setComposerMode((current) => (current === "create" ? "" : "create"))}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建
            </Button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索主题包"
            className="rounded-2xl bg-white"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {filteredThemes.length ? (
            filteredThemes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} selected={theme.id === themeId} onClick={() => setThemeId(theme.id)} />
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
              <div className="font-medium text-slate-900">没有找到匹配的主题</div>
              <div className="mt-1 text-pretty text-slate-500">换个关键词，或者直接创建一个新主题继续编辑。</div>
              <Button variant="outline" className="mt-4 rounded-full px-4" onClick={() => setComposerMode("create")}>
                <Plus className="mr-2 h-4 w-4" />
                新建一个主题
              </Button>
            </div>
          )}
        </div>
      </div>

      <ThemeComposerModal
        open={Boolean(composerMode)}
        mode={composerMode || "create"}
        setMode={setComposerMode}
        themes={themes}
        themeId={themeId}
        createTheme={createTheme}
        importThemeFromText={importThemeFromText}
        closeComposer={() => setComposerMode("")}
      />
    </aside>
  );
}
