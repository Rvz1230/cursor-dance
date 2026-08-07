import { ImagePlus, MousePointer2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/components/ui/utils";
import { resolveDesktopImageSource } from "@/shared/asset-reference";
import type { CursorStateId } from "@/shared/cursor-states";
import {
  hotspotFromImagePixels,
  hotspotToImagePixels,
  normalizeHotspot,
} from "@/shared/effect-core/cursor-hotspot";
import type { CursorSkinState } from "@/shared/domain/cursor-dance";
import type { RecentCursorAsset } from "../../lib/storage/repository/types";
import {
  DEFAULT_BOX_SIZE,
  getDisplaySize,
  type Hotspot,
} from "./cursorSkinModel";
import type {
  CalibrationStatus,
  CursorStateCard,
  StudioMode,
} from "./CursorSkinStudio";

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
    <span className={cn("grid shrink-0 place-items-center rounded-xl border bg-white", inherited ? "border-dashed border-slate-200" : "border-slate-200", className)}>
      {imageSource ? (
        <img src={imageSource} alt="" draggable={false} className="select-none object-contain" style={{ width: rendered.width * scale, height: rendered.height * scale }} />
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

export function PendingAssetTray({
  assets,
  recentAssets,
  onClear,
  onApplyRecent,
}: {
  assets: readonly RecentCursorAsset[];
  recentAssets: readonly RecentCursorAsset[];
  onClear: () => void;
  onApplyRecent: (asset: RecentCursorAsset) => void;
}) {
  if (!assets.length && !recentAssets.length) return null;
  return (
    <div className="mt-2.5 flex items-center gap-3 overflow-x-auto rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
      {assets.map((asset) => (
        <span
          key={asset.id}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("application/x-cursordance-pending", asset.id)}
          className="grid size-12 shrink-0 cursor-grab place-items-center rounded-xl border border-slate-200 bg-white shadow-sm"
          title={asset.name}
        >
          <img src={asset.imageDataUrl} alt="" className="max-h-8 max-w-8 object-contain" />
        </span>
      ))}
      {!assets.length && recentAssets[0]?.imageDataUrl ? (
        <button type="button" onClick={() => onApplyRecent(recentAssets[0])} className="grid size-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm" title="再次使用最近素材">
          <img src={recentAssets[0].imageDataUrl} alt="" className="max-h-8 max-w-8 object-contain" />
        </button>
      ) : null}
      <div className="min-w-[180px] flex-1">
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
  calibrationStatus,
  onModeChange,
  onChangeHotspot,
  onChangeSize,
  onClear,
  onReplace,
  onDerive,
}: {
  card: CursorStateCard;
  mode: StudioMode;
  calibrationStatus: CalibrationStatus;
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
  const calibrationText = calibrationStatus.kind === "untested"
    ? "未测试，去舞台点一次准星"
    : calibrationStatus.kind === "fixed"
      ? "已按测量结果修正，建议再测一次"
      : calibrationStatus.accurate
        ? `已校准 · 偏差 ${calibrationStatus.distance} px`
        : `偏差 ${calibrationStatus.distance} px，建议修正`;

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
            <div><div className="text-xs font-medium text-slate-600">校准状态</div><div className={cn("mt-0.5 text-2xs", calibrationStatus.kind === "tested" && !calibrationStatus.accurate ? "text-amber-700" : calibrationStatus.kind === "tested" ? "text-emerald-700" : "text-slate-500")}>{calibrationText}</div><div className="mt-0.5 text-2xs text-slate-400">原图 {naturalWidth} × {naturalHeight}</div></div>
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

export function CursorPointFeedback({
  atmosphere,
  activeOnThisPlatform,
  onChange,
}: {
  atmosphere: Record<string, unknown>;
  activeOnThisPlatform: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const enabled = atmosphere.mode === "creative-mouse";
  const radius = typeof atmosphere.magnetRadius === "number" ? atmosphere.magnetRadius : 32;
  const strength = typeof atmosphere.magnetStrength === "number" ? atmosphere.magnetStrength : 45;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0"><h3 className="text-sm font-medium text-slate-900">指向反馈</h3><p className="mt-0.5 text-2xs leading-relaxed text-slate-500">指针停在可点元素上时的持续反馈。它不属于任何一次点击。</p></div>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-2xs font-medium", activeOnThisPlatform ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{activeOnThisPlatform ? "现在生效" : "网页端生效"}</span>
      </div>
      <div className="space-y-3 px-4 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange({ mode: enabled ? "none" : "creative-mouse" })}
          className="flex w-full items-center justify-between gap-3 rounded-xl text-left"
        >
          <span className="min-w-0"><span className="block text-xs font-medium text-slate-700">磁场光晕</span><span className="mt-0.5 block text-2xs leading-relaxed text-slate-500">靠近按钮、链接等可点击元素时，元素边缘泛起微光。</span></span>
          <span className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", enabled ? "bg-slate-950" : "bg-slate-300")}><span className={cn("size-4 rounded-full bg-white shadow-sm transition-transform", enabled ? "translate-x-4" : "translate-x-0.5")} /></span>
        </button>
        {enabled ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div><div className="flex items-center justify-between text-xs text-slate-600"><span className="font-medium">感应半径</span><span className="tabular-nums">{radius} px</span></div><Slider compact showInput={false} className="mt-1.5" value={radius} min={8} max={96} ticks={[16, 32, 64]} snapToTicks onChange={(value) => onChange({ magnetRadius: value })} label="磁场光晕感应半径" /></div>
            <div><div className="flex items-center justify-between text-xs text-slate-600"><span className="font-medium">强度</span><span className="tabular-nums">{strength} %</span></div><Slider compact showInput={false} className="mt-1.5" value={strength} min={0} max={100} onChange={(value) => onChange({ magnetStrength: value })} label="磁场光晕强度" /></div>
            <p className="text-2xs leading-relaxed text-slate-500">取不到元素语义时自动回落，不会对空白区域错误发光。</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
