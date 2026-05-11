import { getTimingFieldMeta, TRIGGER_OPTIONS, PANEL_META } from "../../model/workbenchSchema.js";
import { ControlSlider, FieldRow, Panel, SmallSelect } from "../WorkbenchControls.jsx";

export function TriggerBehaviorCard({ actionId, config, updateActionConfig }) {
  const triggerMeta = TRIGGER_OPTIONS[actionId];
  const timingMeta = getTimingFieldMeta(actionId);

  return (
    <Panel title="触发行为" icon={PANEL_META.trigger.icon} iconTone={PANEL_META.trigger.tone}>
      <FieldRow
        label="触发时机"
        hint="触发节点。"
        control={<SmallSelect value={config.triggerTiming} options={triggerMeta.timing} onChange={(value) => updateActionConfig({ triggerTiming: value })} />}
      />
      <FieldRow
        label="作用范围"
        hint="监听目标。"
        control={<SmallSelect value={config.triggerZone} options={triggerMeta.zones} onChange={(value) => updateActionConfig({ triggerZone: value })} />}
      />
      <FieldRow
        label={timingMeta.label}
        hint={timingMeta.hint}
        control={<ControlSlider value={config.holdMs} min={timingMeta.min} max={timingMeta.max} onValueChange={(value) => updateActionConfig({ holdMs: value[0] })} suffix="ms" width="w-16" />}
      />
    </Panel>
  );
}
