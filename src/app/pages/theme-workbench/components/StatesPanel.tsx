import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  MousePointer2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { CURSOR_STATES } from "../model/workbenchSchema";
import { validateCursorAssetFile } from "../lib/cursorAssetPresets";
import { resolveDesktopImageSource } from "@/shared/asset-reference";

const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;
const DEFAULT_BOX_SIZE = 48;
const PREVIEW_BOX_SIZE = 340;

const MATCH_RULES = [
  { stateId: "default", patterns: ["normal", "default", "arrow", "cursor", "base"] },
  { stateId: "pointer", patterns: ["pointer", "hand", "link", "hover", "click"] },
  { stateId: "text", patterns: ["text", "ibeam", "i-beam", "input"] },
  { stateId: "grab", patterns: ["grab", "openhand"] },
  { stateId: "grabbing", patterns: ["grabbing", "closedhand", "dragging", "drag"] },
  { stateId: "busy", patterns: ["wait", "busy", "loading", "progress"] },
  { stateId: "notAllowed", patterns: ["disabled", "disable", "notallowed", "not-allowed", "ban", "forbidden"] },
  { stateId: "crosshair", patterns: ["crosshair", "precision", "aim"] },
  { stateId: "move", patterns: ["move", "all-scroll", "sizeall"] },
  { stateId: "resizeHorizontal", patterns: ["resize-horizontal", "sizewe", "ew-resize", "horizontal"] },
  { stateId: "resizeVertical", patterns: ["resize-vertical", "sizens", "ns-resize", "vertical"] },
  { stateId: "resizeDiagonalNWSE", patterns: ["nwse", "resize-diagonal-1", "diagonal-nwse"] },
  { stateId: "resizeDiagonalNESW", patterns: ["nesw", "resize-diagonal-2", "diagonal-nesw"] },
];

const TRY_ZONES = [
  { id: "default", label: "桌面空白", hint: "普通指针", className: "bg-white text-slate-700" },
  { id: "text", label: "输入文字", hint: "文本选择", className: "bg-white text-slate-700" },
  { id: "pointer", label: "打开按钮", hint: "可点击", className: "bg-emerald-50 text-emerald-800" },
  { id: "notAllowed", label: "不可操作", hint: "禁用状态", className: "bg-slate-100 text-slate-400" },
  { id: "grabbing", label: "拖动画布", hint: "拖拽中", className: "bg-amber-50 text-amber-800" },
  { id: "resizeHorizontal", label: "拖动边缘", hint: "调整大小", className: "bg-sky-50 text-sky-800" },
];

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("文件读取失败")));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function getAssetDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || DEFAULT_BOX_SIZE, height: image.naturalHeight || DEFAULT_BOX_SIZE });
    image.onerror = () => resolve({ width: DEFAULT_BOX_SIZE, height: DEFAULT_BOX_SIZE });
    image.src = dataUrl;
  });
}

function inferMimeType(dataUrl, fileType = "") {
  if (fileType) return fileType;
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/png")) return "image/png";
  return "image/unknown";
}

function matchStateId(fileName) {
  const normalized = fileName.toLowerCase().replace(/\.[^.]+$/, "");
  const matched = MATCH_RULES.find((rule) => rule.patterns.some((pattern) => normalized.includes(pattern)));
  return matched?.stateId || "";
}

function getDisplaySize(skinState) {
  if (!skinState?.image) return DEFAULT_BOX_SIZE;
  if (skinState.size?.mode === "fixedBox") return skinState.size.boxSize || DEFAULT_BOX_SIZE;
  return Math.max(skinState.image.width || DEFAULT_BOX_SIZE, skinState.image.height || DEFAULT_BOX_SIZE);
}

function getResolvedSkinState(cursorSkin, stateId) {
  const ownState = cursorSkin?.states?.[stateId];
  if (ownState) return { state: ownState, inherited: false };
  return { state: cursorSkin?.states?.default || null, inherited: stateId !== "default" };
}

function buildSkinStateFromAsset(asset) {
  return {
    image: {
      kind: "dataUrl",
      mimeType: asset.mimeType || inferMimeType(asset.imageDataUrl),
      dataUrl: asset.imageDataUrl,
      width: asset.sourceWidth || asset.size || DEFAULT_BOX_SIZE,
      height: asset.sourceHeight || asset.size || DEFAULT_BOX_SIZE,
    },
    hotspot: { x: asset.hotspotX ?? 0, y: asset.hotspotY ?? 0 },
    size: { mode: "fixedBox", boxSize: asset.size || DEFAULT_BOX_SIZE },
  };
}

function getDefaultHotspot(stateMeta, width, height) {
  if (stateMeta?.defaultHotspot === "center") return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  return { x: Math.min(10, Math.max(0, width - 1)), y: Math.min(8, Math.max(0, height - 1)) };
}

function CursorImage({ skinState, inherited = false, className = "" }) {
  const size = skinState ? Math.min(getDisplaySize(skinState), 44) : 34;
  const imageSource = resolveDesktopImageSource(skinState?.image);
  return (
    <div className={cn(
      "grid shrink-0 place-items-center rounded-[22px] border bg-white/85 shadow-sm backdrop-blur",
      inherited ? "border-dashed border-slate-300" : "border-white/70",
      className,
    )}>
      {imageSource ? (
        <img src={imageSource} alt="" className="object-contain drop-shadow-sm" style={{ width: size, height: size }} />
      ) : (
        <MousePointer2 className="h-5 w-5 text-slate-300" />
      )}
    </div>
  );
}

function StateRail({ stateCards, stateId, setStateId }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {stateCards.map((state) => {
        const Icon = state.icon;
        const active = state.id === stateId;
        return (
          <button
            key={state.id}
            type="button"
            onClick={() => setStateId(state.id)}
            className={cn(
              "group flex min-w-[170px] items-center gap-3 rounded-[26px] border p-3 text-left transition-all",
              active
                ? "border-slate-950 bg-slate-950 text-white shadow-xl shadow-slate-950/15"
                : "border-white/70 bg-white/78 text-slate-700 shadow-sm backdrop-blur hover:-translate-y-0.5 hover:bg-white hover:shadow-md",
            )}
          >
            <CursorImage skinState={state.resolvedState} inherited={state.inherited} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : "text-slate-400")} />
                <span className="truncate text-sm font-semibold">{state.label}</span>
              </div>
              <div className={cn("mt-1 truncate text-xs", active ? "text-white/65" : "text-slate-400")}>{state.ownState ? "独立皮肤" : state.id === "default" ? "待上传" : "继承普通"}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DropUpload({ skinState, stateMeta, onPick, onDropFiles, fileInputRef }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void onDropFiles(event.dataTransfer.files);
      }}
      className={cn(
        "relative overflow-hidden rounded-[36px] border border-white/70 bg-white/80 p-7 shadow-sm backdrop-blur transition-all",
        dragging && "border-emerald-300 bg-emerald-50 shadow-emerald-100",
      )}
    >
      <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <CursorImage skinState={skinState} className="h-24 w-24 rounded-[32px]" />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">当前状态</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{stateMeta.label}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{stateMeta.detail}。把图片拖到这里，或点击上传替换当前状态皮肤。</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept="image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => { void onPick(event.target.files?.[0]); event.target.value = ""; }} />
          <Button className="h-11 rounded-2xl px-5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />上传皮肤
          </Button>
        </div>
      </div>
    </div>
  );
}

function HotspotStudio({ skinState, stateMeta, onChangeHotspot, onChangeSize }) {
  const stageRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const image = skinState?.image;
  const imageSource = resolveDesktopImageSource(image);
  const displaySize = getDisplaySize(skinState);
  const naturalWidth = image?.width || DEFAULT_BOX_SIZE;
  const naturalHeight = image?.height || DEFAULT_BOX_SIZE;
  const hotspot = skinState?.hotspot || { x: 0, y: 0 };
  const scale = Math.min(1, PREVIEW_BOX_SIZE * 0.68 / Math.max(displaySize, 1));
  const previewSize = displaySize * scale;
  const left = (PREVIEW_BOX_SIZE - previewSize) / 2;
  const top = (PREVIEW_BOX_SIZE - previewSize) / 2;
  const hotspotLeft = left + (hotspot.x / Math.max(naturalWidth, 1)) * previewSize;
  const hotspotTop = top + (hotspot.y / Math.max(naturalHeight, 1)) * previewSize;

  function updateHotspotFromEvent(event) {
    if (!stageRef.current || !skinState) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left - left) / Math.max(previewSize, 1)) * naturalWidth, 0, naturalWidth - 1);
    const y = clamp(((event.clientY - rect.top - top) / Math.max(previewSize, 1)) * naturalHeight, 0, naturalHeight - 1);
    onChangeHotspot({ x: Math.round(x), y: Math.round(y) });
  }

  function nudgeHotspot(event) {
    if (!skinState) return;
    const step = event.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    onChangeHotspot({ x: clamp(hotspot.x + delta[0], 0, naturalWidth - 1), y: clamp(hotspot.y + delta[1], 0, naturalHeight - 1) });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={nudgeHotspot}
        onPointerDown={(event) => {
          if (!skinState) return;
          setDragging(true);
          updateHotspotFromEvent(event);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => dragging && updateHotspotFromEvent(event)}
        onPointerUp={(event) => {
          setDragging(false);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        className="relative h-[340px] overflow-hidden rounded-[36px] border border-white/70 bg-white shadow-sm outline-none ring-0 focus:ring-4 focus:ring-emerald-100"
      >
        <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)", backgroundSize: "18px 18px" }} />
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300/70" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-slate-300/70" />
        {imageSource ? (
          <img src={imageSource} alt="" draggable={false} className="absolute select-none object-contain drop-shadow-md" style={{ width: previewSize, height: previewSize, left, top }} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center text-sm text-slate-400">
            <div>
              <ImagePlus className="mx-auto mb-3 h-9 w-9" />
              上传图片后在这里拖动红点设置指向点
            </div>
          </div>
        )}
        {imageSource ? <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow-lg ring-4 ring-rose-500/20" style={{ left: hotspotLeft, top: hotspotTop }} /> : null}
      </div>

      <div className="rounded-[32px] border border-white/70 bg-white/78 p-5 shadow-sm backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">指向点与尺寸</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">红点就是系统判定点击的像素。文本、拖拽、resize 通常更适合中心点。</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <NumberInput label="X" value={Math.round(hotspot.x)} max={Math.max(0, naturalWidth - 1)} onChange={(x) => onChangeHotspot({ x, y: hotspot.y })} disabled={!skinState} />
          <NumberInput label="Y" value={Math.round(hotspot.y)} max={Math.max(0, naturalHeight - 1)} onChange={(y) => onChangeHotspot({ x: hotspot.x, y })} disabled={!skinState} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ChipButton disabled={!skinState} onClick={() => onChangeHotspot({ x: 0, y: 0 })}>左上角</ChipButton>
          <ChipButton disabled={!skinState} onClick={() => onChangeHotspot({ x: Math.floor(naturalWidth / 2), y: Math.floor(naturalHeight / 2) })}>中心点</ChipButton>
          <ChipButton disabled={!skinState} onClick={() => onChangeHotspot({ x: Math.floor(naturalWidth / 2), y: Math.max(0, naturalHeight - 1) })}>底部中心</ChipButton>
          <ChipButton disabled={!skinState} onClick={() => onChangeHotspot(getDefaultHotspot(stateMeta, naturalWidth, naturalHeight))}>推荐点</ChipButton>
        </div>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="mb-3 text-sm font-semibold text-slate-800">显示尺寸</div>
          <div className="grid grid-cols-3 gap-2">
            {[32, 48, 64].map((size) => <ChipButton key={size} active={displaySize === size} disabled={!skinState} onClick={() => onChangeSize(size)}>{size}</ChipButton>)}
          </div>
          <div className="mt-3 text-xs text-slate-400">原图 {naturalWidth} × {naturalHeight}</div>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, max, onChange, disabled }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-500">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(clamp(Number(event.target.value), 0, max))}
        className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-center text-sm tabular-nums text-slate-800 outline-none focus:border-emerald-300 disabled:bg-slate-100 disabled:text-slate-300"
      />
    </label>
  );
}

function ChipButton({ children, disabled, active = false, onClick }: { children: React.ReactNode; disabled?: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
        active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function TryZone({ cursorSkin, onSelect }) {
  const [activeStateId, setActiveStateId] = useState("default");
  const resolved = getResolvedSkinState(cursorSkin, activeStateId);
  const meta = CURSOR_STATES.find((state) => state.id === activeStateId) || CURSOR_STATES[0];
  return (
    <div className="rounded-[36px] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">试用区</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{meta.label}</div>
        </div>
        <CursorImage skinState={resolved.state} inherited={resolved.inherited} className="h-16 w-16" />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {TRY_ZONES.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onMouseEnter={() => setActiveStateId(zone.id)}
            onFocus={() => setActiveStateId(zone.id)}
            onClick={() => onSelect(zone.id)}
            className={cn(
              "rounded-[24px] border px-4 py-3 text-left transition-all",
              activeStateId === zone.id ? "border-slate-950 shadow-md" : "border-slate-200 hover:border-slate-300",
              zone.className,
            )}
          >
            <div className="text-sm font-semibold">{zone.label}</div>
            <div className="mt-1 text-xs opacity-60">{zone.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecentAssets({ assets, onApply }) {
  if (!assets?.length) return null;
  return (
    <div className="rounded-[32px] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-slate-950">最近素材</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {assets.slice(0, 10).map((asset, index) => (
          <button
            key={`${asset.imageDataUrl?.slice(0, 32)}-${index}`}
            type="button"
            onClick={() => onApply(asset)}
            className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            title={asset.name || "最近素材"}
          >
            <img src={asset.imageDataUrl} alt="" className="h-9 w-9 object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

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
