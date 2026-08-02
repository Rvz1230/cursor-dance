import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { ImagePlus, MousePointer2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPill } from "@/components/ui/data-pill";
import { NumberField } from "@/components/ui/number-field";
import { cn } from "@/components/ui/utils";
import { resolveDesktopImageSource } from "@/shared/asset-reference";
import type { CursorStateId } from "@/shared/cursor-states";
import {
  hotspotFromImagePixels,
  hotspotToImagePixels,
  normalizeHotspot,
} from "@/shared/effect-core/cursor-hotspot";
import {
  DEFAULT_BOX_SIZE,
  clamp,
  getDefaultHotspot,
  getDisplaySize,
  type CursorSkinStateLike,
  type CursorStateMeta,
  type Hotspot,
} from "./cursorSkinModel";

const PREVIEW_STAGE_SIZE = 340;
const DISPLAY_SIZE_OPTIONS = [32, 48, 64] as const;

export interface CursorStateCard extends CursorStateMeta {
  ownState: CursorSkinStateLike | null;
  resolvedState: CursorSkinStateLike | null;
  inherited: boolean;
}

export function CursorImage({
  skinState,
  inherited = false,
  className = "",
}: {
  skinState: CursorSkinStateLike | null;
  inherited?: boolean;
  className?: string;
}) {
  const size = skinState ? Math.min(getDisplaySize(skinState), 44) : 34;
  const imageSource = resolveDesktopImageSource(skinState?.image);
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border bg-white",
        inherited ? "border-dashed border-slate-200" : "border-slate-200",
        className,
      )}
    >
      {imageSource ? (
        <img src={imageSource} alt="" className="object-contain" style={{ width: size, height: size }} />
      ) : (
        <MousePointer2 className="size-5 text-slate-300" aria-hidden />
      )}
    </div>
  );
}

export function StateRail({
  stateCards,
  stateId,
  setStateId,
}: {
  stateCards: readonly CursorStateCard[];
  stateId: string;
  setStateId: (next: string) => void;
}) {
  return (
    <div role="tablist" aria-label="光标状态" className="flex gap-2.5 overflow-x-auto pb-1">
      {stateCards.map((state) => {
        const Icon = state.icon;
        const active = state.id === stateId;
        return (
          <button
            key={state.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setStateId(state.id)}
            className={cn(
              "flex min-w-[168px] items-center gap-2.5 rounded-xl border bg-white p-3 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
              active ? "border-slate-950" : "border-slate-200/80",
            )}
          >
            <CursorImage skinState={state.resolvedState} inherited={state.inherited} className="size-12" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Icon className={cn("size-4 shrink-0", active ? "text-slate-900" : "text-slate-400")} aria-hidden />
                <span className="truncate text-sm font-semibold text-slate-900">{state.label}</span>
              </div>
              <div className="mt-1 truncate text-2xs text-slate-400">
                {state.ownState ? "独立皮肤" : state.id === "default" ? "待上传" : "继承普通"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function DropUpload({
  skinState,
  stateMeta,
  onPick,
  onDropFiles,
  fileInputRef,
}: {
  skinState: CursorSkinStateLike | null;
  stateMeta: CursorStateMeta;
  onPick: (file: File | undefined) => void;
  onDropFiles: (files: FileList | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onDropFiles(event.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition-colors",
        dragging ? "border-slate-950 bg-slate-50" : "border-slate-200",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <CursorImage skinState={skinState} className="size-16" />
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{stateMeta.label}</div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
              {stateMeta.detail}。把图片拖到这里，或点击上传替换当前状态皮肤。
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              onPick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button className="h-9" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 size-4" aria-hidden />
            上传皮肤
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HotspotStudio({
  skinState,
  stateMeta,
  onChangeHotspot,
  onChangeSize,
}: {
  skinState: CursorSkinStateLike | null;
  stateMeta: CursorStateMeta;
  onChangeHotspot: (hotspot: Hotspot) => void;
  onChangeSize: (boxSize: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const image = skinState?.image;
  const imageSource = resolveDesktopImageSource(image);
  const displaySize = getDisplaySize(skinState);
  const naturalWidth = image?.width || DEFAULT_BOX_SIZE;
  const naturalHeight = image?.height || DEFAULT_BOX_SIZE;
  // 存储是 0–1 分数，但这一屏的交互（拖拽 / 方向键 / 数值框）全部按原图像素进行——
  // 用户想的就是「图片上的第几个像素」。分数与像素的换算只发生在这两个边界上。
  const hotspot = normalizeHotspot(skinState?.hotspot, naturalWidth, naturalHeight);
  const hotspotPx = hotspotToImagePixels(hotspot, naturalWidth, naturalHeight);
  const scale = Math.min(1, (PREVIEW_STAGE_SIZE * 0.68) / Math.max(displaySize, 1));
  const previewSize = displaySize * scale;
  const offset = (PREVIEW_STAGE_SIZE - previewSize) / 2;
  const hotspotLeft = offset + hotspot.x * previewSize;
  const hotspotTop = offset + hotspot.y * previewSize;

  function emitHotspotPx(pixels: Hotspot) {
    onChangeHotspot(hotspotFromImagePixels(pixels, naturalWidth, naturalHeight));
  }

  function updateHotspotFromEvent(event: ReactPointerEvent<HTMLDivElement>) {
    if (!stageRef.current || !skinState) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clamp(
      ((event.clientX - rect.left - offset) / Math.max(previewSize, 1)) * naturalWidth,
      0,
      naturalWidth - 1,
    );
    const y = clamp(
      ((event.clientY - rect.top - offset) / Math.max(previewSize, 1)) * naturalHeight,
      0,
      naturalHeight - 1,
    );
    emitHotspotPx({ x: Math.round(x), y: Math.round(y) });
  }

  function nudgeHotspot(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!skinState) return;
    const step = event.shiftKey ? 10 : 1;
    const deltas: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    emitHotspotPx({
      x: clamp(hotspotPx.x + delta[0], 0, naturalWidth - 1),
      y: clamp(hotspotPx.y + delta[1], 0, naturalHeight - 1),
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_264px]">
      <div
        ref={stageRef}
        role="application"
        tabIndex={0}
        aria-label={`${stateMeta.label} 指向点编辑区，方向键微调，按住 Shift 加速`}
        aria-valuetext={skinState ? `指向点 X ${hotspotPx.x}，Y ${hotspotPx.y}` : "尚未上传图片"}
        onKeyDown={nudgeHotspot}
        onPointerDown={(event) => {
          if (!skinState) return;
          setDragging(true);
          updateHotspotFromEvent(event);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging) updateHotspotFromEvent(event);
        }}
        onPointerUp={endDrag}
        // 必须处理 pointercancel：系统手势中断拖拽时不补发 pointerup，
        // 否则 dragging 会永久停留在 true。
        onPointerCancel={endDrag}
        className="relative h-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden
        />
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-200" aria-hidden />
        <div className="absolute left-0 top-1/2 h-px w-full bg-slate-200" aria-hidden />
        {imageSource ? (
          <>
            <img
              src={imageSource}
              alt=""
              draggable={false}
              className="absolute select-none object-contain"
              style={{ width: previewSize, height: previewSize, left: offset, top: offset }}
            />
            <div
              className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow-sm ring-1 ring-rose-200"
              style={{ left: hotspotLeft, top: hotspotTop }}
              aria-hidden
            />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="text-xs text-slate-500">
              <ImagePlus className="mx-auto mb-2.5 size-8 text-slate-300" aria-hidden />
              上传图片后在这里拖动红点设置指向点
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-xs font-medium text-slate-600">指向点与尺寸</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          红点就是系统判定点击的像素。文本、拖拽类光标通常更适合中心点。
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={hotspotPx.x}
            max={Math.max(0, naturalWidth - 1)}
            disabled={!skinState}
            onChange={(x) => emitHotspotPx({ x, y: hotspotPx.y })}
          />
          <NumberField
            label="Y"
            value={hotspotPx.y}
            max={Math.max(0, naturalHeight - 1)}
            disabled={!skinState}
            onChange={(y) => emitHotspotPx({ x: hotspotPx.x, y })}
          />
        </div>
        {/* 这几个位置本身就是分数语义（角、正中、底边中点），直接写分数比先算像素再折回去准。 */}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Chip disabled={!skinState} onClick={() => onChangeHotspot({ x: 0, y: 0 })}>左上角</Chip>
          <Chip disabled={!skinState} onClick={() => onChangeHotspot({ x: 0.5, y: 0.5 })}>中心点</Chip>
          <Chip disabled={!skinState} onClick={() => onChangeHotspot({ x: 0.5, y: 1 })}>底部中心</Chip>
          <Chip disabled={!skinState} onClick={() => onChangeHotspot(getDefaultHotspot(stateMeta))}>
            推荐点
          </Chip>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-3.5">
          <div className="mb-2.5 text-xs font-medium text-slate-600">显示尺寸</div>
          <div className="grid grid-cols-3 gap-2">
            {DISPLAY_SIZE_OPTIONS.map((size) => (
              <Chip
                key={size}
                active={displaySize === size}
                disabled={!skinState}
                onClick={() => onChangeSize(size)}
              >
                {size}
              </Chip>
            ))}
          </div>
          <div className="mt-2.5 text-2xs tabular-nums text-slate-400">
            原图 {naturalWidth} × {naturalHeight}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  disabled,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

/**
 * 试用区：列出当前平台可达的状态，点击切换到该状态进行编辑。
 *
 * 旧实现用 onMouseEnter 改预览状态但移开不复位，导致大预览停留在最后悬停的
 * 状态、与正在编辑的状态脱钩；同时它自带第二套状态命名（「桌面空白」/
 * 「输入文字」…）与 CURSOR_STATES 的标签冲突。现在只做单一职责的导航，
 * 标签全部来自真值源。
 */
export function TryZone({
  stateCards,
  stateId,
  onSelect,
}: {
  stateCards: readonly CursorStateCard[];
  stateId: string;
  onSelect: (next: CursorStateId | string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-medium text-slate-600">试用区</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        选择一个状态查看它当前生效的皮肤。
      </p>
      <div className="mt-3 grid gap-2">
        {stateCards.map((card) => {
          const active = card.id === stateId;
          return (
            <button
              key={card.id}
              type="button"
              aria-current={active}
              onClick={() => onSelect(card.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
                active ? "border-slate-950 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <CursorImage skinState={card.resolvedState} inherited={card.inherited} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-700">{card.label}</div>
                <div className="mt-0.5 truncate text-2xs text-slate-400">{card.detail}</div>
              </div>
              {card.inherited ? <DataPill tone="slate">继承</DataPill> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface RecentCursorAsset {
  imageDataUrl?: string;
  name?: string;
}

export function RecentAssets({
  assets,
  onApply,
}: {
  assets: readonly RecentCursorAsset[] | undefined;
  onApply: (asset: RecentCursorAsset) => void;
}) {
  if (!assets?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-medium text-slate-600">最近素材</div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {assets.slice(0, 10).map((asset, index) => (
          <button
            key={`${asset.imageDataUrl?.slice(0, 32)}-${index}`}
            type="button"
            onClick={() => onApply(asset)}
            aria-label={`应用素材 ${asset.name || index + 1}`}
            className="grid size-12 place-items-center rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            title={asset.name || "最近素材"}
          >
            <img src={asset.imageDataUrl} alt="" className="size-8 object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
