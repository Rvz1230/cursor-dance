import { useMemo } from "react";
import { MousePointerClick } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { PREVIEW_KEYFRAMES } from "../lib/preview";
import {
  PANEL_META,
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/workbenchSchema";
import { PreviewPlaybackControls } from "./preview-rail/PreviewPlaybackControls";
import { PreviewStage } from "./preview-rail/PreviewStage";
import { usePreviewPlayback } from "./preview-rail/usePreviewPlayback";

function buildOutputTags({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }) {
  const tags = [];
  if (textConfig.textEnabled) tags.push({ id: "card-text", label: "飘字", icon: PANEL_META.text.icon });
  if (rippleConfig.ripple) tags.push({ id: "card-ripple", label: "波纹", icon: PANEL_META.ripple.icon });
  if (particleConfig.particle) tags.push({ id: "card-particle", label: "粒子", icon: PANEL_META.particles.icon });
  if (audioConfig.sound) tags.push({ id: "card-audio", label: "音效", icon: PANEL_META.audio.icon });
  if (animationConfig.animationEnabled) tags.push({ id: "card-animation", label: "动画", icon: PANEL_META.animation.icon });
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) tags.push({ id: "card-image", label: "贴纸", icon: PANEL_META.image.icon });
  if (config.cursorOverride && config.cursorOverride !== "跟随当前状态") tags.push({ id: "card-cursor", label: "光标", icon: PANEL_META.cursor.icon });
  return tags;
}

export function WorkbenchPreviewRail({ actionId = "leftClick", config, actionConfigsMap, disabled = false, previewMode = false, updateActionConfig, atmosphere }) {
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);
  const outputs = useMemo(
    () => buildOutputTags({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }),
    [textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config]
  );
  const comboWindowMs = typeof textConfig.comboWindowMs === "number" ? textConfig.comboWindowMs : 900;
  const {
    runId,
    comboIndex,
    autoPlay,
    triggerInterval,
    replay,
    toggleAutoPlay,
    setTriggerInterval,
  } = usePreviewPlayback({
    actionId,
    config,
    comboEnabled: textConfig.comboEnabled === true,
    comboWindowMs,
    disabled,
  });

  return (
    <div className="min-h-0 flex-1">
      <style>{PREVIEW_KEYFRAMES}</style>
      <Panel
        title="实时预览"
        icon={MousePointerClick}
        className="flex h-full min-h-0 flex-col shadow-sm"
        contentClassName="flex min-h-0 flex-1 flex-col"
        summary={previewMode ? "正在预览 AI 建议" : undefined}
        action={
          <PreviewPlaybackControls
            autoPlay={autoPlay}
            disabled={disabled}
            triggerInterval={triggerInterval}
            onReplay={replay}
            onToggleAutoPlay={toggleAutoPlay}
            onTriggerIntervalChange={setTriggerInterval}
          />
        }
      >
        <PreviewStage config={config} disabled={disabled} runId={runId} comboIndex={comboIndex} actionId={actionId} actionConfigsMap={actionConfigsMap} outputs={outputs} triggerInterval={triggerInterval} previewMode={previewMode} updateActionConfig={updateActionConfig} atmosphere={atmosphere} />
      </Panel>
    </div>
  );
}
