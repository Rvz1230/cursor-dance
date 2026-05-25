import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/components/ui/utils.js";
import { AnimationFeedbackCard } from "./panels/AnimationFeedbackCard.jsx";
import { CursorFeedbackCard } from "./panels/CursorFeedbackCard.jsx";
import { AudioFeedbackCard } from "./panels/AudioFeedbackCard.jsx";
import { ImageFeedbackCard } from "./panels/ImageFeedbackCard.jsx";
import { ParticleFeedbackCard } from "./panels/ParticleFeedbackCard.jsx";
import { RippleFeedbackCard } from "./panels/RippleFeedbackCard.jsx";
import { TextFeedbackCard } from "./panels/TextFeedbackCard.jsx";
import { TriggerBehaviorCard } from "./panels/TriggerBehaviorCard.jsx";

function hasAnyEffect(config) {
  return config.textEnabled || config.animationEnabled || config.imageEnabled || config.particle || config.ripple || config.sound || (config.cursorOverride && config.cursorOverride !== "跟随当前状态");
}

export function WorkbenchPanel({ actionId, config, updateActionConfig, conflicts }) {
  const anyEffect = hasAnyEffect(config);

  return (
    <div className="space-y-3">
      {conflicts.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-medium">当前动作有 {conflicts.length} 个待明确项</div>
              <ul className={cn("mt-2 list-disc space-y-1 pl-4")}>
                {conflicts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {!anyEffect && !conflicts.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
            <Sparkles className="size-6 text-slate-400" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 text-balance">还没有开启任何效果</h3>
          <p className="mt-1.5 max-w-[260px] mx-auto text-xs leading-5 text-slate-500 text-pretty">
            展开下方的效果卡片，打开飘字、粒子、波纹或音效中的至少一项，预览区域会实时展示反馈。
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <TriggerBehaviorCard actionId={actionId} config={config} updateActionConfig={updateActionConfig} />
        <TextFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <AnimationFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <ImageFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <ParticleFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <RippleFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <AudioFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <CursorFeedbackCard config={config} updateActionConfig={updateActionConfig} />
      </div>
    </div>
  );
}
