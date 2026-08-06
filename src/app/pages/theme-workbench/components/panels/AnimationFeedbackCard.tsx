import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import {
  ANIMATION_EASING_OPTIONS,
  ANIMATION_STYLE_OPTIONS,
  PANEL_META,
} from "../../model/workbenchSchema";
import { WorkbenchSettingSection } from "../WorkbenchSettingSection";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

export function AnimationFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  return (
    <WorkbenchEffectCard
      id={panelId}
      cardKey="animation"
      title="基础动画反馈"
      icon={PANEL_META.animation.icon}
      enabled={config.animationEnabled}
      config={config}
      baseline={reset?.baseline}
      onChange={(patch) => updateActionConfig({ ...patch, animationEnabled: true })}
      onToggle={(next) => updateActionConfig({ animationEnabled: next })}
      onReset={reset?.onReset}
      primary={(
        <>
          <FieldRow label="动画样式" control={<Select value={config.animationStyle} options={ANIMATION_STYLE_OPTIONS} onChange={(value) => updateActionConfig({ animationStyle: value, animationEnabled: true })} />} />
          <FieldRow label="动画颜色" control={<ColorField label="动画颜色" value={config.animationColor || "#34D399"} onChange={(color) => updateActionConfig({ animationColor: color })} />} />
          <FieldRow label="动画时长" control={<Slider value={config.animationDuration} min={240} max={1400} onChange={(value) => updateActionConfig({ animationDuration: value })} suffix="ms" label="动画时长" />} />
        </>
      )}
    >
      <div className="space-y-4">
        <WorkbenchSettingSection disabled={!config.animationEnabled}>
          <SectionTitle>形态</SectionTitle>
          <FieldRow
            label="光晕效果"
            control={<Switch checked={config.animationGlow || false} disabled={!config.animationEnabled} onCheckedChange={(next) => updateActionConfig({ animationGlow: next })} aria-label="光晕开关" />}
          />
          <FieldRow
            label="缓动曲线"
            tooltip="动画的加减速节奏。"
            control={<Select value={config.animationEasing} options={ANIMATION_EASING_OPTIONS} onChange={config.animationEnabled ? (value) => updateActionConfig({ animationEasing: value, animationEnabled: true }) : undefined} />}
          />
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.animationEnabled}>
          <SectionTitle>位置</SectionTitle>
          <FieldRow
            label="水平偏移"
            control={<Slider disabled={!config.animationEnabled} value={config.animationOffsetX} min={-36} max={36} onChange={(value) => updateActionConfig({ animationOffsetX: value })} suffix="px" label="水平偏移" />}
          />
          <FieldRow
            label="垂直偏移"
            control={<Slider disabled={!config.animationEnabled} value={config.animationOffsetY} min={-48} max={24} onChange={(value) => updateActionConfig({ animationOffsetY: value })} suffix="px" label="垂直偏移" />}
          />
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.animationEnabled}>
          <SectionTitle>强度</SectionTitle>
          <FieldRow
            label="缩放强度"
            control={<Slider disabled={!config.animationEnabled} value={config.animationScale} min={60} max={160} onChange={(value) => updateActionConfig({ animationScale: value })} suffix="%" label="缩放强度" />}
          />
          <FieldRow
            label="透明度"
            control={<Slider disabled={!config.animationEnabled} value={config.animationOpacity} min={20} max={100} onChange={(value) => updateActionConfig({ animationOpacity: value })} suffix="%" label="透明度" />}
          />
        </WorkbenchSettingSection>
      </div>
    </WorkbenchEffectCard>
  );
}
