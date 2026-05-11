import { Switch } from "@/components/ui/switch.jsx";
import {
  PANEL_META,
  PARTICLE_COLOR_MODE_OPTIONS,
  PARTICLE_DIRECTION_OPTIONS,
  PARTICLE_STYLE_OPTIONS,
} from "../../model/workbenchSchema.js";
import {
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
  SmallSelect,
} from "../WorkbenchControls.jsx";

export function ParticleFeedbackCard({ config, updateActionConfig }) {
  return (
    <Panel
      title="粒子反馈"
      icon={PANEL_META.particles.icon}
      iconTone={PANEL_META.particles.tone}
      action={<Switch checked={config.particle} onCheckedChange={(next) => updateActionConfig({ particle: next })} aria-label="粒子开关" />}
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.particle}>
          <SectionTitle>发射</SectionTitle>
          <FieldRow
            label="粒子形态"
            hint="形态。"
            control={<SmallSelect value={config.particleStyle} options={PARTICLE_STYLE_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleStyle: value, particle: true }) : undefined} />}
          />
          <FieldRow
            label="粒子数量"
            hint="数量。"
            control={<ControlSlider disabled={!config.particle} value={config.particleCount} min={0} max={40} onValueChange={(value) => updateActionConfig({ particleCount: value[0], particle: value[0] > 0 })} />}
          />
          <FieldRow
            label="扩散范围"
            hint="范围。"
            control={<ControlSlider disabled={!config.particle} value={config.particleSpread} min={0} max={90} onValueChange={(value) => updateActionConfig({ particleSpread: value[0] })} />}
          />
          <FieldRow
            label="扩散方向"
            hint="方向。"
            control={<SmallSelect value={config.particleDirection} options={PARTICLE_DIRECTION_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleDirection: value, particle: true }) : undefined} />}
          />
        </SettingSection>

        <SettingSection disabled={!config.particle}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="粒子尺寸"
            hint="尺寸。"
            control={<ControlSlider disabled={!config.particle} value={config.particleSize} min={6} max={24} onValueChange={(value) => updateActionConfig({ particleSize: value[0] })} suffix="px" />}
          />
          <FieldRow
            label="持续时间"
            hint="时长。"
            control={<ControlSlider disabled={!config.particle} value={config.particleDuration} min={240} max={1200} onValueChange={(value) => updateActionConfig({ particleDuration: value[0] })} suffix="ms" width="w-16" />}
          />
          <FieldRow
            label="透明度"
            hint="透明度。"
            control={<ControlSlider disabled={!config.particle} value={config.particleOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ particleOpacity: value[0] })} suffix="%" />}
          />
          <FieldRow
            label="颜色策略"
            hint="颜色来源。"
            control={<SmallSelect value={config.particleColorMode} options={PARTICLE_COLOR_MODE_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleColorMode: value }) : undefined} />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
