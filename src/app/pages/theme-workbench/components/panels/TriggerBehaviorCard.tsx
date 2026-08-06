import { getTimingFieldMeta, TRIGGER_OPTIONS, PANEL_META } from "../../model/workbenchSchema";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { Select } from "@/components/ui/select";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

export function TriggerBehaviorCard({ actionId, config, updateActionConfig, panelId, reset }) {
  const triggerMeta = TRIGGER_OPTIONS[actionId];
  const timingMeta = getTimingFieldMeta(actionId);

  return (
    <WorkbenchEffectCard
      id={panelId}
      cardKey="trigger"
      title="触发行为"
      icon={PANEL_META.trigger.icon}
      always
      config={config}
      baseline={reset?.baseline}
      presets={[
        { name: "按下", patch: { triggerTiming: triggerMeta.timing[0], holdMs: 0 } },
        { name: "抬起", patch: { triggerTiming: triggerMeta.timing[1] || triggerMeta.timing[0], holdMs: 0 } },
        { name: "蓄力", patch: { triggerTiming: triggerMeta.timing.at(-1), holdMs: Math.max(320, timingMeta.min) } },
      ]}
      onChange={updateActionConfig}
      onReset={reset?.onReset}
    >
      <FieldRow
        label="触发时机"
        control={<Select value={config.triggerTiming} options={triggerMeta.timing} onChange={(value) => updateActionConfig({ triggerTiming: value })} />}
      />
      <FieldRow
        label="作用范围"
        control={<Select value={config.triggerZone} options={triggerMeta.zones} onChange={(value) => updateActionConfig({ triggerZone: value })} />}
      />
      <FieldRow
        label={timingMeta.label}
        tooltip={timingMeta.hint}
        control={<Slider value={config.holdMs} min={timingMeta.min} max={timingMeta.max} onChange={(value) => updateActionConfig({ holdMs: value })} suffix="ms" label={timingMeta.label} />}
      />
    </WorkbenchEffectCard>
  );
}
