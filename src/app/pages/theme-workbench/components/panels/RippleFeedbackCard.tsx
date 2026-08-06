import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { Panel } from "@/components/ui/panel";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import {
  PANEL_META,
  RIPPLE_EASING_OPTIONS,
  RIPPLE_STYLE_OPTIONS,
} from "../../model/workbenchSchema";
import { WorkbenchSettingSection } from "../WorkbenchSettingSection";
import { ResetCardButton } from "./ResetCardButton";

export function RippleFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  return (
    <Panel
      id={panelId}
      title="波纹反馈"
      icon={PANEL_META.ripple.icon}
      collapsible
      defaultOpen={config.ripple}
      enabled={config.ripple}
      summary={config.ripple ? `${config.rippleStyle} · ${config.rippleSize}px · ${config.rippleDuration}ms` : "关闭波纹反馈"}
      action={
        <div className="flex items-center gap-2">
          {reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : null}
          <Switch checked={config.ripple} onCheckedChange={(next) => updateActionConfig({ ripple: next })} aria-label="波纹开关" />
        </div>
      }
    >
      <div className="space-y-4">
        <WorkbenchSettingSection disabled={!config.ripple}>
          <SectionTitle>形态</SectionTitle>
          <FieldRow
            label="波纹样式"
            control={<Select value={config.rippleStyle} options={RIPPLE_STYLE_OPTIONS} onChange={config.ripple ? (value) => updateActionConfig({ rippleStyle: value, ripple: true }) : undefined} />}
          />
          <FieldRow
            label="波纹颜色"
            control={<ColorField label="波纹颜色" disabled={!config.ripple} value={config.rippleColor || "#34D399"} onChange={(color) => updateActionConfig({ rippleColor: color })} />}
          />
          <FieldRow
            label="波纹尺寸"
            control={<Slider disabled={!config.ripple} value={config.rippleSize} min={20} max={110} onChange={(value) => updateActionConfig({ rippleSize: value })} suffix="px" label="波纹尺寸" />}
          />
          <FieldRow
            label="线条粗细"
            control={<Slider disabled={!config.ripple} value={config.rippleLineWidth} min={1} max={6} onChange={(value) => updateActionConfig({ rippleLineWidth: value })} suffix="px" label="线条粗细" />}
          />
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.ripple}>
          <SectionTitle>消退</SectionTitle>
          <FieldRow
            label="波纹时长"
            control={<Slider disabled={!config.ripple} value={config.rippleDuration} min={300} max={1200} onChange={(value) => updateActionConfig({ rippleDuration: value })} suffix="ms" label="波纹时长" />}
          />
          <FieldRow
            label="缓动效果"
            control={<Select value={config.rippleEasing} options={RIPPLE_EASING_OPTIONS} onChange={config.ripple ? (value) => updateActionConfig({ rippleEasing: value }) : undefined} />}
          />
          <FieldRow
            label="透明度"
            control={<Slider disabled={!config.ripple} value={config.rippleOpacity} min={20} max={100} onChange={(value) => updateActionConfig({ rippleOpacity: value })} suffix="%" label="透明度" />}
          />
        </WorkbenchSettingSection>
      </div>
    </Panel>
  );
}
