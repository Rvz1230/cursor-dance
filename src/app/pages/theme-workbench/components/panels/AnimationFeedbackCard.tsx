import { Switch } from "@/components/ui/switch";
import { ColorOptions } from "@/components/ui/color-options";
import { ControlSlider } from "@/components/ui/control-slider";
import { FieldRow } from "@/components/ui/field-row";
import { Panel } from "@/components/ui/panel";
import { SectionTitle } from "@/components/ui/section-title";
import { SmallSelect } from "@/components/ui/small-select";
import {
  ANIMATION_EASING_OPTIONS,
  ANIMATION_STYLE_OPTIONS,
  PANEL_META,
} from "../../model/workbenchSchema";
import {
  SettingSection,
} from "../WorkbenchControls";
import { ResetCardButton } from "./ResetCardButton";

export function AnimationFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  return (
    <Panel
      id={panelId}
      title="基础动画反馈"
      icon={PANEL_META.animation.icon}
      collapsible
      defaultOpen={config.animationEnabled}
      enabled={config.animationEnabled}
      summary={config.animationEnabled ? `${config.animationStyle} · ${config.animationDuration}ms · ${config.animationEasing}` : "关闭基础动画"}
      action={
        <div className="flex items-center gap-2">
          {reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : null}
          <Switch checked={config.animationEnabled} onCheckedChange={(next) => updateActionConfig({ animationEnabled: next })} aria-label="动画反馈开关" />
        </div>
      }
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.animationEnabled}>
          <SectionTitle>形态</SectionTitle>
          <FieldRow
            label="动画样式"
            control={<SmallSelect value={config.animationStyle} options={ANIMATION_STYLE_OPTIONS} onChange={config.animationEnabled ? (value) => updateActionConfig({ animationStyle: value, animationEnabled: true }) : undefined} />}
          />
          <FieldRow
            label="动画颜色"
            control={<ColorOptions disabled={!config.animationEnabled} value={config.animationColor || "#34D399"} onChange={(color) => updateActionConfig({ animationColor: color })} />}
          />
          <FieldRow
            label="光晕效果"
            control={<Switch checked={config.animationGlow || false} disabled={!config.animationEnabled} onCheckedChange={(next) => updateActionConfig({ animationGlow: next })} aria-label="光晕开关" />}
          />
          <FieldRow
            label="动画时长"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationDuration} min={240} max={1400} onValueChange={(value) => updateActionConfig({ animationDuration: value[0] })} suffix="ms" label="动画时长" />}
          />
          <FieldRow
            label="缓动曲线"
            tooltip="动画的加减速节奏。"
            control={<SmallSelect value={config.animationEasing} options={ANIMATION_EASING_OPTIONS} onChange={config.animationEnabled ? (value) => updateActionConfig({ animationEasing: value, animationEnabled: true }) : undefined} />}
          />
        </SettingSection>

        <SettingSection disabled={!config.animationEnabled}>
          <SectionTitle>位置</SectionTitle>
          <FieldRow
            label="水平偏移"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationOffsetX} min={-36} max={36} onValueChange={(value) => updateActionConfig({ animationOffsetX: value[0] })} suffix="px" label="水平偏移" />}
          />
          <FieldRow
            label="垂直偏移"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationOffsetY} min={-48} max={24} onValueChange={(value) => updateActionConfig({ animationOffsetY: value[0] })} suffix="px" label="垂直偏移" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.animationEnabled}>
          <SectionTitle>强度</SectionTitle>
          <FieldRow
            label="缩放强度"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationScale} min={60} max={160} onValueChange={(value) => updateActionConfig({ animationScale: value[0] })} suffix="%" label="缩放强度" />}
          />
          <FieldRow
            label="透明度"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ animationOpacity: value[0] })} suffix="%" label="透明度" />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
