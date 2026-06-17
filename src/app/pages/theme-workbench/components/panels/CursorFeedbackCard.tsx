import { Switch } from "@/components/ui/switch";
import {
  CURSOR_OVERRIDE_OPTIONS,
  PANEL_META,
} from "../../model/workbenchSchema";
import { ColorOptions, ControlSlider, FieldRow, Panel, SectionTitle, SettingSection, SmallSelect } from "../WorkbenchControls";
import { ResetCardButton } from "./ResetCardButton";

export function CursorFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  return (
    <Panel
      id={panelId}
      title="光标与命中反馈"
      icon={PANEL_META.cursor.icon}
      iconTone={PANEL_META.cursor.tone}
      collapsible
      defaultOpen={config.cursorOverride !== "跟随当前状态" || config.shake > 0}
      summary={`${config.cursorOverride} · ${config.cursorSize}px · 抖动 ${config.shake}%`}
      action={reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : undefined}
    >
      <div className="space-y-4">
        <SettingSection>
          <SectionTitle>命中反馈</SectionTitle>
          <FieldRow
            label="敲击抖动"
            control={<ControlSlider value={config.shake} min={0} max={80} onValueChange={(value) => updateActionConfig({ shake: value[0] })} suffix="%" label="抖动强度" />}
          />
          <FieldRow
            label="动作光标"
            control={<SmallSelect value={config.cursorOverride} options={CURSOR_OVERRIDE_OPTIONS} onChange={(value) => updateActionConfig({ cursorOverride: value })} />}
          />
          <FieldRow
            label="光标尺寸"
            control={<ControlSlider value={config.cursorSize} min={32} max={72} onValueChange={(value) => updateActionConfig({ cursorSize: value[0] })} suffix="px" label="光标尺寸" />}
          />
        </SettingSection>

        <SettingSection>
          <SectionTitle>光标轨迹</SectionTitle>
          <FieldRow
            label="启用轨迹"
            tooltip="光标移动时留下光尾。"
            control={<Switch checked={config.cursorTrailEnabled || false} onCheckedChange={(next) => updateActionConfig({ cursorTrailEnabled: next })} aria-label="光标轨迹开关" />}
          />
          {config.cursorTrailEnabled ? (
            <>
              <FieldRow
                label="轨迹点数"
                control={<ControlSlider value={config.cursorTrailCount || 5} min={1} max={12} onValueChange={(value) => updateActionConfig({ cursorTrailCount: value[0] })} label="轨迹点数" />}
              />
              <FieldRow
                label="轨迹透明度"
                control={<ControlSlider value={config.cursorTrailOpacity || 50} min={20} max={100} onValueChange={(value) => updateActionConfig({ cursorTrailOpacity: value[0] })} suffix="%" label="轨迹透明度" />}
              />
            </>
          ) : null}
          <FieldRow
            label="光晕颜色"
            tooltip="光标光晕色，留空则无光晕。"
            control={<ColorOptions disabled={false} value={config.cursorGlowColor || ""} onChange={(color) => updateActionConfig({ cursorGlowColor: color })} />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
