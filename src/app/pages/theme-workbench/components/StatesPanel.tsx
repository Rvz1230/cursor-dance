import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Crosshair,
  ImagePlus,
  MousePointer2,
  RotateCcw,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { CURSOR_STATES, formatActionLabel } from "../model/workbenchSchema";
import { DataPill, Panel } from "./WorkbenchControls";
import { validateCursorAssetFile } from "../lib/cursorAssetPresets";

const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;
const TARGET_CURSOR_SIZE = 48;

const MATCH_RULES = [
  { stateId: "default", patterns: ["normal", "default", "arrow", "cursor", "base"] },
  { stateId: "pointer", patterns: ["pointer", "hand", "link", "hover"] },
  { stateId: "text", patterns: ["text", "ibeam", "i-beam", "input"] },
  { stateId: "help", patterns: ["help", "question", "ask"] },
  { stateId: "wait", patterns: ["wait", "busy", "loading", "progress"] },
  { stateId: "notAllowed", patterns: ["disabled", "disable", "notallowed", "not-allowed", "ban", "forbidden"] },
];

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function getAssetDimensions(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || TARGET_CURSOR_SIZE, height: image.naturalHeight || TARGET_CURSOR_SIZE });
    image.onerror = () => resolve({ width: TARGET_CURSOR_SIZE, height: TARGET_CURSOR_SIZE });
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("文件读取失败")));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function matchStateId(fileName) {
  const normalized = fileName.toLowerCase().replace(/\.[^.]+$/, "");
  const matched = MATCH_RULES.find((rule) => rule.patterns.some((pattern) => normalized.includes(pattern)));
  return matched?.stateId || "";
}

function getStateStatus({ stateId, mode, asset, effectiveAsset }) {
  if (stateId !== "default" && mode === "继承") return { label: "继承", tone: "slate" };
  if (!effectiveAsset?.imageDataUrl) return { label: "缺失", tone: "rose" };
  if ((asset?.sourceWidth && asset.sourceWidth !== TARGET_CURSOR_SIZE) || (asset?.sourceHeight && asset.sourceHeight !== TARGET_CURSOR_SIZE)) {
    return { label: "非标尺寸", tone: "slate" };
  }
  return { label: "正常", tone: "teal" };
}

function CursorPreview({ asset, size = 40, emptyClassName = "" }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50" style={{ width: size + 16, height: size + 16 }}>
      {asset?.imageDataUrl ? (
        <img
          src={asset.imageDataUrl}
          alt=""
          className="object-contain"
          style={{ width: Math.min(asset.size || TARGET_CURSOR_SIZE, size), height: Math.min(asset.size || TARGET_CURSOR_SIZE, size) }}
        />
      ) : (
        <ImagePlus className={cn("h-5 w-5 text-slate-300", emptyClassName)} />
      )}
    </div>
  );
}

function NumberStepper({ label, value, max, onChange }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button type="button" className="text-slate-500 hover:bg-slate-50" onClick={() => onChange(clamp(value - 1, 0, max))} aria-label={`${label} 减 1`}>
          -
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value), 0, max))}
          className="min-w-0 border-x border-slate-200 px-2 py-2 text-center text-sm tabular-nums text-slate-700 outline-none"
          aria-label={label}
        />
        <button type="button" className="text-slate-500 hover:bg-slate-50" onClick={() => onChange(clamp(value + 1, 0, max))} aria-label={`${label} 加 1`}>
          +
        </button>
      </div>
    </label>
  );
}

export function StatesPanel({
  stateId,
  setStateId,
  cursorModes,
  cursorStateActions,
  cursorStateAssets,
  recentCursorAssets,
  actionItems,
  updateCursorMode,
  updateCursorStateAction,
  updateCursorStateAsset,
  updateCursorStateAssetForState,
  rememberRecentCursorAsset,
  copyDefaultCursorStateAsset,
  resetCurrentCursorState,
  resetAllCursorStates,
}) {
  const fileInputRef = useRef(null);
  const singleFileInputRef = useRef(null);
  const hotspotStageRef = useRef(null);
  const [assetMessage, setAssetMessage] = useState("");
  const [assetMessageTone, setAssetMessageTone] = useState("slate");
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const currentMode = cursorModes[stateId];
  const currentActionId = cursorStateActions?.[stateId] || "leftClick";
  const currentAsset = cursorStateAssets?.[stateId] || { imageDataUrl: "", hotspotX: 16, hotspotY: 32, size: TARGET_CURSOR_SIZE };
  const effectiveAsset = stateId !== "default" && currentMode === "继承"
    ? (cursorStateAssets?.default || currentAsset)
    : currentAsset;
  const stateMeta = CURSOR_STATES.find((item) => item.id === stateId);
  const defaultAsset = cursorStateAssets?.default || {};
  const maxHotspotX = Math.max(0, (currentAsset.size || TARGET_CURSOR_SIZE) - 1);
  const maxHotspotY = Math.max(0, (currentAsset.size || TARGET_CURSOR_SIZE) - 1);
  const stateCards = useMemo(() => {
    return CURSOR_STATES.map((state) => {
      const mode = cursorModes[state.id];
      const asset = cursorStateAssets?.[state.id] || {};
      const inheritedAsset = state.id !== "default" && mode === "继承" ? defaultAsset : asset;
      const status = getStateStatus({ stateId: state.id, mode, asset, effectiveAsset: inheritedAsset });
      return { ...state, mode, asset, effectiveAsset: inheritedAsset, status };
    });
  }, [cursorModes, cursorStateAssets, defaultAsset]);
  const matchedCount = stateCards.filter((state) => state.status.label === "正常").length;
  const missingCount = stateCards.filter((state) => state.status.label === "缺失").length;

  useEffect(() => {
    setAssetMessage("");
    setAssetMessageTone("slate");
    setIsDraggingAsset(false);
  }, [stateId]);

  async function buildAssetFromFile(file) {
    const validationMessage = validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES);
    if (validationMessage) throw new Error(validationMessage);
    const imageDataUrl = await readFileAsDataUrl(file);
    const dimensions = await getAssetDimensions(imageDataUrl);
    return {
      imageDataUrl,
      hotspotX: Math.min(6, Math.max(0, dimensions.width - 1)),
      hotspotY: Math.min(4, Math.max(0, dimensions.height - 1)),
      size: TARGET_CURSOR_SIZE,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
      name: file.name,
      mimeType: file.type,
    };
  }

  async function applySingleFile(file, targetStateId = stateId) {
    if (!file) return;
    try {
      const asset = await buildAssetFromFile(file);
      const patch = {
        imageDataUrl: asset.imageDataUrl,
        hotspotX: asset.hotspotX,
        hotspotY: asset.hotspotY,
        size: asset.size,
        sourceWidth: asset.sourceWidth,
        sourceHeight: asset.sourceHeight,
        name: asset.name,
      };
      if (targetStateId === stateId) updateCursorStateAsset(patch);
      else updateCursorStateAssetForState(targetStateId, patch);
      void rememberRecentCursorAsset(asset);
      setAssetMessage(`已绑定 ${file.name}。`);
      setAssetMessageTone("teal");
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "素材读取失败。");
      setAssetMessageTone("rose");
    }
  }

  async function applyBatchFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const occupiedTargets = new Set();
    const unresolved = [];
    let applied = 0;

    for (const file of files) {
      try {
        const asset = await buildAssetFromFile(file);
        const matchedStateId = matchStateId(file.name);
        const hasConflict = !matchedStateId || occupiedTargets.has(matchedStateId);
        if (hasConflict) {
          unresolved.push({ id: `${file.name}-${file.lastModified}`, fileName: file.name, asset, reason: matchedStateId ? "命名冲突" : "未识别状态" });
          continue;
        }

        occupiedTargets.add(matchedStateId);
        updateCursorStateAssetForState(matchedStateId, {
          imageDataUrl: asset.imageDataUrl,
          hotspotX: asset.hotspotX,
          hotspotY: asset.hotspotY,
          size: asset.size,
          sourceWidth: asset.sourceWidth,
          sourceHeight: asset.sourceHeight,
          name: asset.name,
        });
        void rememberRecentCursorAsset(asset);
        applied += 1;
      } catch (error) {
        unresolved.push({
          id: `${file.name}-${file.lastModified}`,
          fileName: file.name,
          asset: null,
          reason: error instanceof Error ? error.message : "读取失败",
        });
      }
    }

    setPendingFiles((current) => [...unresolved, ...current].slice(0, 8));
    setAssetMessage(`批量上传完成：已自动匹配 ${applied} 个，需确认 ${unresolved.length} 个。`);
    setAssetMessageTone(unresolved.length ? "amber" : "teal");
  }

  function updateHotspot(nextPatch) {
    updateCursorStateAsset({
      hotspotX: clamp(nextPatch.hotspotX ?? currentAsset.hotspotX, 0, maxHotspotX),
      hotspotY: clamp(nextPatch.hotspotY ?? currentAsset.hotspotY, 0, maxHotspotY),
    });
  }

  function handleHotspotPointer(event) {
    if (!hotspotStageRef.current) return;
    const rect = hotspotStageRef.current.getBoundingClientRect();
    const x = clamp(Math.round(((event.clientX - rect.left) / rect.width) * (currentAsset.size || TARGET_CURSOR_SIZE)), 0, maxHotspotX);
    const y = clamp(Math.round(((event.clientY - rect.top) / rect.height) * (currentAsset.size || TARGET_CURSOR_SIZE)), 0, maxHotspotY);
    updateHotspot({ hotspotX: x, hotspotY: y });
  }

  function bindPendingFile(pendingFile, targetStateId) {
    if (!pendingFile.asset) return;
    updateCursorStateAssetForState(targetStateId, {
      imageDataUrl: pendingFile.asset.imageDataUrl,
      hotspotX: pendingFile.asset.hotspotX,
      hotspotY: pendingFile.asset.hotspotY,
      size: pendingFile.asset.size,
      sourceWidth: pendingFile.asset.sourceWidth,
      sourceHeight: pendingFile.asset.sourceHeight,
      name: pendingFile.asset.name,
    });
    setPendingFiles((current) => current.filter((item) => item.id !== pendingFile.id));
    setStateId(targetStateId);
  }

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px] xl:overflow-hidden">
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <Panel
          title="状态素材总览"
          summary="批量上传后自动匹配状态，只处理缺失、冲突和尺寸异常"
        action={<Button variant="ghost" className="rounded-xl px-2.5 text-xs" onClick={resetAllCursorStates}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />恢复全部状态</Button>}
        >
          <input ref={fileInputRef} type="file" accept="image/png,image/webp,image/svg+xml" multiple className="hidden" onChange={(event) => {
            void applyBatchFiles(event.target.files);
            event.target.value = "";
          }} />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingAsset(true);
            }}
            onDragLeave={() => setIsDraggingAsset(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingAsset(false);
              void applyBatchFiles(event.dataTransfer.files);
            }}
            className={cn(
              "grid w-full gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
              isDraggingAsset ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/60"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-600">拖入或批量上传光标素材</div>
                <div className="mt-1 text-xs text-slate-500">按文件名自动匹配 default / pointer / text / help / wait / disabled。</div>
              </div>
            </div>
            <span className="inline-flex justify-center rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">批量上传</span>
          </button>

          <div className="mt-3 flex flex-wrap gap-2">
            <DataPill tone="teal">已匹配 {matchedCount}</DataPill>
            <DataPill tone="slate">非标尺寸 {stateCards.filter((state) => state.status.label === "非标尺寸").length}</DataPill>
            <DataPill tone={pendingFiles.length ? "amber" : "slate"}>需确认 {pendingFiles.length}</DataPill>
            <DataPill tone={missingCount ? "rose" : "slate"}>缺失 {missingCount}</DataPill>
            {assetMessage ? <span className={cn("rounded-full px-2.5 py-1 text-xs", assetMessageTone === "rose" ? "bg-rose-50 text-rose-700" : assetMessageTone === "amber" ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700")}>{assetMessage}</span> : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {stateCards.map((state) => {
              const active = state.id === stateId;
              const Icon = state.icon;
              return (
                <button
                  key={state.id}
                  type="button"
                  onClick={() => setStateId(state.id)}
                  className={cn(
                    "min-w-0 rounded-2xl border bg-white p-3 text-left transition-colors",
                    active ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <CursorPreview asset={state.effectiveAsset} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          <div className="truncate text-xs font-medium text-slate-600">{state.label}</div>
                        </div>
                        <DataPill tone={state.status.tone}>{state.status.label}</DataPill>
                      </div>
                      <div className="mt-2 truncate text-xs text-slate-500">
                        {state.status.label === "继承" ? "继承默认状态" : state.asset?.name || (state.effectiveAsset?.imageDataUrl ? "已绑定素材" : "未绑定素材")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">热点 {state.effectiveAsset?.hotspotX ?? 0},{state.effectiveAsset?.hotspotY ?? 0}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{state.asset?.sourceWidth || TARGET_CURSOR_SIZE} x {state.asset?.sourceHeight || TARGET_CURSOR_SIZE}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {pendingFiles.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="mb-2 text-xs font-medium text-amber-900">需要确认</div>
              <div className="grid gap-2">
                {pendingFiles.map((pendingFile) => (
                  <div key={pendingFile.id} className="grid gap-2 rounded-xl bg-white px-3 py-2 md:grid-cols-[minmax(0,1fr)_170px_auto] md:items-center">
                    <div className="flex min-w-0 items-center gap-2">
                      <CursorPreview asset={pendingFile.asset} size={28} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-700">{pendingFile.fileName}</div>
                        <div className="text-xs text-slate-500">{pendingFile.reason}</div>
                      </div>
                    </div>
                    <select
                      className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      defaultValue=""
                      onChange={(event) => event.target.value && bindPendingFile(pendingFile, event.target.value)}
                    >
                      <option value="">选择绑定状态</option>
                      {CURSOR_STATES.map((state) => <option key={state.id} value={state.id}>{state.label}</option>)}
                    </select>
                    <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-900" onClick={() => setPendingFiles((current) => current.filter((item) => item.id !== pendingFile.id))}>
                      忽略
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel
        title={`${stateMeta?.label || "当前"} 状态详情`}
        summary={`${formatActionLabel(currentActionId)} · ${currentMode}`}
        className="flex min-h-0 flex-col"
        contentClassName="min-h-0 flex-1 overflow-y-auto"
        action={<Button variant="ghost" className="rounded-xl px-2.5 text-xs" onClick={resetCurrentCursorState}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />恢复此状态</Button>}
      >
        <input ref={singleFileInputRef} type="file" accept="image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => {
          void applySingleFile(event.target.files?.[0]);
          event.target.value = "";
        }} />

        <div className="space-y-3">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-medium text-slate-600">当前素材</div>
            <div className="flex items-center gap-2.5">
              <CursorPreview asset={effectiveAsset} size={42} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-700">{currentAsset.name || (effectiveAsset.imageDataUrl ? "已绑定素材" : "未绑定素材")}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {(currentAsset.sourceWidth || TARGET_CURSOR_SIZE)} x {(currentAsset.sourceHeight || TARGET_CURSOR_SIZE)} · PNG / WebP / SVG
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button variant="outline" className="rounded-xl px-3 text-xs" onClick={() => singleFileInputRef.current?.click()}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />替换
              </Button>
              {stateId !== "default" ? (
                <Button variant="ghost" className="rounded-xl px-3 text-xs" onClick={copyDefaultCursorStateAsset}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />复制默认态
                </Button>
              ) : null}
              <Button variant="ghost" className="rounded-xl px-3 text-xs text-rose-600 hover:text-rose-700" onClick={() => updateCursorStateAsset({ imageDataUrl: "", name: "", sourceWidth: undefined, sourceHeight: undefined })}>
                移除
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-medium text-slate-600">来源策略</div>
            <div className={cn("grid gap-1 rounded-xl bg-slate-100 p-1", stateId === "default" ? "grid-cols-1" : "grid-cols-2")}>
              {(stateId === "default" ? ["源"] : ["继承", "覆盖"]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateCursorMode(mode)}
                  className={cn("rounded-lg px-1.5 py-1.5 text-xs font-semibold transition-colors", currentMode === mode ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white")}
                >
                  {mode === "源" ? "当前素材" : mode === "继承" ? "继承默认" : "单独覆盖"}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {stateId === "default" ? "默认状态始终使用自己的绑定素材。" : currentMode === "继承" ? "此状态沿用默认状态素材与热点。" : "此状态使用自己的绑定素材。"}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-600">热点编辑器</div>
              <DataPill tone="slate">{currentAsset.hotspotX}, {currentAsset.hotspotY}</DataPill>
            </div>
            <div
              ref={hotspotStageRef}
              role="slider"
              tabIndex={0}
              aria-label="热点坐标"
              aria-valuetext={`${currentAsset.hotspotX},${currentAsset.hotspotY}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                handleHotspotPointer(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) handleHotspotPointer(event);
              }}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                event.preventDefault();
                if (event.key === "ArrowLeft") updateHotspot({ hotspotX: currentAsset.hotspotX - 1 });
                if (event.key === "ArrowRight") updateHotspot({ hotspotX: currentAsset.hotspotX + 1 });
                if (event.key === "ArrowUp") updateHotspot({ hotspotY: currentAsset.hotspotY - 1 });
                if (event.key === "ArrowDown") updateHotspot({ hotspotY: currentAsset.hotspotY + 1 });
              }}
              className="relative mx-auto flex aspect-square w-full max-w-[260px] cursor-crosshair items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              style={{
                backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            >
              {effectiveAsset.imageDataUrl ? (
                <img src={effectiveAsset.imageDataUrl} alt="" className="h-4/5 w-4/5 object-contain opacity-95" />
              ) : (
                <MousePointer2 className="h-12 w-12 text-slate-200" />
              )}
              <div
                className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-emerald-700 bg-white/80 shadow-sm"
                style={{
                  left: `${((currentAsset.hotspotX || 0) / Math.max(1, currentAsset.size || TARGET_CURSOR_SIZE)) * 100}%`,
                  top: `${((currentAsset.hotspotY || 0) / Math.max(1, currentAsset.size || TARGET_CURSOR_SIZE)) * 100}%`,
                }}
              >
                <Crosshair className="h-4 w-4 text-emerald-700" />
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <NumberStepper label="X" value={currentAsset.hotspotX || 0} max={maxHotspotX} onChange={(value) => updateHotspot({ hotspotX: value })} />
              <NumberStepper label="Y" value={currentAsset.hotspotY || 0} max={maxHotspotY} onChange={(value) => updateHotspot({ hotspotY: value })} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button type="button" className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200" onClick={() => updateHotspot({ hotspotX: 0, hotspotY: 0 })}>左上</button>
              <button type="button" className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200" onClick={() => updateHotspot({ hotspotX: Math.floor(maxHotspotX / 2), hotspotY: Math.floor(maxHotspotY / 2) })}>中心</button>
              <button type="button" className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200" onClick={() => updateHotspot({ hotspotX: defaultAsset.hotspotX ?? 16, hotspotY: defaultAsset.hotspotY ?? 32 })}>沿用默认</button>
            </div>
          </section>

          <section className="flex items-center gap-2 text-xs text-slate-500">
            {(currentAsset.sourceWidth || TARGET_CURSOR_SIZE) === TARGET_CURSOR_SIZE && (currentAsset.sourceHeight || TARGET_CURSOR_SIZE) === TARGET_CURSOR_SIZE ? (
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            ) : (
              <XCircle className="h-4 w-4 text-slate-400" />
            )}
            <span>{(currentAsset.sourceWidth || TARGET_CURSOR_SIZE) === TARGET_CURSOR_SIZE && (currentAsset.sourceHeight || TARGET_CURSOR_SIZE) === TARGET_CURSOR_SIZE ? "尺寸符合 48 × 48" : `尺寸 ${currentAsset.sourceWidth || TARGET_CURSOR_SIZE} × ${currentAsset.sourceHeight || TARGET_CURSOR_SIZE}，渲染时自动适配 48 × 48`}</span>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-slate-600">动作模板</div>
            <select
              value={currentActionId}
              onChange={(event) => updateCursorStateAction(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {actionItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <div className="mt-1.5 text-xs text-slate-400">仅对左键单击生效；其他触发方式（右键/双击/长按/滚轮/悬停）不受此绑定影响。</div>
          </section>

          {recentCursorAssets?.length ? (
            <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                <Wand2 className="h-4 w-4 text-emerald-700" />最近素材
              </div>
              <div className="grid grid-cols-3 gap-2">
                {recentCursorAssets.slice(0, 6).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      updateCursorStateAsset({
                        imageDataUrl: asset.imageDataUrl,
                        hotspotX: asset.hotspotX,
                        hotspotY: asset.hotspotY,
                        size: asset.size,
                        name: asset.name,
                      });
                      setAssetMessage(`已应用最近素材：${asset.name}。`);
                      setAssetMessageTone("teal");
                    }}
                    className="rounded-xl border border-slate-200 bg-white p-2 hover:border-emerald-300"
                    title={asset.name}
                  >
                    <CursorPreview asset={asset} size={28} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
