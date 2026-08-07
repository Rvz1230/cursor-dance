import { useMemo, useRef, useState } from "react";
import { Info, RotateCcw, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { isDesktop } from "@/shared/runtime";
import { getAllCursorStates } from "@/shared/cursor-states";
import type { CursorSkin, CursorSkinState } from "@/shared/domain/cursor-dance";
import { MAX_RECENT_CURSOR_ASSETS } from "../lib/storage/chrome-api";
import type { CursorAssetDraft, RecentCursorAsset } from "../lib/storage/repository/types";
import {
  CursorCalibrationStage,
  CursorModeTabs,
  CursorPointFeedback,
  CursorProperties,
  CursorSlotList,
  CursorTrialStage,
  EmptyCursorStage,
  PendingAssetTray,
  StageBackgroundPicker,
  withCursorStateIcon,
  type CursorStateCard,
  type CalibrationStatus,
  type StageBackground,
  type StudioMode,
} from "./cursor-skin/CursorSkinStudio";
import {
  buildCursorAssetDraftFromFile,
  buildSkinStateFromAsset,
  getResolvedSkinState,
  planCursorBatchImport,
  type Hotspot,
} from "./cursor-skin/cursorSkinModel";

type StatusTone = "success" | "error" | "warning" | "info";

const UNTESTED_CALIBRATION: CalibrationStatus = { kind: "untested" };

export interface StatesPanelProps {
  stateId: string;
  setStateId: (next: string) => void;
  cursorSkin: CursorSkin | null;
  recentCursorAssets?: readonly RecentCursorAsset[];
  notify: (input: { title: string; description?: string; tone?: StatusTone }) => string;
  setCursorSkinEnabled: (enabled: boolean) => void;
  updateCursorSkinState: (stateId: string, skinState: CursorSkinState) => void;
  clearCursorSkinState: (stateId: string) => void;
  clearCursorSkinAssets: () => void;
  copyDefaultCursorSkinState: (stateId: string) => void;
  deriveCursorSkinStates: (stateIds: readonly string[]) => void;
  resetCursorSkin: () => void;
  atmosphere: Record<string, unknown>;
  updateAtmosphere: (patch: Record<string, unknown>) => void;
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
  clearCursorSkinAssets,
  copyDefaultCursorSkinState,
  deriveCursorSkinStates,
  resetCursorSkin,
  atmosphere,
  updateAtmosphere,
  rememberRecentCursorAsset,
}: StatesPanelProps) {
  const singleInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef("default");
  const [mode, setMode] = useState<StudioMode>("try");
  const [background, setBackground] = useState<StageBackground>("light");
  const [onlyEffective, setOnlyEffective] = useState(false);
  const [calibrationByState, setCalibrationByState] = useState<Record<string, CalibrationStatus>>({});
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
  const pendingAssets = recentCursorAssets.filter((asset) => asset.pending === true);
  const reusableAssets = recentCursorAssets.filter((asset) => asset.pending !== true);

  function showMessage(text: string, tone: StatusTone) {
    notify({ title: text, tone });
  }

  function applyCursorState(targetStateId: string, skinState: CursorSkinState) {
    updateCursorSkinState(targetStateId, skinState);
    setCalibrationByState((current) => ({ ...current, [targetStateId]: UNTESTED_CALIBRATION }));
  }

  function clearCursorState(targetStateId: string) {
    clearCursorSkinState(targetStateId);
    setCalibrationByState((current) => {
      const next = { ...current };
      delete next[targetStateId];
      return next;
    });
  }

  async function applyFile(file: File | undefined, targetStateId = stateId, announce = true): Promise<boolean> {
    if (!file) return false;
    try {
      const stateMeta = stateDescriptors.find((state) => state.id === targetStateId);
      const asset = await buildCursorAssetDraftFromFile(file, stateMeta);
      applyCursorState(targetStateId, buildSkinStateFromAsset(asset));
      await rememberRecentCursorAsset?.(asset);
      if (announce) {
        const label = stateMeta?.label || targetStateId;
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

  async function applyBatchFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const plan = planCursorBatchImport(files.map((file) => file.name), hasMaster);
    let applied = 0;
    let pending = 0;
    let rejected = 0;
    let overflow = 0;
    const pendingCapacity = Math.max(0, MAX_RECENT_CURSOR_ASSETS - pendingAssets.length);
    for (const item of plan) {
      const file = files[item.fileIndex];
      if (item.pending && pending >= pendingCapacity) {
        overflow += 1;
        continue;
      }
      try {
        for (const targetStateId of item.stateIds) {
          const stateMeta = stateDescriptors.find((state) => state.id === targetStateId);
          const asset = await buildCursorAssetDraftFromFile(file, stateMeta);
          applyCursorState(targetStateId, buildSkinStateFromAsset(asset));
          await rememberRecentCursorAsset?.(asset);
          applied += 1;
        }
        if (item.pending) {
          const asset = await buildCursorAssetDraftFromFile(file, null, true);
          await rememberRecentCursorAsset?.(asset);
          pending += 1;
        }
      } catch {
        rejected += 1;
      }
    }
    showMessage(
      `已自动配置 ${applied} 个槽位${pending ? `，${pending} 个素材进入待分配` : ""}${overflow ? `，${overflow} 个超过待分配上限` : ""}${rejected ? `，${rejected} 个文件无效` : ""}。`,
      rejected || overflow ? "warning" : pending ? "info" : "success",
    );
  }

  async function assignPending(assetId: string, targetStateId: string) {
    const asset = pendingAssets.find((item) => item.id === assetId);
    if (!asset) return;
    applyCursorState(targetStateId, buildSkinStateFromAsset(asset));
    await rememberRecentCursorAsset?.({ ...asset, pending: false });
    setStateId(targetStateId);
    showMessage(`已应用到「${stateDescriptors.find((state) => state.id === targetStateId)?.label || targetStateId}」。`, "success");
  }

  function updateHotspot(targetStateId: string, hotspot: Hotspot) {
    const ownState = cursorSkin?.states?.[targetStateId];
    if (!ownState) return;
    updateCursorSkinState(targetStateId, { ...ownState, hotspot });
    setCalibrationByState((current) => ({ ...current, [targetStateId]: UNTESTED_CALIBRATION }));
  }

  function updateCalibrationStatus(targetStateId: string, status: CalibrationStatus) {
    setCalibrationByState((current) => ({ ...current, [targetStateId]: status }));
  }

  function updateSize(targetStateId: string, boxSize: number) {
    const ownState = cursorSkin?.states?.[targetStateId];
    if (!ownState) return;
    updateCursorSkinState(targetStateId, { ...ownState, size: { mode: "fixedBox", boxSize } });
  }

  function deriveAllStates() {
    const inheriting = stateCards.filter((card) => card.id !== "default" && !card.ownState);
    deriveCursorSkinStates(inheriting.map((card) => card.id));
    showMessage(inheriting.length ? `已派生 ${inheriting.length} 个独立素材。` : "所有状态都已经是独立素材。", inheriting.length ? "success" : "info");
  }

  async function clearPending() {
    for (const asset of pendingAssets) {
      await rememberRecentCursorAsset?.({ ...asset, pending: false });
    }
    showMessage("待分配素材已移到最近素材。", "success");
  }

  async function applyRecentAsset(asset: RecentCursorAsset) {
    if (!asset.imageDataUrl || !currentCard) return;
    applyCursorState(currentCard.id, buildSkinStateFromAsset(asset));
    if (asset.pending) await rememberRecentCursorAsset?.({ ...asset, pending: false });
    showMessage(`已把最近素材应用到「${currentCard.label}」。`, "success");
  }

  function resetAll() {
    void clearPending();
    resetCursorSkin();
    setStateId("default");
    setMode("try");
    setCalibrationByState({});
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
                    onCalibrationStatusChange={(status) => updateCalibrationStatus("default", status)}
                  />
                  <PendingAssetTray assets={pendingAssets} recentAssets={reusableAssets} onClear={() => void clearPending()} onApplyRecent={(asset) => void applyRecentAsset(asset)} />
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
              onInherit={clearCursorState}
              onDeriveAll={deriveAllStates}
              onUploadDefault={() => openSinglePicker("default")}
              onAssignPending={(assetId, targetStateId) => void assignPending(assetId, targetStateId)}
            />
            {hasMaster ? (
              <CursorProperties
                card={currentCard}
                mode={mode}
                calibrationStatus={calibrationByState[currentCard.id] || UNTESTED_CALIBRATION}
                onModeChange={setMode}
                onChangeHotspot={(hotspot) => updateHotspot(currentCard.id, hotspot)}
                onChangeSize={(size) => updateSize(currentCard.id, size)}
                onClear={() => {
                  if (currentCard.id === "default") {
                    clearCursorSkinAssets();
                    setCalibrationByState({});
                  } else {
                    clearCursorState(currentCard.id);
                  }
                }}
                onReplace={() => openSinglePicker(currentCard.id)}
                onDerive={() => copyDefaultCursorSkinState(currentCard.id)}
              />
            ) : (
              <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center"><p className="text-xs font-medium text-slate-500">尺寸与指向点</p><p className="mx-auto mt-1.5 max-w-[220px] text-2xs leading-relaxed text-slate-500">上传主皮肤后在这里调整，并用准星测试验证。</p></section>
            )}
            <CursorPointFeedback atmosphere={atmosphere} activeOnThisPlatform={platform === "extension"} onChange={updateAtmosphere} />
          </aside>
        </div>
      </div>
    </div>
  );
}
