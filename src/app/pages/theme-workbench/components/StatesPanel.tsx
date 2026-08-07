import { useEffect, useMemo, useRef, useState } from "react";
import { Info, RotateCcw, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { isDesktop } from "@/shared/runtime";
import { getAllCursorStates } from "@/shared/cursor-states";
import { hotspotToImagePixels, normalizeHotspot } from "@/shared/effect-core/cursor-hotspot";
import type { CursorSkin, CursorSkinState } from "@/shared/domain/cursor-dance";
import { validateCursorAssetFile } from "../lib/cursorAssetPresets";
import type { CursorAssetDraft, RecentCursorAsset } from "../lib/storage/repository/types";
import {
  CursorCalibrationStage,
  CursorCapabilityNote,
  CursorModeTabs,
  CursorProperties,
  CursorSlotList,
  CursorTrialStage,
  EmptyCursorStage,
  PendingAssetTray,
  StageBackgroundPicker,
  withCursorStateIcon,
  type CursorStateCard,
  type PendingCursorAsset,
  type StageBackground,
  type StudioMode,
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
  type Hotspot,
} from "./cursor-skin/cursorSkinModel";

type StatusTone = "success" | "error" | "warning" | "info";

export interface StatesPanelProps {
  stateId: string;
  setStateId: (next: string) => void;
  cursorSkin: CursorSkin | null;
  recentCursorAssets?: readonly RecentCursorAsset[];
  notify: (input: { title: string; description?: string; tone?: StatusTone }) => string;
  setCursorSkinEnabled: (enabled: boolean) => void;
  updateCursorSkinState: (stateId: string, skinState: CursorSkinState) => void;
  clearCursorSkinState: (stateId: string) => void;
  copyDefaultCursorSkinState: (stateId: string) => void;
  resetCursorSkin: () => void;
  rememberRecentCursorAsset?: (asset: CursorAssetDraft) => void | Promise<void>;
}

export function StatesPanel({
  stateId,
  setStateId,
  cursorSkin,
  recentCursorAssets = [],
  notify,
  setCursorSkinEnabled,
  updateCursorSkinState,
  clearCursorSkinState,
  copyDefaultCursorSkinState,
  resetCursorSkin,
  rememberRecentCursorAsset,
}: StatesPanelProps) {
  const singleInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef("default");
  const pendingRef = useRef<PendingCursorAsset[]>([]);
  const [mode, setMode] = useState<StudioMode>("try");
  const [background, setBackground] = useState<StageBackground>("light");
  const [onlyEffective, setOnlyEffective] = useState(false);
  const [pendingAssets, setPendingAssets] = useState<PendingCursorAsset[]>([]);
  const platform = isDesktop() ? "desktop" : "extension";
  const hasMaster = Boolean(cursorSkin?.states?.default);

  const stateDescriptors = useMemo(
    () => getAllCursorStates().map(withCursorStateIcon),
    [],
  );

  const stateCards: CursorStateCard[] = useMemo(() => {
    const defaultState = cursorSkin?.states?.default || null;
    return stateDescriptors.map((state) => {
      const ownState = cursorSkin?.states?.[state.id] || null;
      return {
        ...state,
        ownState,
        resolvedState: ownState || defaultState,
        inherited: state.id !== "default" && !ownState,
        reachable: state.reachableOn.includes(platform),
      };
    });
  }, [cursorSkin, platform, stateDescriptors]);

  const currentCard = stateCards.find((card) => card.id === stateId) || stateCards[0];
  const defaultState = getResolvedSkinState(cursorSkin, "default").state;
  const grabbingState = getResolvedSkinState(cursorSkin, "grabbing").state;
  const systemCursorCapability = window.electronAPI?.capabilities.systemCursorReplacement;

  pendingRef.current = pendingAssets;
  useEffect(() => () => {
    pendingRef.current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
  }, []);

  function showMessage(text: string, tone: StatusTone) {
    notify({ title: text, tone });
  }

  async function buildSkinStateFromFile(file: File, targetStateId: string): Promise<CursorSkinState> {
    const validationMessage = validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES);
    if (validationMessage) throw new Error(validationMessage);
    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await getAssetDimensions(dataUrl);
    const stateMeta = stateDescriptors.find((state) => state.id === targetStateId);
    return {
      image: {
        kind: "dataUrl",
        mimeType: inferMimeType(dataUrl, file.type),
        dataUrl,
        width: dimensions.width,
        height: dimensions.height,
      },
      hotspot: getDefaultHotspot(stateMeta),
      size: { mode: "fixedBox", boxSize: DEFAULT_BOX_SIZE },
    };
  }

  async function applyFile(file: File | undefined, targetStateId = stateId, announce = true): Promise<boolean> {
    if (!file) return false;
    try {
      const skinState = await buildSkinStateFromFile(file, targetStateId);
      updateCursorSkinState(targetStateId, skinState);
      const cachedHotspot = hotspotToImagePixels(
        normalizeHotspot(skinState.hotspot),
        skinState.image.width,
        skinState.image.height,
      );
      void rememberRecentCursorAsset?.({
        imageDataUrl: skinState.image.kind === "dataUrl" ? skinState.image.dataUrl : undefined,
        hotspotX: cachedHotspot.x,
        hotspotY: cachedHotspot.y,
        size: skinState.size.boxSize || DEFAULT_BOX_SIZE,
        sourceWidth: skinState.image.width,
        sourceHeight: skinState.image.height,
        name: file.name,
        mimeType: skinState.image.mimeType,
      });
      if (announce) {
        const label = stateDescriptors.find((state) => state.id === targetStateId)?.label || targetStateId;
        showMessage(`已应用到「${label}」。`, "success");
      }
      return true;
    } catch (error) {
      if (announce) showMessage(error instanceof Error ? error.message : "素材读取失败。", "error");
      return false;
    }
  }

  function openSinglePicker(targetStateId: string) {
    uploadTargetRef.current = targetStateId;
    singleInputRef.current?.click();
  }

  function addPendingFiles(files: readonly File[]) {
    const validFiles = files.filter((file) => !validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES));
    const additions = validFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingAssets((current) => [...current, ...additions]);
    return { added: additions.length, rejected: files.length - validFiles.length };
  }

  async function applyBatchFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let applied = 0;
    let rejected = 0;
    const unmatched: File[] = [];
    const occupied = new Set<string>();
    for (const file of files) {
      const matchedStateId = matchStateId(file.name);
      if (!matchedStateId || occupied.has(matchedStateId)) {
        unmatched.push(file);
        continue;
      }
      if (await applyFile(file, matchedStateId, false)) {
        occupied.add(matchedStateId);
        applied += 1;
      } else {
        rejected += 1;
      }
    }
    const pending = addPendingFiles(unmatched);
    rejected += pending.rejected;
    showMessage(
      `已自动匹配 ${applied} 个状态${pending.added ? `，${pending.added} 个素材进入待分配` : ""}${rejected ? `，${rejected} 个文件无效` : ""}。`,
      rejected ? "warning" : pending.added ? "info" : "success",
    );
  }

  function removePending(assetId: string) {
    setPendingAssets((current) => {
      const removed = current.find((asset) => asset.id === assetId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((asset) => asset.id !== assetId);
    });
  }

  async function assignPending(assetId: string, targetStateId: string) {
    const asset = pendingAssets.find((item) => item.id === assetId);
    if (!asset) return;
    if (await applyFile(asset.file, targetStateId)) {
      removePending(assetId);
      setStateId(targetStateId);
    }
  }

  function updateHotspot(targetStateId: string, hotspot: Hotspot) {
    const ownState = cursorSkin?.states?.[targetStateId];
    if (!ownState) return;
    updateCursorSkinState(targetStateId, { ...ownState, hotspot });
  }

  function updateSize(targetStateId: string, boxSize: number) {
    const ownState = cursorSkin?.states?.[targetStateId];
    if (!ownState) return;
    updateCursorSkinState(targetStateId, { ...ownState, size: { mode: "fixedBox", boxSize } });
  }

  function deriveAllStates() {
    const inheriting = stateCards.filter((card) => card.id !== "default" && !card.ownState);
    inheriting.forEach((card) => copyDefaultCursorSkinState(card.id));
    showMessage(inheriting.length ? `已派生 ${inheriting.length} 个独立素材。` : "所有状态都已经是独立素材。", inheriting.length ? "success" : "info");
  }

  function clearPending() {
    pendingAssets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    setPendingAssets([]);
  }

  function applyRecentAsset(asset: RecentCursorAsset) {
    if (!asset.imageDataUrl || !currentCard) return;
    updateCursorSkinState(currentCard.id, buildSkinStateFromAsset(asset));
    showMessage(`已把最近素材应用到「${currentCard.label}」。`, "success");
  }

  function resetAll() {
    clearPending();
    resetCursorSkin();
    setStateId("default");
    setMode("try");
    showMessage("光标皮肤已重置。", "success");
  }

  if (!currentCard) return null;

  return (
    <div className="cursor-skin-workspace min-h-full bg-slate-100 p-3">
      <input
        ref={singleInputRef}
        type="file"
        accept="image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          void applyFile(event.target.files?.[0], uploadTargetRef.current);
          event.target.value = "";
        }}
      />
      <input
        ref={batchInputRef}
        type="file"
        accept="image/png,image/webp,image/svg+xml"
        multiple
        className="hidden"
        onChange={(event) => {
          void applyBatchFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="mx-auto max-w-[1480px]">
        <PageHeader
          className="cursor-skin-header mb-2.5"
          title="光标皮肤"
          description={hasMaster ? "上传图片替换鼠标指针。在舞台里移动鼠标即可实时试用，改动自动保存。" : "先上传一张主皮肤，之后就能在舞台里试用、并用准星测试校准指向点。"}
          actions={(
            <>
            {hasMaster ? (
              <button
                type="button"
                role="switch"
                aria-checked={cursorSkin?.enabled !== false}
                onClick={() => setCursorSkinEnabled(cursorSkin?.enabled === false)}
                className="flex h-8 items-center gap-2 rounded-xl bg-white px-2.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200"
              >
                <span className={cursorSkin?.enabled !== false ? "relative inline-flex h-4 w-7 items-center rounded-full bg-slate-950" : "relative inline-flex h-4 w-7 items-center rounded-full bg-slate-300"}>
                  <span className={cursorSkin?.enabled !== false ? "ml-3.5 size-3 rounded-full bg-white shadow-sm transition-transform" : "ml-0.5 size-3 rounded-full bg-white shadow-sm transition-transform"} />
                </span>
                <span className="font-medium">启用皮肤</span>
              </button>
            ) : null}
            <button type="button" onClick={() => batchInputRef.current?.click()} className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              <Upload className="mr-1.5 size-3.5" aria-hidden />批量导入
            </button>
            {hasMaster ? (
              <button type="button" onClick={resetAll} className="inline-flex h-8 items-center rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-900">
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden />重置
              </button>
            ) : null}
            </>
          )}
        />

        {systemCursorCapability && systemCursorCapability.status !== "supported" ? (
          <div className="mb-2.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{systemCursorCapability.message}</span>
          </div>
        ) : null}

        <div className="cursor-skin-layout grid gap-2.5">
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-[49px] flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              {hasMaster ? <CursorModeTabs mode={mode} onChange={setMode} /> : <div className="text-sm font-medium text-slate-900">上传主皮肤</div>}
              {hasMaster && mode === "try" ? <StageBackgroundPicker value={background} onChange={setBackground} /> : null}
            </div>
            <div className="px-4 py-3">
              {!hasMaster ? (
                <>
                  <EmptyCursorStage onPick={() => openSinglePicker("default")} onBatchPick={() => batchInputRef.current?.click()} onDrop={(files) => void applyFile(files?.[0], "default")} />
                  <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-2xs leading-relaxed text-slate-500">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>macOS 会隐藏系统光标、用你的皮肤完全替代。Windows 暂时保留系统光标，皮肤作为跟随层叠加显示。</span>
                  </div>
                </>
              ) : mode === "try" ? (
                <>
                  <CursorTrialStage
                    defaultState={defaultState}
                    grabbingState={grabbingState}
                    enabled={cursorSkin?.enabled !== false}
                    background={background}
                    onFixHotspot={(hotspot) => updateHotspot("default", hotspot)}
                  />
                  <PendingAssetTray assets={pendingAssets} recentAssets={recentCursorAssets} onClear={clearPending} onApplyRecent={applyRecentAsset} />
                </>
              ) : currentCard.ownState ? (
                <>
                  <CursorCalibrationStage skinState={currentCard.ownState} stateLabel={currentCard.label} onChangeHotspot={(hotspot) => updateHotspot(currentCard.id, hotspot)} />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-medium text-slate-600">快速定位</span>
                    <button type="button" onClick={() => updateHotspot(currentCard.id, { x: 0, y: 0 })} className="h-7 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm">左上尖端</button>
                    <button type="button" onClick={() => updateHotspot(currentCard.id, { x: 0.5, y: 0.5 })} className="h-7 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm">中心</button>
                    <button type="button" onClick={() => updateHotspot(currentCard.id, { x: 0.5, y: 1 })} className="h-7 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm">底部中心</button>
                    <span className="ml-auto text-2xs text-slate-500">按原图像素显示 · 内部按比例存储，改尺寸不会失准</span>
                  </div>
                </>
              ) : (
                <div className="cursor-skin-stage grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                  <div><p className="text-sm font-medium text-slate-700">{currentCard.label}正在继承主皮肤</p><button type="button" onClick={() => copyDefaultCursorSkinState(currentCard.id)} className="mt-3 h-8 rounded-xl border border-slate-950 bg-slate-950 px-3 text-xs font-medium text-white">派生后校准</button></div>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0 space-y-2.5">
            <CursorSlotList
              cards={stateCards}
              selectedId={currentCard.id}
              hasMaster={hasMaster}
              onlyEffective={onlyEffective}
              onOnlyEffectiveChange={setOnlyEffective}
              onSelect={setStateId}
              onDerive={(id) => { copyDefaultCursorSkinState(id); setStateId(id); }}
              onInherit={(id) => clearCursorSkinState(id)}
              onDeriveAll={deriveAllStates}
              onUploadDefault={() => openSinglePicker("default")}
              onAssignPending={(assetId, targetStateId) => void assignPending(assetId, targetStateId)}
            />
            {hasMaster ? (
              <CursorProperties
                card={currentCard}
                mode={mode}
                onModeChange={setMode}
                onChangeHotspot={(hotspot) => updateHotspot(currentCard.id, hotspot)}
                onChangeSize={(size) => updateSize(currentCard.id, size)}
                onClear={() => clearCursorSkinState(currentCard.id)}
                onReplace={() => openSinglePicker(currentCard.id)}
                onDerive={() => copyDefaultCursorSkinState(currentCard.id)}
              />
            ) : (
              <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center"><p className="text-xs font-medium text-slate-500">尺寸与指向点</p><p className="mx-auto mt-1.5 max-w-[220px] text-2xs leading-relaxed text-slate-500">上传主皮肤后在这里调整，并用准星测试验证。</p></section>
            )}
            <CursorCapabilityNote />
          </aside>
        </div>
      </div>
    </div>
  );
}
