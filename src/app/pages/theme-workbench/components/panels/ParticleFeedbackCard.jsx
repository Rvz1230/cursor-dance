import { Switch } from "@/components/ui/switch.jsx";
import { cn } from "@/components/ui/utils.js";
import {
  PANEL_META,
  PARTICLE_COLOR_MODE_OPTIONS,
  PARTICLE_DIRECTION_OPTIONS,
  PARTICLE_PALETTE_PRESETS,
  PARTICLE_PHYSICS_PRESET_OPTIONS,
  PARTICLE_PHYSICS_PRESET_VALUES,
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

function PaletteSwatches({ presets, value, onChange }) {
  const currentKey = Object.entries(presets).find(
    ([, colors]) => JSON.stringify(colors) === JSON.stringify(value)
  )?.[0] || null;

  return (
    <div className="space-y-1.5">
      {Object.entries(presets).map(([name, colors]) => {
        const isActive = name === currentKey;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange([...colors])}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50",
              isActive && "bg-slate-100"
            )}
          >
            <span className="text-xs text-slate-600 w-10 shrink-0">{name}</span>
            <div className="flex gap-1">
              {colors.map((color) => (
                <span
                  key={color}
                  className="size-4 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ParticleFeedbackCard({ config, updateActionConfig, panelId }) {
  return (
    <Panel
      id={panelId}
      title="粒子反馈"
      icon={PANEL_META.particles.icon}
      iconTone={PANEL_META.particles.tone}
      collapsible
      defaultOpen={config.particle}
      enabled={config.particle}
      summary={config.particle ? `${config.particleStyle} · ${config.particleCount} 个 · ${config.particleDirection}` : "关闭粒子反馈"}
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
            control={<ControlSlider disabled={!config.particle} value={config.particleCount} min={0} max={40} onValueChange={(value) => updateActionConfig({ particleCount: value[0], particle: value[0] > 0 })} label="粒子数量" />}
          />
          <FieldRow
            label="扩散范围"
            hint="范围。"
            control={<ControlSlider disabled={!config.particle} value={config.particleSpread} min={0} max={90} onValueChange={(value) => updateActionConfig({ particleSpread: value[0] })} label="扩散范围" />}
          />
          <FieldRow
            label="扩散方向"
            hint="方向。"
            control={<SmallSelect value={config.particleDirection} options={PARTICLE_DIRECTION_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleDirection: value, particle: true }) : undefined} />}
          />
          <FieldRow
            label="发射间隔"
            hint="每个粒子之间的发射延迟，0 表示同时发射。在「旋转扫射」模式下效果最明显。"
            control={<ControlSlider disabled={!config.particle} value={config.particleStagger ?? 26} min={0} max={100} onValueChange={(value) => updateActionConfig({ particleStagger: value[0] })} suffix="ms/个" label="发射间隔" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.particle}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="粒子尺寸"
            hint="尺寸。"
            control={<ControlSlider disabled={!config.particle} value={config.particleSize} min={6} max={24} onValueChange={(value) => updateActionConfig({ particleSize: value[0] })} suffix="px" label="粒子尺寸" />}
          />
          <FieldRow
            label="持续时间"
            hint="时长。"
            control={<ControlSlider disabled={!config.particle} value={config.particleDuration} min={240} max={1200} onValueChange={(value) => updateActionConfig({ particleDuration: value[0] })} suffix="ms" label="持续时间" />}
          />
          <FieldRow
            label="透明度"
            hint="透明度。"
            control={<ControlSlider disabled={!config.particle} value={config.particleOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ particleOpacity: value[0] })} suffix="%" label="透明度" />}
          />
          <FieldRow
            label="颜色策略"
            hint="颜色来源。"
            control={<SmallSelect value={config.particleColorMode} options={PARTICLE_COLOR_MODE_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleColorMode: value }) : undefined} />}
          />
          <FieldRow
            label="预设色板"
            hint={config.particleColorMode === "跟随飘字色" ? "当前模式不使用色板。" : "点击选择预设色板。修改后将自动切换为自定义色板。"}
            control={
              <PaletteSwatches
                presets={PARTICLE_PALETTE_PRESETS}
                value={config.particlePalette}
                onChange={(palette) => updateActionConfig({ particlePalette: palette })}
              />
            }
          />
        </SettingSection>

        <SettingSection disabled={!config.particle}>
          <SectionTitle>物理</SectionTitle>
          <FieldRow
            label="物理预设"
            hint="一键应用重力、风力和弹跳的组合。"
            control={<SmallSelect value="" options={PARTICLE_PHYSICS_PRESET_OPTIONS} onChange={config.particle ? (value) => { if (value && PARTICLE_PHYSICS_PRESET_VALUES[value]) { updateActionConfig({ ...PARTICLE_PHYSICS_PRESET_VALUES[value], particle: true }); } } : undefined} label="物理预设" />}
          />
          <FieldRow
            label="重力强度"
            hint="粒子下落力度。"
            control={<ControlSlider disabled={!config.particle} value={config.particleGravity || 0} min={0} max={100} onValueChange={(value) => updateActionConfig({ particleGravity: value[0] })} suffix="" label="重力强度" />}
          />
          <FieldRow
            label="风力偏移"
            hint="水平漂移方向。"
            control={<ControlSlider disabled={!config.particle} value={config.particleWind || 0} min={-50} max={50} onValueChange={(value) => updateActionConfig({ particleWind: value[0] })} suffix="" label="风力偏移" />}
          />
          <FieldRow
            label="弹跳强度"
            hint="粒子反弹力度。"
            control={<ControlSlider disabled={!config.particle} value={config.particleBounce || 0} min={0} max={100} onValueChange={(value) => updateActionConfig({ particleBounce: value[0] })} suffix="" label="弹跳强度" />}
          />
          <FieldRow
            label="拖尾效果"
            hint="粒子后方追加光尾。"
            control={<Switch checked={config.particleTrail || false} disabled={!config.particle} onCheckedChange={(next) => updateActionConfig({ particleTrail: next })} aria-label="拖尾开关" />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
