import { getTimingFieldMeta, TRIGGER_OPTIONS, PANEL_META } from "../../model/workbenchSchema";
import { ControlSlider } from "@/components/ui/control-slider";
import { FieldRow } from "@/components/ui/field-row";
import { Panel } from "@/components/ui/panel";
import { SmallSelect } from "@/components/ui/small-select";
import { ResetCardButton } from "./ResetCardButton";

export function TriggerBehaviorCard({ actionId, config, updateActionConfig, panelId, reset }) {
  const triggerMeta = TRIGGER_OPTIONS[actionId];
  const timingMeta = getTimingFieldMeta(actionId);

  return (
    <Panel
      id={panelId}
      title="触发行为"
      icon={PANEL_META.trigger.icon}
      iconTone={PANEL_META.trigger.tone}
      collapsible
      defaultOpen
      summary={`${config.triggerTiming} · ${config.triggerZone}`}
      action={reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : undefined}
    >
      <FieldRow
        label="触发时机"
        control={<SmallSelect value={config.triggerTiming} options={triggerMeta.timing} onChange={(value) => updateActionConfig({ triggerTiming: value })} />}
      />
      <FieldRow
        label="作用范围"
        control={<SmallSelect value={config.triggerZone} options={triggerMeta.zones} onChange={(value) => updateActionConfig({ triggerZone: value })} />}
      />
      <FieldRow
        label={timingMeta.label}
        tooltip={timingMeta.hint}
        control={<ControlSlider value={config.holdMs} min={timingMeta.min} max={timingMeta.max} onValueChange={(value) => updateActionConfig({ holdMs: value[0] })} suffix="ms" label={timingMeta.label} />}
      />
    </Panel>
  );
}
