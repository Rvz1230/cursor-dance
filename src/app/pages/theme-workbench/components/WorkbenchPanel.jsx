import { AlertTriangle } from "lucide-react";
import { cn } from "@/components/ui/utils.js";
import { CursorFeedbackCard } from "./panels/CursorFeedbackCard.jsx";
import { AudioFeedbackCard } from "./panels/AudioFeedbackCard.jsx";
import { ParticleFeedbackCard } from "./panels/ParticleFeedbackCard.jsx";
import { RippleFeedbackCard } from "./panels/RippleFeedbackCard.jsx";
import { TextFeedbackCard } from "./panels/TextFeedbackCard.jsx";
import { TriggerBehaviorCard } from "./panels/TriggerBehaviorCard.jsx";

export function WorkbenchPanel({ actionId, config, updateActionConfig, conflicts }) {
  return (
    <div className="space-y-3">
      {conflicts.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
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

      <div className="space-y-3">
        <TriggerBehaviorCard actionId={actionId} config={config} updateActionConfig={updateActionConfig} />
        <TextFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <ParticleFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <RippleFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <AudioFeedbackCard config={config} updateActionConfig={updateActionConfig} />
        <CursorFeedbackCard config={config} updateActionConfig={updateActionConfig} />
      </div>
    </div>
  );
}
