import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import {
  CURSOR_OVERRIDE_OPTIONS,
  PANEL_META,
} from "../../model/workbenchSchema";
import { WorkbenchSettingSection } from "../WorkbenchSettingSection";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

export function CursorFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  // 这张卡没有单一开关：改过光标或有抖动就算在起作用。
  const active = config.cursorOverride !== "跟随当前状态" || config.shake > 0;
  return (
    <WorkbenchEffectCard
      id={panelId}
      cardKey="cursor"
      title="光标与命中反馈"
      icon={PANEL_META.cursor.icon}
      enabled={active}
      config={config}
      baseline={reset?.baseline}
      onChange={updateActionConfig}
      onToggle={(next) => updateActionConfig(next ? { shake: Math.max(20, config.shake || 0) } : { shake: 0, cursorOverride: "跟随当前状态" })}
      onReset={reset?.onReset}
      primary={(
        <>
          <FieldRow label="敲击抖动" control={<Slider value={config.shake} min={0} max={80} onChange={(value) => updateActionConfig({ shake: value })} suffix="%" label="抖动强度" />} />
          <FieldRow label="动作光标" control={<Select value={config.cursorOverride} options={CURSOR_OVERRIDE_OPTIONS} onChange={(value) => updateActionConfig({ cursorOverride: value })} />} />
          <FieldRow label="光标尺寸" control={<Slider value={config.cursorSize} min={32} max={72} onChange={(value) => updateActionConfig({ cursorSize: value })} suffix="px" label="光标尺寸" />} />
        </>
      )}
    >
      <div className="space-y-4">
        <WorkbenchSettingSection>
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
                control={<Slider value={config.cursorTrailCount || 5} min={1} max={12} onChange={(value) => updateActionConfig({ cursorTrailCount: value })} label="轨迹点数" />}
              />
              <FieldRow
                label="轨迹透明度"
                control={<Slider value={config.cursorTrailOpacity || 50} min={20} max={100} onChange={(value) => updateActionConfig({ cursorTrailOpacity: value })} suffix="%" label="轨迹透明度" />}
              />
            </>
          ) : null}
          <FieldRow
            label="光晕颜色"
            tooltip="光标光晕色，留空则无光晕。"
            control={<ColorField label="光标光晕颜色" disabled={false} value={config.cursorGlowColor || ""} onChange={(color) => updateActionConfig({ cursorGlowColor: color })} />}
          />
        </WorkbenchSettingSection>
      </div>
    </WorkbenchEffectCard>
  );
}
