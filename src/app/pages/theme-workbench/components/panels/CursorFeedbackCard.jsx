import {
  CURSOR_OVERRIDE_OPTIONS,
  PANEL_META,
} from "../../model/workbenchSchema.js";
import { ControlSlider, FieldRow, Panel, SmallSelect } from "../WorkbenchControls.jsx";

export function CursorFeedbackCard({ config, updateActionConfig }) {
  return (
    <Panel title="光标与命中反馈" icon={PANEL_META.cursor.icon} iconTone={PANEL_META.cursor.tone}>
      <FieldRow
        label="敲击抖动"
        hint="抖动强度。"
        control={<ControlSlider value={config.shake} min={0} max={80} onValueChange={(value) => updateActionConfig({ shake: value[0] })} suffix="%" />}
      />
      <FieldRow
        label="动作光标"
        hint="触发时的临时光标。"
        control={<SmallSelect value={config.cursorOverride} options={CURSOR_OVERRIDE_OPTIONS} onChange={(value) => updateActionConfig({ cursorOverride: value })} />}
      />
      <FieldRow
        label="光标尺寸"
        hint="尺寸。"
        control={<ControlSlider value={config.cursorSize} min={32} max={72} onValueChange={(value) => updateActionConfig({ cursorSize: value[0] })} suffix="px" />}
      />
    </Panel>
  );
}
