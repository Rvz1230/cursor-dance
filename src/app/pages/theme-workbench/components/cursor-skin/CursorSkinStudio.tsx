import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Ban,
  Clock3,
  Hand,
  HelpCircle,
  ImagePlus,
  MousePointer2,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Slider } from "@/components/ui/slider";
import { resolveDesktopImageSource } from "@/shared/asset-reference";
import type { CursorStateDescriptor, CursorStateId } from "@/shared/cursor-states";
import {
  hotspotFromImagePixels,
  hotspotToImagePixels,
  normalizeHotspot,
} from "@/shared/effect-core/cursor-hotspot";
import type { CursorSkinState } from "@/shared/domain/cursor-dance";
import type { RecentCursorAsset } from "../../lib/storage/repository/types";
import {
  DEFAULT_BOX_SIZE,
  clamp,
  getDisplaySize,
  type Hotspot,
} from "./cursorSkinModel";

export type StudioMode = "try" | "calibrate";
export type StageBackground = "light" | "dark" | "color" | "checker";

export interface CursorStateCard extends CursorStateDescriptor {
  icon: LucideIcon;
  ownState: CursorSkinState | null;
  resolvedState: CursorSkinState | null;
  inherited: boolean;
  reachable: boolean;
}

export interface PendingCursorAsset {
  id: string;
  file: File;
  previewUrl: string;
}

const CURSOR_STATE_ICONS: Record<CursorStateId, LucideIcon> = {
  default: MousePointer2,
  text: TextCursorInput,
  pointer: Hand,
  notAllowed: Ban,
  busy: Clock3,
  help: HelpCircle,
  grabbing: Hand,
};

export function withCursorStateIcon(descriptor: CursorStateDescriptor): CursorStateDescriptor & { icon: LucideIcon } {
  return { ...descriptor, icon: CURSOR_STATE_ICONS[descriptor.id] };
}

function getRenderedImageSize(skinState: CursorSkinState | null | undefined) {
  const boxSize = getDisplaySize(skinState);
  const width = skinState?.image?.width || DEFAULT_BOX_SIZE;
  const height = skinState?.image?.height || DEFAULT_BOX_SIZE;
  const scale = boxSize / Math.max(width, height, 1);
  return { width: width * scale, height: height * scale };
}

function CursorImage({
  skinState,
  inherited = false,
  className = "",
}: {
  skinState: CursorSkinState | null;
  inherited?: boolean;
  className?: string;
}) {
  const imageSource = resolveDesktopImageSource(skinState?.image);
  const rendered = getRenderedImageSize(skinState);
  const scale = Math.min(1, 38 / Math.max(rendered.width, rendered.height, 1));
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border bg-white",
        inherited ? "border-dashed border-slate-200" : "border-slate-200",
        className,
      )}
    >
      {imageSource ? (
        <img
          src={imageSource}
          alt=""
          draggable={false}
          className="select-none object-contain"
          style={{ width: rendered.width * scale, height: rendered.height * scale }}
        />
      ) : (
        <MousePointer2 className="size-5 text-slate-300" aria-hidden />
      )}
    </span>
  );
}

function SegmentedButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center rounded-lg px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

export function CursorModeTabs({ mode, onChange }: { mode: StudioMode; onChange: (mode: StudioMode) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="radiogroup" aria-label="演示台">
      <SegmentedButton active={mode === "try"} onClick={() => onChange("try")}>试用</SegmentedButton>
      <SegmentedButton active={mode === "calibrate"} onClick={() => onChange("calibrate")}>校准</SegmentedButton>
    </div>
  );
}

const STAGE_BACKGROUND_CLASSES: Record<StageBackground, string> = {
  light: "bg-white",
  dark: "bg-slate-900",
  color: "bg-sky-600",
  checker: "cursor-skin-checker",
};

export function StageBackgroundPicker({
  value,
  onChange,
}: {
  value: StageBackground;
  onChange: (value: StageBackground) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500">底色</span>
      <div className="flex items-center gap-1.5">
        {(Object.keys(STAGE_BACKGROUND_CLASSES) as StageBackground[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-label={{ light: "浅色底", dark: "深色底", color: "彩色底", checker: "棋盘底" }[item]}
            aria-pressed={value === item}
            onClick={() => onChange(item)}
            className={cn(
              "size-6 rounded-lg border transition-shadow",
              STAGE_BACKGROUND_CLASSES[item],
              value === item ? "border-slate-950 ring-2 ring-slate-300" : "border-slate-200",
            )}
          />
        ))}
      </div>
    </div>
  );
}

type AimResult = { distance: number; dx: number; dy: number } | null;

export function CursorTrialStage({
  defaultState,
  grabbingState,
  enabled,
  background,
  onFixHotspot,
}: {
  defaultState: CursorSkinState | null;
  grabbingState: CursorSkinState | null;
  enabled: boolean;
  background: StageBackground;
  onFixHotspot: (hotspot: Hotspot) => void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [inside, setInside] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [aimResult, setAimResult] = useState<AimResult>(null);
  const skinState = grabbing ? (grabbingState || defaultState) : defaultState;
  const source = resolveDesktopImageSource(skinState?.image);
  const rendered = getRenderedImageSize(skinState);
  const hotspot = normalizeHotspot(skinState?.hotspot);

  function updatePosition(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    setGrabbing(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <>
      <div
        className={cn(
          "cursor-skin-stage relative overflow-hidden rounded-xl border border-slate-200",
          STAGE_BACKGROUND_CLASSES[background],
        )}
        onPointerEnter={(event) => { setInside(true); updatePosition(event); }}
        onPointerLeave={() => { setInside(false); setGrabbing(false); }}
        onPointerMove={updatePosition}
        style={{ cursor: inside && source && enabled ? "none" : undefined }}
      >
        <div className={cn(
          "pointer-events-none absolute inset-x-0 top-7 text-center text-xs font-medium transition-opacity duration-150",
          background === "dark" || background === "color" ? "text-white/70" : "text-slate-500",
          inside ? "opacity-0" : "opacity-100",
        )}>
          在这块区域内移动鼠标，皮肤会实时跟随
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="拖动方块，测试拖拽中光标"
          className="absolute left-[12%] top-[45%] grid h-[88px] w-32 -translate-y-1/2 select-none place-items-center rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 shadow-sm active:cursor-grabbing"
          onPointerDown={(event) => {
            setGrabbing(true);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        >
          <span className="text-center">拖我<span className="mt-1 block text-2xs font-normal text-slate-500">触发「拖拽中」</span></span>
        </div>

        <button
          type="button"
          aria-label="用当前光标点击准星圆心"
          className="absolute right-[16%] top-[45%] grid size-16 -translate-y-1/2 place-items-center rounded-full border border-dashed border-slate-300"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const dx = event.clientX - (rect.left + rect.width / 2);
            const dy = event.clientY - (rect.top + rect.height / 2);
            setAimResult({ distance: Math.round(Math.hypot(dx, dy)), dx, dy });
          }}
        >
          <span className="grid size-9 place-items-center rounded-full border border-slate-300">
            <span className="size-1.5 rounded-full bg-rose-500" />
          </span>
          <span className={cn(
            "absolute -bottom-6 whitespace-nowrap text-xs font-medium",
            background === "dark" || background === "color" ? "text-white/80" : "text-slate-500",
          )}>用尖端点圆心</span>
        </button>

        {inside && source && enabled ? (
          <img
            src={source}
            alt=""
            draggable={false}
            className="pointer-events-none absolute z-20 max-w-none select-none"
            style={{
              width: rendered.width,
              height: rendered.height,
              left: position.x - hotspot.x * rendered.width,
              top: position.y - hotspot.y * rendered.height,
            }}
          />
        ) : null}
      </div>

      <div className="cursor-skin-readouts mt-2.5 grid gap-2.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-600">准星测试</div>
            <p className="mt-0.5 text-2xs leading-relaxed text-slate-500">点击上报的坐标就是指向点真实位置，偏差即误差。</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={cn(
              "inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold ring-1",
              !aimResult && "bg-white text-slate-500 ring-slate-200",
              aimResult && aimResult.distance <= 4 && "bg-emerald-50 text-emerald-700 ring-emerald-200",
              aimResult && aimResult.distance > 4 && "bg-amber-50 text-amber-800 ring-amber-200",
            )}>
              {aimResult ? `${aimResult.distance <= 4 ? "✓ " : ""}偏差 ${aimResult.distance} px` : "还没测过"}
            </span>
            {aimResult && aimResult.distance > 4 && defaultState ? (
              <button
                type="button"
                className="h-7 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                onClick={() => {
                  const current = normalizeHotspot(defaultState.hotspot);
                  const size = getRenderedImageSize(defaultState);
                  onFixHotspot({
                    x: clamp(current.x - aimResult.dx / Math.max(size.width, 1), 0, 1),
                    y: clamp(current.y - aimResult.dy / Math.max(size.height, 1), 0, 1),
                  });
                  setAimResult(null);
                }}
              >按测量结果修正</button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-600">状态触发</div>
            <p className="mt-0.5 text-2xs leading-relaxed text-slate-500">拖动方块会切到「拖拽中」，走运行时同一套状态机。</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <span className={cn("size-1.5 rounded-full", grabbing ? "bg-sky-500" : "bg-emerald-500")} />
            当前状态 · {grabbing ? "拖拽中" : "普通"}
          </span>
        </div>
      </div>
    </>
  );
}

export function CursorCalibrationStage({
  skinState,
  stateLabel,
  onChangeHotspot,
}: {
  skinState: CursorSkinState;
  stateLabel: string;
  onChangeHotspot: (hotspot: Hotspot) => void;
}) {
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const hotspot = normalizeHotspot(skinState.hotspot);
  const hotspotPx = hotspotToImagePixels(hotspot, skinState.image.width, skinState.image.height);
  const source = resolveDesktopImageSource(skinState.image);
  const imageAspect = skinState.image.width / Math.max(skinState.image.height, 1);

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const box = imageBoxRef.current?.getBoundingClientRect();
    if (!box) return;
    onChangeHotspot({
      x: clamp((event.clientX - box.left) / Math.max(box.width, 1), 0, 1),
      y: clamp((event.clientY - box.top) / Math.max(box.height, 1), 0, 1),
    });
  }

  function nudge(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    const delta: Partial<Record<string, readonly [number, number]>> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    onChangeHotspot(hotspotFromImagePixels({
      x: clamp(hotspotPx.x + move[0], 0, Math.max(0, skinState.image.width - 1)),
      y: clamp(hotspotPx.y + move[1], 0, Math.max(0, skinState.image.height - 1)),
    }, skinState.image.width, skinState.image.height));
  }

  return (
    <>
      <div
        role="application"
        tabIndex={0}
        aria-label={`${stateLabel} 指向点编辑区，方向键微调，按住 Shift 加速`}
        className="cursor-skin-stage cursor-skin-calibration relative overflow-hidden rounded-xl border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onKeyDown={nudge}
      >
        <div className="absolute inset-0 cursor-skin-dot-grid" aria-hidden />
        <div
          ref={imageBoxRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-dashed border-slate-300"
          style={{
            width: `min(76%, calc(98cqh * ${imageAspect}), 400px)`,
            aspectRatio: `${skinState.image.width} / ${skinState.image.height}`,
          }}
          onPointerDown={(event) => {
            updateFromPointer(event);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture?.(event.pointerId)) updateFromPointer(event); }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture?.(event.pointerId)}
          onPointerCancel={(event) => event.currentTarget.releasePointerCapture?.(event.pointerId)}
        >
          {source ? <img src={source} alt="" draggable={false} className="size-full select-none object-contain" /> : null}
          <span className="pointer-events-none absolute top-0 h-full w-px bg-rose-200" style={{ left: `${hotspot.x * 100}%` }} />
          <span className="pointer-events-none absolute left-0 h-px w-full bg-rose-200" style={{ top: `${hotspot.y * 100}%` }} />
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow-sm ring-1 ring-rose-200"
            style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` }}
          />
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-white/90 px-2.5 py-1.5 text-2xs font-medium text-slate-500 ring-1 ring-slate-200">
          拖动红点 · 方向键微调 1px · Shift+方向键 10px
        </div>
        <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
          指向点 {hotspotPx.x}, {hotspotPx.y}
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-white/90 px-2.5 py-1.5 text-2xs font-medium text-slate-500 ring-1 ring-slate-200">
          虚线为图片真实边界
        </div>
      </div>
    </>
  );
}

export function EmptyCursorStage({
  onPick,
  onBatchPick,
  onDrop,
}: {
  onPick: () => void;
  onBatchPick: () => void;
  onDrop: (files: FileList | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={cn(
        "cursor-skin-stage grid place-items-center rounded-xl border-2 border-dashed bg-slate-50 transition-colors",
        dragging ? "border-slate-400 bg-slate-100" : "border-slate-200",
      )}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); onDrop(event.dataTransfer.files); }}
    >
      <div className="max-w-sm px-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
          <MousePointer2 className="size-5" aria-hidden />
        </div>
        <p className="mt-3.5 text-sm font-semibold text-slate-900">把图片拖到这里</p>
        <p className="mx-auto mt-1.5 text-xs leading-relaxed text-slate-500">先上传一张主皮肤。其他状态默认继承它，需要时再派生成独立素材。</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" onClick={onPick} className="h-8 rounded-xl border border-slate-950 bg-slate-950 px-3 text-xs font-medium text-white shadow-sm hover:bg-slate-800">选择文件</button>
          <button type="button" onClick={onBatchPick} className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">批量导入</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">PNG / WebP / SVG，单张不超过 300 KB</p>
      </div>
    </div>
  );
}

export function PendingAssetTray({
  assets,
  recentAssets,
  onClear,
  onApplyRecent,
}: {
  assets: readonly PendingCursorAsset[];
  recentAssets: readonly RecentCursorAsset[];
  onClear: () => void;
  onApplyRecent: (asset: RecentCursorAsset) => void;
}) {
  if (!assets.length && !recentAssets.length) return null;
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
      {assets.slice(0, 3).map((asset) => (
        <span
          key={asset.id}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("application/x-cursordance-pending", asset.id)}
          className="grid size-12 shrink-0 cursor-grab place-items-center rounded-xl border border-slate-200 bg-white shadow-sm"
          title={asset.file.name}
        >
          <img src={asset.previewUrl} alt="" className="max-h-8 max-w-8 object-contain" />
        </span>
      ))}
      {!assets.length && recentAssets[0]?.imageDataUrl ? (
        <button type="button" onClick={() => onApplyRecent(recentAssets[0])} className="grid size-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm" title="再次使用最近素材">
          <img src={recentAssets[0].imageDataUrl} alt="" className="max-h-8 max-w-8 object-contain" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-600">{assets.length ? <>待分配 <span className="tabular-nums">{assets.length}</span></> : "最近素材"}</div>
        <p className="mt-0.5 truncate text-2xs leading-relaxed text-slate-500">{assets.length ? "批量导入里没能按文件名认出的素材。拖到右侧槽位即可使用。" : "点击缩略图可再次用于当前槽位。"}</p>
      </div>
      {assets.length ? <button type="button" onClick={onClear} className="shrink-0 text-xs font-medium text-slate-500 transition-colors hover:text-rose-500">清空</button> : null}
    </div>
  );
}

const STATE_GROUPS: readonly { label: string; hint: string; ids: readonly CursorStateId[] }[] = [
  { label: "基础", hint: "其他状态的继承源", ids: ["default"] },
  { label: "文本", hint: "可编辑与可选中的文字", ids: ["text"] },
  { label: "指向", hint: "可点击的东西", ids: ["pointer", "help"] },
  { label: "拖拽", hint: "按住并移动对象", ids: ["grabbing"] },
  { label: "状态反馈", hint: "不是位置而是状态", ids: ["busy", "notAllowed"] },
];

export function CursorSlotList({
  cards,
  selectedId,
  hasMaster,
  onlyEffective,
  onOnlyEffectiveChange,
  onSelect,
  onDerive,
  onInherit,
  onDeriveAll,
  onUploadDefault,
  onAssignPending,
}: {
  cards: readonly CursorStateCard[];
  selectedId: string;
  hasMaster: boolean;
  onlyEffective: boolean;
  onOnlyEffectiveChange: (value: boolean) => void;
  onSelect: (id: string) => void;
  onDerive: (id: string) => void;
  onInherit: (id: string) => void;
  onDeriveAll: () => void;
  onUploadDefault: () => void;
  onAssignPending: (assetId: string, stateId: string) => void;
}) {
  const ownCount = cards.filter((card) => card.id !== "default" && card.ownState).length;
  const unavailableCount = cards.filter((card) => !card.reachable).length;
  const visible = onlyEffective ? cards.filter((card) => card.reachable) : cards;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-slate-900">皮肤槽位</h3>
            <div className="mt-0.5 text-xs text-slate-500">{hasMaster ? <>主皮肤 + {ownCount} 个独立覆盖 · {unavailableCount} 个状态在其他端生效</> : "还没有主皮肤"}</div>
          </div>
          <button type="button" disabled={!hasMaster} onClick={onDeriveAll} className="h-7 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40">全部派生</button>
        </div>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={onlyEffective} onChange={(event) => onOnlyEffectiveChange(event.target.checked)} className="size-3.5 rounded border-slate-300 accent-slate-900" />
          <span className="text-xs text-slate-500">只看现在能生效的状态</span>
        </label>
      </div>
      <div className="max-h-[420px] space-y-2.5 overflow-y-auto px-4 py-3">
        {STATE_GROUPS.map((group) => {
          const groupCards = group.ids.map((id) => visible.find((card) => card.id === id)).filter(Boolean) as CursorStateCard[];
          if (!groupCards.length) return null;
          return (
            <div key={group.label}>
              <div className="mb-1.5 flex items-baseline gap-2 px-0.5">
                <span className="text-xs font-semibold text-slate-500">{group.label}</span>
                <span className="truncate text-2xs text-slate-500">{group.hint}</span>
                <span className="ml-auto text-xs tabular-nums text-slate-300">{groupCards.length}</span>
              </div>
              <div className="space-y-1">
                {groupCards.map((card) => {
                  const Icon = card.icon;
                  const isMaster = card.id === "default";
                  if (isMaster && !hasMaster) {
                    return (
                      <div key={card.id} className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-300"><ImagePlus className="size-5" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-900">普通</span><span className="mt-0.5 block text-2xs text-slate-500">上传后其他状态就能继承它</span></span>
                        <button type="button" onClick={onUploadDefault} className="h-7 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm">上传</button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      aria-current={selectedId === card.id}
                      onClick={() => onSelect(card.id)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(card.id); }}
                      onDragOver={(event) => { if (hasMaster) event.preventDefault(); }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const assetId = event.dataTransfer.getData("application/x-cursordance-pending");
                        if (assetId) onAssignPending(assetId, card.id);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                        isMaster ? "border-2 border-slate-950 bg-white shadow-sm" : card.ownState ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50/60",
                        selectedId === card.id && !isMaster && "ring-1 ring-slate-300",
                      )}
                    >
                      <CursorImage skinState={card.resolvedState} inherited={card.inherited} className="size-11" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                          <span className="truncate text-sm font-medium text-slate-900">{card.label}</span>
                          {isMaster ? <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-2xs font-medium text-white">必需</span> : null}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-medium", card.reachable ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500")}>
                            {card.reachable ? <span className="size-1.5 rounded-full bg-emerald-500" /> : null}{card.reachable ? "现在生效" : "其他端生效"}
                          </span>
                          <span className="truncate text-xs text-slate-500">{card.ownState ? `${card.id}.png` : card.detail}</span>
                        </span>
                      </span>
                      {!isMaster ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="radiogroup" aria-label={`${card.label}的素材来源`} onClick={(event) => event.stopPropagation()}>
                          <SegmentedButton active={!card.ownState} disabled={!hasMaster} onClick={() => onInherit(card.id)}>继承</SegmentedButton>
                          <SegmentedButton active={Boolean(card.ownState)} disabled={!hasMaster} onClick={() => onDerive(card.id)}>独立</SegmentedButton>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CursorProperties({
  card,
  mode,
  onModeChange,
  onChangeHotspot,
  onChangeSize,
  onClear,
  onReplace,
  onDerive,
}: {
  card: CursorStateCard;
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  onChangeHotspot: (hotspot: Hotspot) => void;
  onChangeSize: (size: number) => void;
  onClear: () => void;
  onReplace: () => void;
  onDerive: () => void;
}) {
  const editable = card.ownState;
  const resolved = card.resolvedState;
  const hotspot = normalizeHotspot(resolved?.hotspot);
  const hotspotPx = hotspotToImagePixels(hotspot, resolved?.image.width, resolved?.image.height);
  const naturalWidth = resolved?.image.width || DEFAULT_BOX_SIZE;
  const naturalHeight = resolved?.image.height || DEFAULT_BOX_SIZE;
  const size = getDisplaySize(resolved);

  function emitPixels(next: Hotspot) {
    if (!editable) return;
    onChangeHotspot(hotspotFromImagePixels(next, naturalWidth, naturalHeight));
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-medium text-slate-900">{card.id === "default" ? "主皮肤" : card.label} · 属性</h3>
        <div className="mt-0.5 text-xs text-slate-500">{editable ? "改动即时生效，可撤销" : "当前继承主皮肤，派生后可单独调整"}</div>
      </div>
      {!editable ? (
        <div className="px-4 py-4">
          <button type="button" onClick={onDerive} className="h-8 w-full rounded-xl border border-slate-950 bg-slate-950 px-3 text-xs font-medium text-white shadow-sm">派生独立素材</button>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-3">
          <div>
            <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-600">显示尺寸</span><span className="text-xs font-semibold tabular-nums text-slate-600">{size} px</span></div>
            <Slider
              compact
              showInput={false}
              className="mt-2.5"
              value={size}
              min={24}
              max={72}
              ticks={[32, 48, 64]}
              snapToTicks
              onChange={onChangeSize}
              label="显示尺寸"
            />
            <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-500"><span>24</span><span>32</span><span>48</span><span>64</span><span>72</span></div>
          </div>
          <div className="border-t border-slate-100 pt-3.5">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-600">指向点</span><span className="text-xs font-semibold tabular-nums text-slate-600">{hotspotPx.x}, {hotspotPx.y}</span></div>
            <p className="mt-0.5 text-2xs leading-relaxed text-slate-500">系统判定点击的那一个像素。</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => onModeChange("calibrate")} className="h-7 rounded-xl border border-slate-950 bg-slate-950 px-2.5 text-xs font-medium text-white shadow-sm">在舞台上校准</button>
              <button type="button" onClick={() => onChangeHotspot({ x: 0, y: 0 })} className="h-7 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm">左上尖端</button>
              <button type="button" onClick={() => onChangeHotspot({ x: 0.5, y: 0.5 })} className="h-7 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm">中心</button>
            </div>
            <details className="mt-2.5">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">精确值</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="grid gap-1"><span className="text-xs font-medium text-slate-500">X</span><input type="number" value={hotspotPx.x} min={0} max={Math.max(0, naturalWidth - 1)} onChange={(event) => emitPixels({ x: Number(event.target.value), y: hotspotPx.y })} className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-center text-xs tabular-nums text-slate-700 shadow-sm" /></label>
                <label className="grid gap-1"><span className="text-xs font-medium text-slate-500">Y</span><input type="number" value={hotspotPx.y} min={0} max={Math.max(0, naturalHeight - 1)} onChange={(event) => emitPixels({ x: hotspotPx.x, y: Number(event.target.value) })} className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-center text-xs tabular-nums text-slate-700 shadow-sm" /></label>
              </div>
            </details>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
            <div><div className="text-xs font-medium text-slate-600">素材</div><div className="mt-0.5 text-2xs text-slate-500">原图 {naturalWidth} × {naturalHeight}</div></div>
            <div className="flex gap-1">
              <button type="button" onClick={onReplace} className="h-7 rounded-xl px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50">替换</button>
              <button type="button" onClick={onClear} className="h-7 rounded-xl px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-500">清除皮肤</button>
            </div>
          </div>
          {mode === "calibrate" ? <p className="text-2xs leading-relaxed text-slate-500">方向键微调 1px，按住 Shift 可一次移动 10px。</p> : null}
        </div>
      )}
    </section>
  );
}

export function CursorCapabilityNote() {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0"><h3 className="text-sm font-medium text-slate-900">指向反馈</h3><p className="mt-0.5 text-2xs leading-relaxed text-slate-500">指针停在可点元素上时的持续反馈。</p></div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-2xs font-medium text-slate-500">需要 AX 元素</span>
      </div>
      <div className="px-4 py-3 text-xs leading-relaxed text-slate-500">当前领域模型尚未提供磁场光晕配置。能力接入后会在这里开放，当前不会展示无法保存的假开关。</div>
    </section>
  );
}
