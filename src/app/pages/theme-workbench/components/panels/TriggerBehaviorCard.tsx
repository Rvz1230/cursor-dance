import { getTimingFieldMeta, TRIGGER_OPTIONS, PANEL_META } from "../../model/workbenchSchema";
import { ControlSlider, FieldRow, Panel, SmallSelect } from "../WorkbenchControls";

export function TriggerBehaviorCard({ actionId, config, updateActionConfig, panelId }) {
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
