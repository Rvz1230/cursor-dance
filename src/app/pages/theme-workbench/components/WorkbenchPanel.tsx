import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { getCursorTrailConfig } from "@/shared/config/cursor-trail";
import { CARD_RESET_FIELDS, buildCardResetPatch } from "../lib/cardResetFields";
import { AnimationFeedbackCard } from "./panels/AnimationFeedbackCard";
import { CursorFeedbackCard } from "./panels/CursorFeedbackCard";
import { AudioFeedbackCard } from "./panels/AudioFeedbackCard";
import { ImageFeedbackCard } from "./panels/ImageFeedbackCard";
import { ParticleFeedbackCard } from "./panels/ParticleFeedbackCard";
import { RippleFeedbackCard } from "./panels/RippleFeedbackCard";
import { TextFeedbackCard } from "./panels/TextFeedbackCard";
import { TriggerBehaviorCard } from "./panels/TriggerBehaviorCard";
import { CursorTrailCard } from "./panels/CursorTrailCard";

interface WorkbenchPanelProps {
  actionId: string;
  config: Record<string, unknown>;
  resetConfig?: Record<string, unknown>;
  updateActionConfig(patch: Record<string, unknown>): void;
  conflicts: string[];
  atmosphere?: Record<string, unknown>;
  updateAtmosphere(patch: Record<string, unknown>): void | (() => void);
  accessibilityAuthorized?: boolean | null;
  onRequestAccessibility?(): void;
}

export function WorkbenchPanel({
  actionId,
  config,
  resetConfig,
  updateActionConfig,
  conflicts,
  atmosphere,
  updateAtmosphere,
  accessibilityAuthorized = null,
  onRequestAccessibility,
}: WorkbenchPanelProps) {
  const defaultConfig = resetConfig || {};
  const trailEnabled = atmosphere ? getCursorTrailConfig(atmosphere).enabled : false;

  const buildResetProps = (cardKey: keyof typeof CARD_RESET_FIELDS) => {
    const patch = buildCardResetPatch(cardKey, config, defaultConfig);
    return {
      dirty: patch !== null,
      baseline: defaultConfig,
      onReset: () => {
        if (patch) updateActionConfig(patch);
      },
    };
  };

  return (
    <div className="space-y-2">
      {conflicts.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-semibold">当前动作有 {conflicts.length} 个待明确项</div>
              <ul className={cn("mt-2 list-disc space-y-1 pl-4")}>
                {conflicts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {atmosphere ? (
        <div className="space-y-2 pb-1">
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="text-xs font-medium text-slate-700">持续效果</div>
              <div className="text-2xs text-slate-500">属于当前主题，不随上方动作页签切换</div>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">当前主题</span>
          </div>
          {trailEnabled && accessibilityAuthorized === false ? (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold">拖尾已保存，但桌面暂时收不到鼠标移动</div>
                  <p className="mt-0.5 leading-5 text-amber-800">授予 macOS“辅助功能”权限后会立即生效，无需重新保存。</p>
                  {onRequestAccessibility ? (
                    <button type="button" onClick={onRequestAccessibility} className="mt-1 font-medium underline underline-offset-2 hover:text-amber-700">
                      授予辅助功能权限
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <CursorTrailCard atmosphere={atmosphere} onChange={updateAtmosphere} />
        </div>
      ) : null}

      <div className="space-y-2 border-t border-slate-200 pt-2">
        <div className="px-1 text-xs font-medium text-slate-700">当前动作效果</div>
        <TriggerBehaviorCard actionId={actionId} config={config} updateActionConfig={updateActionConfig} panelId="card-trigger" reset={buildResetProps("trigger")} />
        <TextFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-text" reset={buildResetProps("text")} />
        <AnimationFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-animation" reset={buildResetProps("animation")} />
        <ImageFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-image" reset={buildResetProps("image")} />
        <ParticleFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-particle" reset={buildResetProps("particle")} />
        <RippleFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-ripple" reset={buildResetProps("ripple")} />
        <AudioFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-audio" reset={buildResetProps("audio")} />
        <CursorFeedbackCard config={config} updateActionConfig={updateActionConfig} panelId="card-cursor" reset={buildResetProps("cursor")} />
      </div>

    </div>
  );
}
