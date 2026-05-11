import { Switch } from "@/components/ui/switch.jsx";
import {
  PANEL_META,
  RIPPLE_EASING_OPTIONS,
  RIPPLE_STYLE_OPTIONS,
} from "../../model/workbenchSchema.js";
import {
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
  SmallSelect,
} from "../WorkbenchControls.jsx";

export function RippleFeedbackCard({ config, updateActionConfig }) {
  return (
    <Panel
      title="波纹反馈"
      icon={PANEL_META.particles.icon}
      iconTone="bg-emerald-100 text-emerald-700"
      action={<Switch checked={config.ripple} onCheckedChange={(next) => updateActionConfig({ ripple: next })} aria-label="波纹开关" />}
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.ripple}>
          <SectionTitle>形态</SectionTitle>
          <FieldRow
            label="波纹样式"
            hint="样式。"
            control={<SmallSelect value={config.rippleStyle} options={RIPPLE_STYLE_OPTIONS} onChange={config.ripple ? (value) => updateActionConfig({ rippleStyle: value, ripple: true }) : undefined} />}
          />
          <FieldRow
            label="波纹尺寸"
            hint="尺寸。"
            control={<ControlSlider disabled={!config.ripple} value={config.rippleSize} min={20} max={110} onValueChange={(value) => updateActionConfig({ rippleSize: value[0] })} suffix="px" />}
          />
          <FieldRow
            label="线条粗细"
            hint="粗细。"
            control={<ControlSlider disabled={!config.ripple} value={config.rippleLineWidth} min={1} max={6} onValueChange={(value) => updateActionConfig({ rippleLineWidth: value[0] })} suffix="px" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.ripple}>
          <SectionTitle>消退</SectionTitle>
          <FieldRow
            label="波纹时长"
            hint="时长。"
            control={<ControlSlider disabled={!config.ripple} value={config.rippleDuration} min={300} max={1200} onValueChange={(value) => updateActionConfig({ rippleDuration: value[0] })} suffix="ms" width="w-16" />}
          />
          <FieldRow
            label="缓动效果"
            hint="节奏。"
            control={<SmallSelect value={config.rippleEasing} options={RIPPLE_EASING_OPTIONS} onChange={config.ripple ? (value) => updateActionConfig({ rippleEasing: value }) : undefined} />}
          />
          <FieldRow
            label="透明度"
            hint="透明度。"
            control={<ControlSlider disabled={!config.ripple} value={config.rippleOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ rippleOpacity: value[0] })} suffix="%" />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
