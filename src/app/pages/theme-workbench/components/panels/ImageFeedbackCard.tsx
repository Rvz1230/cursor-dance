import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  PANEL_META,
} from "../../model/workbenchSchema";
import { getImageEffectPresetCards, validateImageEffectFile } from "../../lib/imageEffectAssets";
import {
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
} from "../WorkbenchControls";
import { ResetCardButton } from "./ResetCardButton";

const MAX_IMAGE_EFFECT_UPLOAD_BYTES = 300 * 1024;

function buildImagePreviewStyle(config): CSSProperties {
  return {
    width: `${Math.min(config.imageSize || 56, 72)}px`,
    height: `${Math.min(config.imageSize || 56, 72)}px`,
    objectFit: "contain",
    opacity: Math.max(0.2, (config.imageOpacity || 100) / 100),
  };
}

export function ImageFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  const fileInputRef = useRef(null);
  const [assetMessage, setAssetMessage] = useState("");
  const [assetTone, setAssetTone] = useState("slate");
  const presetCards = getImageEffectPresetCards();

  function updateImageAsset(patch) {
    updateActionConfig({
      ...patch,
      imageEnabled: patch.imageDataUrl ? true : (patch.imageEnabled ?? config.imageEnabled),
    });
  }

  function applyFile(file) {
    const validationMessage = validateImageEffectFile(file, MAX_IMAGE_EFFECT_UPLOAD_BYTES);
    if (validationMessage) {
      setAssetTone("rose");
      setAssetMessage(validationMessage);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      updateImageAsset({ imageDataUrl: reader.result, imageEnabled: true });
      setAssetTone("teal");
      setAssetMessage(`已载入 ${file.name}。`);
    };
    reader.readAsDataURL(file);
  }

  return (
    <Panel
      id={panelId}
      title="图片贴纸反馈"
      icon={PANEL_META.image.icon}
      iconTone={PANEL_META.image.tone}
      collapsible
      defaultOpen={config.imageEnabled}
      enabled={config.imageEnabled}
      summary={config.imageEnabled ? `${config.imageSize}px · ${config.imageOpacity}%` : "关闭图片贴纸"}
      action={
        <div className="flex items-center gap-2">
          {reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : null}
          <Switch checked={config.imageEnabled} onCheckedChange={(next) => updateActionConfig({ imageEnabled: next })} aria-label="图片反馈开关" />
        </div>
      }
    >
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            applyFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <SettingSection disabled={!config.imageEnabled}>
          <SectionTitle>素材</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_172px]">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-left transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-700">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-600 text-balance">上传 PNG / WebP / SVG</div>
                    <div className="mt-1 text-xs text-slate-500">建议 300 KB 以内，先做一张点击贴纸。</div>
                  </div>
                </div>
              </button>

              <div className="grid gap-3 md:grid-cols-2">
                {presetCards.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      updateImageAsset({ imageDataUrl: preset.asset.imageDataUrl, imageEnabled: true });
                      setAssetTone("teal");
                      setAssetMessage(`已应用${preset.label}。`);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-purple-50">
                      <img src={preset.asset.imageDataUrl} alt={`${preset.label} preview`} className="object-contain" style={{ width: "40px", height: "40px" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-600 text-balance">{preset.label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{preset.hint}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="rounded-2xl px-4" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  选择图片
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-2xl px-4"
                  onClick={() => {
                    updateActionConfig({ imageDataUrl: "", imageEnabled: false });
                    setAssetTone("slate");
                    setAssetMessage("已清空图片贴纸。");
                  }}
                >
                  清空图片
                </Button>
              </div>

              {assetMessage ? (
                <div
                  className={
                    assetTone === "rose"
                      ? "rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
                      : assetTone === "teal"
                        ? "rounded-2xl bg-teal-50 px-3 py-2 text-sm text-teal-700"
                        : "rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  }
                >
                  {assetMessage}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs font-medium text-slate-600 text-balance">当前预览</div>
              <div className="mt-4 flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-purple-50 shadow-sm">
                {config.imageDataUrl ? (
                  <img src={config.imageDataUrl} alt="image effect preview" style={buildImagePreviewStyle(config)} />
                ) : (
                  <ImagePlus className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {config.imageDataUrl ? "当前贴纸会跟随动作一起预览、保存和运行。" : "先上传一张图片，或直接套用内置样例。"}
              </div>
            </div>
          </div>
        </SettingSection>

        <SettingSection disabled={!config.imageEnabled}>
          <SectionTitle>动画</SectionTitle>
          <FieldRow
            label="持续时间"
            control={<ControlSlider disabled={!config.imageEnabled} value={config.imageDuration} min={240} max={1600} onValueChange={(value) => updateActionConfig({ imageDuration: value[0] })} suffix="ms" label="持续时间" />}
          />
          <FieldRow
            label="水平偏移"
            control={<ControlSlider disabled={!config.imageEnabled} value={config.imageOffsetX} min={-36} max={36} onValueChange={(value) => updateActionConfig({ imageOffsetX: value[0] })} suffix="px" label="水平偏移" />}
          />
          <FieldRow
            label="垂直偏移"
            control={<ControlSlider disabled={!config.imageEnabled} value={config.imageOffsetY} min={-48} max={24} onValueChange={(value) => updateActionConfig({ imageOffsetY: value[0] })} suffix="px" label="垂直偏移" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.imageEnabled}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="贴纸尺寸"
            control={<ControlSlider disabled={!config.imageEnabled} value={config.imageSize} min={24} max={120} onValueChange={(value) => updateActionConfig({ imageSize: value[0] })} suffix="px" label="贴纸尺寸" />}
          />
          <FieldRow
            label="透明度"
            control={<ControlSlider disabled={!config.imageEnabled} value={config.imageOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ imageOpacity: value[0] })} suffix="%" label="透明度" />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
