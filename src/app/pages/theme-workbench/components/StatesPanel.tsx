import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineStatus } from "@/components/ui/inline-status";
import { PageHeader } from "@/components/ui/page-header";
import { isDesktop } from "@/shared/runtime";
import { hotspotToImagePixels, normalizeHotspot } from "@/shared/effect-core/cursor-hotspot";
import type { CursorSkin, CursorSkinState } from "@/shared/domain/cursor-dance";
import { CURSOR_STATES } from "../model/workbenchSchema";
import { validateCursorAssetFile } from "../lib/cursorAssetPresets";
import {
  CursorImage,
  DropUpload,
  HotspotStudio,
  RecentAssets,
  StateRail,
  TryZone,
  type CursorStateCard,
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
import type { CursorAssetDraft, RecentCursorAsset } from "../lib/storage/repository/types";

type StatusTone = "success" | "error" | "warning" | "info";

export interface StatesPanelProps {
  stateId: string;
  setStateId: (next: string) => void;
  cursorSkin: CursorSkin | null;
  recentCursorAssets?: readonly RecentCursorAsset[];
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
  recentCursorAssets,
  updateCursorSkinState,
  clearCursorSkinState,
  copyDefaultCursorSkinState,
  resetCursorSkin,
  rememberRecentCursorAsset,
}: StatesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<StatusTone>("info");
  const currentMeta = CURSOR_STATES.find((state) => state.id === stateId) || CURSOR_STATES[0];
  const currentSkinState = cursorSkin?.states?.[stateId] || null;
  const resolvedSkinState = getResolvedSkinState(cursorSkin, stateId);
  const systemCursorCapability = window.electronAPI?.capabilities.systemCursorReplacement;

  const stateCards: CursorStateCard[] = useMemo(() => {
    const defaultState = cursorSkin?.states?.default || null;
    return CURSOR_STATES.map((state) => {
      const ownState = cursorSkin?.states?.[state.id] || null;
      return {
        ...state,
        ownState,
        resolvedState: ownState || defaultState,
        inherited: state.id !== "default" && !ownState,
      };
    });
  }, [cursorSkin]);

  useEffect(() => {
    setMessage("");
    setMessageTone("info");
  }, [stateId]);

  async function buildSkinStateFromFile(file: File, targetStateId: string): Promise<CursorSkinState> {
    const validationMessage = validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES);
    if (validationMessage) throw new Error(validationMessage);
    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await getAssetDimensions(dataUrl);
    const stateMeta = CURSOR_STATES.find((state) => state.id === targetStateId);
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

  async function applyFile(file: File | undefined, targetStateId: string = stateId) {
    if (!file) return;
    try {
      const skinState = await buildSkinStateFromFile(file, targetStateId);
      updateCursorSkinState(targetStateId, skinState);
      // 最近素材的 hotspotX/Y 是原图像素；领域模型的 hotspot 是 0–1 分数。
      const cachedHotspot = hotspotToImagePixels(
        normalizeHotspot(skinState.hotspot),
        skinState.image?.width,
        skinState.image?.height,
      );
      const recentAsset: CursorAssetDraft = {
        imageDataUrl: skinState.image.kind === "dataUrl" ? skinState.image.dataUrl : undefined,
        hotspotX: cachedHotspot.x,
        hotspotY: cachedHotspot.y,
        size: skinState.size.boxSize || DEFAULT_BOX_SIZE,
        sourceWidth: skinState.image.width,
        sourceHeight: skinState.image.height,
        name: file.name,
        mimeType: skinState.image.mimeType,
      };
      void rememberRecentCursorAsset?.(recentAsset);
      const label = CURSOR_STATES.find((state) => state.id === targetStateId)?.label || targetStateId;
      setMessage(`已应用到「${label}」。`);
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "素材读取失败。");
      setMessageTone("error");
    }
  }

  async function applyBatchFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let applied = 0;
    const unmatched: string[] = [];
    const occupied = new Set<string>();
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
    setMessage(
      unmatched.length
        ? `已自动匹配 ${applied} 个文件，${unmatched.length} 个文件需要手动选择状态。`
        : `已自动匹配 ${applied} 个状态。`,
    );
    setMessageTone(unmatched.length ? "warning" : "success");
  }

  function updateHotspot(hotspot: Hotspot) {
    if (!currentSkinState) return;
    updateCursorSkinState(stateId, { ...currentSkinState, hotspot });
  }

  function updateSize(boxSize: number) {
    if (!currentSkinState) return;
    updateCursorSkinState(stateId, { ...currentSkinState, size: { mode: "fixedBox", boxSize } });
  }

  function applyRecentAsset(asset: RecentCursorAsset) {
    if (!asset?.imageDataUrl) return;
    updateCursorSkinState(stateId, buildSkinStateFromAsset(asset));
  }

  return (
    <div className="min-h-full bg-slate-100 p-3">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-2.5">
        <PageHeader
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          title="光标皮肤"
          description="为每个光标状态上传一张图片。运行时会根据当前语义自动切换到对应皮肤。"
          actions={(
            <>
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
            <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => batchInputRef.current?.click()}>
              <Upload className="mr-1.5 size-3.5" aria-hidden />
              批量导入
            </Button>
            <Button variant="ghost" className="h-8 px-3 text-xs" onClick={resetCursorSkin}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              重置
            </Button>
            </>
          )}
        />

        {/*
          桌面端只有 default 与 grabbing 可达——没有 DOM 也没有查询系统当前光标的
          能力。这里明确说明，而不是把不可达的状态摆出来让用户白配。
        */}
        {isDesktop() ? (
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>
              桌面端可识别「普通」和「拖拽中」两种状态。其余状态需要读取页面语义，桌面无法获取，因此不提供配置。
            </span>
          </div>
        ) : null}

        {systemCursorCapability && systemCursorCapability.status !== "supported" ? (
          <InlineStatus tone="warning">{systemCursorCapability.message}</InlineStatus>
        ) : null}

        <StateRail stateCards={stateCards} stateId={stateId} setStateId={setStateId} />

        <main className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-2.5">
            <DropUpload
              skinState={resolvedSkinState.state}
              stateMeta={currentMeta}
              onPick={(file) => void applyFile(file)}
              onDropFiles={(files) => void applyFile(files?.[0])}
              fileInputRef={fileInputRef}
            />

            {message ? <InlineStatus tone={messageTone}>{message}</InlineStatus> : null}

            <HotspotStudio
              skinState={currentSkinState}
              stateMeta={currentMeta}
              onChangeHotspot={updateHotspot}
              onChangeSize={updateSize}
            />
          </div>

          <aside className="space-y-2.5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-medium text-slate-600">当前状态</div>
              <div className="mt-3 flex items-center gap-3">
                <CursorImage
                  skinState={resolvedSkinState.state}
                  inherited={resolvedSkinState.inherited}
                  className="size-16"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{currentMeta.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {currentSkinState
                      ? "使用独立皮肤"
                      : stateId === "default"
                        ? "等待上传"
                        : "继承普通皮肤"}
                  </div>
                </div>
              </div>
              <div className="mt-3.5 grid gap-2">
                {stateId !== "default" ? (
                  <Button
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={!cursorSkin?.states?.default}
                    onClick={() => copyDefaultCursorSkinState(stateId)}
                  >
                    <Check className="mr-1.5 size-3.5" aria-hidden />
                    复制普通状态
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={!currentSkinState}
                  onClick={() => clearCursorSkinState(stateId)}
                >
                  <X className="mr-1.5 size-3.5" aria-hidden />
                  清除当前状态
                </Button>
              </div>
            </div>

            <TryZone stateCards={stateCards} stateId={stateId} onSelect={setStateId} />
            <RecentAssets assets={recentCursorAssets} onApply={applyRecentAsset} />
          </aside>
        </main>
      </div>
    </div>
  );
}
