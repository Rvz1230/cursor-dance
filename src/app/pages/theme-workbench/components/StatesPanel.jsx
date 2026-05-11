import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, ImagePlus, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/components/ui/utils.js";
import {
  CURSOR_HOTSPOT_OPTIONS,
  CURSOR_SIZE_OPTIONS,
  CURSOR_STATES,
  formatActionLabel,
} from "../model/workbenchSchema.js";
import { DataPill, Panel, SmallSelect } from "./WorkbenchControls.jsx";
import { getBuiltinCursorPresetCards, validateCursorAssetFile } from "../lib/cursorAssetPresets.js";

const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;

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
  rememberRecentCursorAsset,
  copyDefaultCursorStateAsset,
  resetCurrentCursorState,
  resetAllCursorStates,
}) {
  const fileInputRef = useRef(null);
  const [assetMessage, setAssetMessage] = useState("");
  const [assetMessageTone, setAssetMessageTone] = useState("slate");
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);
  const currentMode = cursorModes[stateId];
  const currentActionId = cursorStateActions?.[stateId] || "leftClick";
  const currentAsset = cursorStateAssets?.[stateId] || { imageDataUrl: "", hotspotX: 16, hotspotY: 32, size: 48 };
  const effectiveActionId = stateId !== "default" && currentMode === "继承"
    ? (cursorStateActions?.default || "leftClick")
    : currentActionId;
  const effectiveAsset = stateId !== "default" && currentMode === "继承"
    ? (cursorStateAssets?.default || currentAsset)
    : currentAsset;
  const actionOptions = actionItems.map((item) => ({ value: item.id, label: item.label }));
  const sizeValue = `${currentAsset.size} × ${currentAsset.size}`;
  const hotspotValue = `${currentAsset.hotspotX}, ${currentAsset.hotspotY}`;
  const builtinPresetCards = getBuiltinCursorPresetCards(stateId);
  const assetStatusLabel = effectiveAsset.imageDataUrl
    ? currentMode === "继承" && stateId !== "default"
      ? "继承图片"
      : "已配置图片"
    : "未配置";
  const modeTone = currentMode === "覆盖" ? "amber" : currentMode === "源" ? "teal" : "slate";

  useEffect(() => {
    setAssetMessage("");
    setAssetMessageTone("slate");
    setIsDraggingAsset(false);
  }, [stateId]);

  function applyAssetFile(file) {
    if (!file) return;
    const validationMessage = validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES);
    if (validationMessage) {
      setAssetMessage(validationMessage);
      setAssetMessageTone("rose");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      const nextAsset = {
        imageDataUrl: reader.result,
        hotspotX: currentAsset.hotspotX,
        hotspotY: currentAsset.hotspotY,
        size: currentAsset.size,
      };

      updateCursorStateAsset(nextAsset);
      void rememberRecentCursorAsset({
        ...nextAsset,
        name: file.name,
        mimeType: file.type,
      });
      setAssetMessage(`已载入 ${file.name}。`);
      setAssetMessageTone("teal");
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(event) {
    applyAssetFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function applyBuiltinPreset(presetAsset, presetLabel) {
    updateCursorStateAsset(presetAsset);
    setAssetMessage(`已应用${presetLabel}。`);
    setAssetMessageTone("teal");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Panel title="光标状态列表" action={<Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={resetAllCursorStates}><RotateCcw className="mr-2 h-4 w-4" />恢复默认状态</Button>}>
        <div className="grid gap-3 md:grid-cols-2">
          {CURSOR_STATES.map((state) => {
            const Icon = state.icon;
            const active = state.id === stateId;
            const mode = cursorModes[state.id];
            return (
              <button
                key={state.id}
                type="button"
                onClick={() => setStateId(state.id)}
                className={cn("rounded-3xl border p-4 text-left transition-colors", active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-300")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", active ? "bg-white text-emerald-700" : "bg-white text-slate-500")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <DataPill tone={mode === "覆盖" ? "amber" : mode === "源" ? "teal" : "slate"}>{mode}</DataPill>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{state.label}</div>
                <div className="mt-1 text-xs text-slate-500">{state.detail}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="当前状态配置" action={<Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={resetCurrentCursorState}><RotateCcw className="mr-2 h-4 w-4" />重置当前状态</Button>}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">当前模式</div>
              <div className="mt-2 flex items-center gap-2">
                <DataPill tone={modeTone}>{currentMode}</DataPill>
                <span className="text-sm text-slate-500">{stateId === "default" ? "默认源" : "继承链"}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">动作模板</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{formatActionLabel(effectiveActionId)}</div>
              <div className="mt-1 text-xs text-slate-500">{stateId === "default" ? "默认模板" : currentMode === "覆盖" ? "独立模板" : "跟随 default"}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">素材状态</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{assetStatusLabel}</div>
              <div className="mt-1 text-xs text-slate-500">{effectiveAsset.imageDataUrl ? `${effectiveAsset.hotspotX}, ${effectiveAsset.hotspotY} · ${effectiveAsset.size}px` : "未绑定图片"}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">模式切换</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["源", "继承", "覆盖"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateCursorMode(mode)}
                      className={cn("rounded-full px-4 py-2.5 text-sm ring-1 transition-colors", currentMode === mode ? "bg-emerald-700 text-white ring-emerald-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="text-sm font-semibold text-slate-900">动作模板</div>
                <div className="mt-3">
                  <SmallSelect value={currentActionId} options={actionOptions} onChange={updateCursorStateAction} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">预览</div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff,#dbeafe)] shadow-sm">
                  {effectiveAsset.imageDataUrl ? (
                    <img
                      src={effectiveAsset.imageDataUrl}
                      alt={`${stateId} cursor preview`}
                      className="object-contain"
                      style={{ width: `${Math.min(effectiveAsset.size, 72)}px`, height: `${Math.min(effectiveAsset.size, 72)}px` }}
                    />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="font-medium text-slate-900">{effectiveAsset.imageDataUrl ? "已配置" : "未配置"}</div>
                  <div>热点：{effectiveAsset.hotspotX}, {effectiveAsset.hotspotY}</div>
                  <div>尺寸：{effectiveAsset.size}px</div>
                  <div>状态：{assetStatusLabel}</div>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="素材上传器">
          <input ref={fileInputRef} type="file" accept="image/png,image/webp,image/svg+xml" className="hidden" onChange={handleFileChange} />

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
              applyAssetFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "w-full rounded-[28px] border border-dashed px-5 py-5 text-left transition-colors",
              isDraggingAsset ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/60"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white text-emerald-700 shadow-sm">
                <Upload className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">上传图片或拖拽到这里</div>
                <div className="mt-1 text-sm text-slate-500">支持 PNG / WebP / SVG，建议 300 KB 以内。</div>
              </div>
            </div>
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-2xl px-4" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              选择图片
            </Button>
            <Button variant="ghost" className="rounded-2xl px-4" onClick={copyDefaultCursorStateAsset}>
              <Copy className="mr-2 h-4 w-4" />
              复制默认态
            </Button>
            <Button
              variant="ghost"
              className="rounded-2xl px-4"
              onClick={() => {
                updateCursorStateAsset({ imageDataUrl: "" });
                setAssetMessage("已清空当前状态图片。");
                setAssetMessageTone("slate");
              }}
            >
              清空图片
            </Button>
          </div>

          {assetMessage ? (
            <div
              className={cn(
                "mt-3 rounded-2xl px-3 py-2 text-sm",
                assetMessageTone === "rose"
                  ? "bg-rose-50 text-rose-700"
                  : assetMessageTone === "teal"
                    ? "bg-teal-50 text-teal-700"
                    : "bg-slate-100 text-slate-600"
              )}
            >
              {assetMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-900">内置样例</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {builtinPresetCards.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyBuiltinPreset(preset.asset, preset.label)}
                      className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff,#e2e8f0)]">
                        <img
                          src={preset.asset.imageDataUrl}
                          alt={`${preset.label} preview`}
                          className="object-contain"
                          style={{ width: `${Math.min(preset.asset.size, 40)}px`, height: `${Math.min(preset.asset.size, 40)}px` }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{preset.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{preset.hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">最近上传素材</div>
                {recentCursorAssets?.length ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {recentCursorAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          updateCursorStateAsset({
                            imageDataUrl: asset.imageDataUrl,
                            hotspotX: asset.hotspotX,
                            hotspotY: asset.hotspotY,
                            size: asset.size,
                          });
                          setAssetMessage(`已应用最近素材：${asset.name}。`);
                          setAssetMessageTone("teal");
                        }}
                        className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff,#e2e8f0)]">
                          <img
                            src={asset.imageDataUrl}
                            alt={`${asset.name} preview`}
                            className="object-contain"
                            style={{ width: `${Math.min(asset.size || 48, 40)}px`, height: `${Math.min(asset.size || 48, 40)}px` }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{asset.name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {asset.hotspotX}, {asset.hotspotY} · {asset.size}px
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    暂无最近素材。
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">预览与定位</div>
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff,#dbeafe)] shadow-sm">
                  {effectiveAsset.imageDataUrl ? (
                    <img
                      src={effectiveAsset.imageDataUrl}
                      alt={`${stateId} cursor preview`}
                      className="object-contain"
                      style={{ width: `${Math.min(effectiveAsset.size, 72)}px`, height: `${Math.min(effectiveAsset.size, 72)}px` }}
                    />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="font-medium text-slate-900">{effectiveAsset.imageDataUrl ? "已配置图片素材" : "等待上传或选择样例"}</div>
                  <div>热点：{effectiveAsset.hotspotX}, {effectiveAsset.hotspotY}</div>
                  <div>尺寸：{effectiveAsset.size}px</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-800">热点坐标</div>
                  <SmallSelect
                    value={hotspotValue}
                    options={CURSOR_HOTSPOT_OPTIONS}
                    onChange={(value) => {
                      const [hotspotX, hotspotY] = value.split(",").map((item) => Number.parseInt(item.trim(), 10));
                      updateCursorStateAsset({ hotspotX, hotspotY });
                    }}
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-800">尺寸</div>
                  <SmallSelect
                    value={sizeValue}
                    options={CURSOR_SIZE_OPTIONS}
                    onChange={(value) => updateCursorStateAsset({ size: Number.parseInt(value, 10) })}
                  />
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="继承关系摘要">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <DataPill tone={cursorModes.default === "源" ? "teal" : "amber"}>default {cursorModes.default} · {formatActionLabel(cursorStateActions?.default || "leftClick")}</DataPill>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            {CURSOR_STATES.filter((item) => item.id !== "default").map((item) => (
              <DataPill key={item.id} tone={cursorModes[item.id] === "覆盖" ? "amber" : "slate"}>
                {item.id} {cursorModes[item.id]} · {formatActionLabel(cursorModes[item.id] === "覆盖" ? (cursorStateActions?.[item.id] || "leftClick") : (cursorStateActions?.default || "leftClick"))}
              </DataPill>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
