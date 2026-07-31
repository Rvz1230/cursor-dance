import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { CURSOR_STATES } from "../model/workbenchSchema";
import { validateCursorAssetFile } from "../lib/cursorAssetPresets";
import {
  CursorImage,
  DropUpload,
  HotspotStudio,
  RecentAssets,
  StateRail,
  TryZone,
} from "./cursor-skin/CursorSkinStudio";
import {
  DEFAULT_BOX_SIZE,
  MAX_CURSOR_UPLOAD_BYTES,
  buildSkinStateFromAsset,
  getAssetDimensions,
  getDefaultHotspot,
  getResolvedSkinState,
  inferMimeType,
  matchStateId,
  readFileAsDataUrl,
} from "./cursor-skin/cursorSkinModel";

export function StatesPanel({
  stateId,
  setStateId,
  cursorSkin,
  recentCursorAssets,
  updateCursorSkinState,
  clearCursorSkinState,
  copyDefaultCursorSkinState,
  resetCursorSkin,
  rememberRecentCursorAsset,
  updateCursorStateAsset,
  updateCursorStateAssetForState,
}) {
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("slate");
  const currentMeta = CURSOR_STATES.find((state) => state.id === stateId) || CURSOR_STATES[0];
  const currentSkinState = cursorSkin?.states?.[stateId] || null;
  const resolvedSkinState = getResolvedSkinState(cursorSkin, stateId);
  const systemCursorCapability = window.electronAPI?.capabilities.systemCursorReplacement;
  const stateCards = useMemo(() => {
    const defaultState = cursorSkin?.states?.default || null;
    return CURSOR_STATES.map((state) => {
      const ownState = cursorSkin?.states?.[state.id] || null;
      return { ...state, ownState, resolvedState: ownState || defaultState, inherited: state.id !== "default" && !ownState };
    });
  }, [cursorSkin]);

  useEffect(() => {
    setMessage("");
    setMessageTone("slate");
  }, [stateId]);

  async function buildSkinStateFromFile(file, targetStateId) {
    const validationMessage = validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES);
    if (validationMessage) throw new Error(validationMessage);
    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await getAssetDimensions(dataUrl);
    const stateMeta = CURSOR_STATES.find((state) => state.id === targetStateId);
    return {
      image: { kind: "dataUrl", mimeType: inferMimeType(dataUrl, file.type), dataUrl, width: dimensions.width, height: dimensions.height },
      hotspot: getDefaultHotspot(stateMeta, dimensions.width, dimensions.height),
      size: { mode: "fixedBox", boxSize: DEFAULT_BOX_SIZE },
    };
  }

  async function applyFile(file, targetStateId = stateId) {
    if (!file) return;
    try {
      const skinState = await buildSkinStateFromFile(file, targetStateId);
      updateCursorSkinState(targetStateId, skinState);
      const legacyAsset = {
        imageDataUrl: skinState.image.dataUrl,
        hotspotX: skinState.hotspot.x,
        hotspotY: skinState.hotspot.y,
        size: skinState.size.boxSize || DEFAULT_BOX_SIZE,
        sourceWidth: skinState.image.width,
        sourceHeight: skinState.image.height,
        name: file.name,
        mimeType: skinState.image.mimeType,
      };
      if (targetStateId === stateId) updateCursorStateAsset?.(legacyAsset);
      else updateCursorStateAssetForState?.(targetStateId, legacyAsset);
      void rememberRecentCursorAsset?.(legacyAsset);
      setMessage(`已应用到「${CURSOR_STATES.find((state) => state.id === targetStateId)?.label || targetStateId}」。`);
      setMessageTone("teal");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "素材读取失败。");
      setMessageTone("rose");
    }
  }

  async function applyBatchFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let applied = 0;
    const unmatched = [];
    const occupied = new Set();
    for (const file of files) {
      const matchedStateId = matchStateId(file.name);
      if (!matchedStateId || occupied.has(matchedStateId)) {
        unmatched.push(file.name);
        continue;
      }
      await applyFile(file, matchedStateId);
      occupied.add(matchedStateId);
      applied += 1;
    }
    setMessage(unmatched.length ? `已自动匹配 ${applied} 个文件，${unmatched.length} 个文件需要手动选择状态。` : `已自动匹配 ${applied} 个状态。`);
    setMessageTone(unmatched.length ? "amber" : "teal");
  }

  function updateHotspot(hotspot) {
    if (!currentSkinState) return;
    updateCursorSkinState(stateId, { ...currentSkinState, hotspot });
  }

  function updateSize(boxSize) {
    if (!currentSkinState) return;
    updateCursorSkinState(stateId, { ...currentSkinState, size: { mode: "fixedBox", boxSize } });
  }

  function applyRecentAsset(asset) {
    if (!asset?.imageDataUrl) return;
    updateCursorSkinState(stateId, buildSkinStateFromAsset(asset));
    updateCursorStateAsset?.(asset);
  }

  return (
    <div className="min-h-full overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-5 text-slate-950">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-[34px] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" /> 光标皮肤工作室
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">给系统光标状态换一整套皮肤</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">你只需要上传每个状态的图片。CursorDance 会在运行时根据系统语义显示普通、文本、可点击、拖拽、忙碌和调整大小等光标。</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <input ref={batchInputRef} type="file" accept="image/png,image/webp,image/svg+xml" multiple className="hidden" onChange={(event) => { void applyBatchFiles(event.target.files); event.target.value = ""; }} />
            <Button variant="secondary" className="h-11 rounded-2xl px-5" onClick={() => batchInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />批量导入
            </Button>
            <Button variant="ghost" className="h-11 rounded-2xl px-5 text-slate-500" onClick={resetCursorSkin}>
              <RotateCcw className="mr-2 h-4 w-4" />重置
            </Button>
          </div>
        </header>

        {systemCursorCapability && systemCursorCapability.status !== "supported" ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-3 text-sm text-amber-800 shadow-sm">
            {systemCursorCapability.message}
          </div>
        ) : null}

        <StateRail stateCards={stateCards} stateId={stateId} setStateId={setStateId} />

        <main className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <DropUpload
              skinState={resolvedSkinState.state}
              stateMeta={currentMeta}
              onPick={(file) => applyFile(file)}
              onDropFiles={(files) => applyFile(files?.[0])}
              fileInputRef={fileInputRef}
            />

            {message ? (
              <div className={cn(
                "rounded-[24px] border px-5 py-3 text-sm shadow-sm backdrop-blur",
                messageTone === "teal" && "border-emerald-200 bg-emerald-50/90 text-emerald-700",
                messageTone === "rose" && "border-rose-200 bg-rose-50/90 text-rose-700",
                messageTone === "amber" && "border-amber-200 bg-amber-50/90 text-amber-700",
                messageTone === "slate" && "border-slate-200 bg-white/80 text-slate-600",
              )}>{message}</div>
            ) : null}

            <HotspotStudio skinState={currentSkinState} stateMeta={currentMeta} onChangeHotspot={updateHotspot} onChangeSize={updateSize} />
          </div>

          <aside className="space-y-5">
            <div className="rounded-[36px] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">当前状态</div>
              <div className="mt-4 flex items-center gap-4">
                <CursorImage skinState={resolvedSkinState.state} inherited={resolvedSkinState.inherited} className="h-20 w-20" />
                <div className="min-w-0">
                  <div className="text-xl font-semibold text-slate-950">{currentMeta.label}</div>
                  <div className="mt-1 text-sm text-slate-500">{currentSkinState ? "使用独立皮肤" : stateId === "default" ? "等待上传" : "继承普通皮肤"}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {stateId !== "default" ? (
                  <Button variant="secondary" className="h-11 rounded-2xl" disabled={!cursorSkin?.states?.default} onClick={() => copyDefaultCursorSkinState(stateId)}>
                    <Check className="mr-2 h-4 w-4" />复制普通状态
                  </Button>
                ) : null}
                <Button variant="ghost" className="h-11 rounded-2xl text-slate-500" disabled={!currentSkinState} onClick={() => clearCursorSkinState(stateId)}>
                  <X className="mr-2 h-4 w-4" />清除当前状态
                </Button>
              </div>
            </div>

            <TryZone cursorSkin={cursorSkin} onSelect={setStateId} />
            <RecentAssets assets={recentCursorAssets} onApply={applyRecentAsset} />
          </aside>
        </main>
      </div>
    </div>
  );
}
