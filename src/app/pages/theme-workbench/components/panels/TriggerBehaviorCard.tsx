import { TRIGGER_OPTIONS, PANEL_META } from "../../model/workbenchSchema";
import { FieldRow } from "@/components/ui/field-row";
import { Select } from "@/components/ui/select";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

export function TriggerBehaviorCard({ actionId, config, updateActionConfig, panelId, reset }) {
  const triggerMeta = TRIGGER_OPTIONS[actionId];
  return (
    <WorkbenchEffectCard
      id={panelId}
      cardKey="trigger"
      title="触发行为"
      icon={PANEL_META.trigger.icon}
      always
      config={config}
      baseline={reset?.baseline}
      settingCount={1}
      presets={[
        { name: "即时", patch: { triggerTiming: triggerMeta.timing[0], holdMs: 0 } },
        { name: "蓄力", patch: { triggerTiming: triggerMeta.timing.at(-1), holdMs: actionId === "longPress" ? 420 : 320 } },
        { name: "节流", patch: { triggerTiming: triggerMeta.timing[0], holdMs: actionId === "wheel" ? 80 : 60 } },
      ]}
      onChange={updateActionConfig}
      onReset={reset?.onReset}
    >
      <FieldRow
        label="触发区域"
        control={<Select className="h-8 px-2 text-xs" value={config.triggerZone} options={triggerMeta.zones} onChange={(value) => updateActionConfig({ triggerZone: value })} />}
      />
    </WorkbenchEffectCard>
  );
}
