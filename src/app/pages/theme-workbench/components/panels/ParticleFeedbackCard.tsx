import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import { cn } from "@/components/ui/utils";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import {
  PANEL_META,
  PARTICLE_COLOR_MODE_OPTIONS,
  PARTICLE_DIRECTION_OPTIONS,
  PARTICLE_MOTION_MODE_OPTIONS,
  PARTICLE_PALETTE_PRESETS,
  PARTICLE_PHYSICS_PRESET_OPTIONS,
  PARTICLE_PHYSICS_PRESET_VALUES,
  PARTICLE_STYLE_OPTIONS,
} from "../../model/workbenchSchema";
import { WorkbenchSettingSection } from "../WorkbenchSettingSection";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

function PaletteSwatches({ presets, value, onChange }: { presets: Record<string, string[]>; value: string[]; onChange: (colors: string[]) => void }) {
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

export function ParticleFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  const isOrbital = config.particleMotionMode === "orbital";

  return (
    <WorkbenchEffectCard
      id={panelId}
      cardKey="particle"
      title="粒子"
      icon={PANEL_META.particles.icon}
      enabled={config.particle}
      config={config}
      baseline={reset?.baseline}
      onChange={(patch) => updateActionConfig({ ...patch, particle: true })}
      onToggle={(next) => updateActionConfig({ particle: next })}
      onReset={reset?.onReset}
      settingCount={17}
      primaryCount={5}
      primary={(
        <>
          <FieldRow
            label="数量"
            control={isOrbital
              ? <Slider compact value={config.orbitalCount ?? 6} min={3} max={16} step={1} onChange={(value) => updateActionConfig({ orbitalCount: value })} suffix="个" label="轨道点数" />
              : <Slider compact value={config.particleCount} min={1} max={60} onChange={(value) => updateActionConfig({ particleCount: value, particle: true })} suffix="个" label="数量" />}
          />
          <FieldRow label="形状" control={<Select className="h-8 px-2 text-xs" value={config.particleStyle} options={PARTICLE_STYLE_OPTIONS} onChange={(value) => updateActionConfig({ particleStyle: value, particle: true })} />} />
          <FieldRow label="颜色" control={<ColorField compact label="颜色" value={config.particlePalette?.[0] || "#0EA5E9"} onChange={(color) => updateActionConfig({ particlePalette: [color], particleColorMode: "跟随主题", particle: true })} />} />
          <FieldRow label="扩散半径" control={<Slider compact value={config.particleSpread} min={20} max={320} onChange={(value) => updateActionConfig({ particleSpread: value, particle: true })} suffix="px" label="扩散半径" />} />
          <FieldRow label="重力" control={<Slider compact value={config.particleGravity || 0} min={0} max={10} onChange={(value) => updateActionConfig({ particleGravity: value, particle: true })} label="重力" />} />
        </>
      )}
    >
      <div className="space-y-4">
        <WorkbenchSettingSection disabled={!config.particle}>
          <SectionTitle>发射</SectionTitle>
          <FieldRow label="运动模式" control={<Select value={config.particleMotionMode || "burst"} options={PARTICLE_MOTION_MODE_OPTIONS} onChange={(value) => updateActionConfig({ particleMotionMode: value, particle: true })} />} />
          {!isOrbital && (
            <>
              <FieldRow
                label="扩散范围"
                control={<Slider disabled={!config.particle} value={config.particleSpread} min={0} max={90} onChange={(value) => updateActionConfig({ particleSpread: value })} label="扩散范围" />}
              />
              <FieldRow
                label="扩散方向"
                control={<Select value={config.particleDirection} options={PARTICLE_DIRECTION_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleDirection: value, particle: true }) : undefined} />}
              />
              <FieldRow
                label="发射间隔"
                tooltip="每个粒子之间的发射延迟，0 表示同时发射。「旋转扫射」模式下效果最明显。"
                control={<Slider disabled={!config.particle} value={config.particleStagger ?? 26} min={0} max={100} onChange={(value) => updateActionConfig({ particleStagger: value })} suffix="ms/个" label="发射间隔" />}
              />
            </>
          )}

          {isOrbital && (
            <>
              <FieldRow
                label="轨道半径"
                control={<Slider disabled={!config.particle} value={config.orbitalRadius ?? 32} min={16} max={80} step={2} onChange={(value) => updateActionConfig({ orbitalRadius: value })} suffix="px" label="轨道半径" />}
              />
              <FieldRow
                label="公转速度"
                tooltip="转完一圈的时长。"
                control={<Slider disabled={!config.particle} value={config.orbitalSpeed ?? 3} min={1} max={8} step={1} onChange={(value) => updateActionConfig({ orbitalSpeed: value })} suffix="秒/圈" label="公转速度" />}
              />
              <FieldRow
                label="持续时长"
                tooltip="0 = 持续循环，鼠标离开或再次触发时结束。>0 则指定时长后自动淡出。"
                control={<Slider disabled={!config.particle} value={config.particleDuration ?? 0} min={0} max={5000} step={100} onChange={(value) => updateActionConfig({ particleDuration: value })} suffix="ms" label="持续时长" />}
              />
            </>
          )}
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.particle}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="粒子尺寸"
            control={<Slider disabled={!config.particle} value={config.particleSize} min={6} max={24} onChange={(value) => updateActionConfig({ particleSize: value })} suffix="px" label="粒子尺寸" />}
          />
          {!isOrbital && (
            <FieldRow
              label="持续时间"
              tooltip="粒子从出现到消失的时长。"
              control={<Slider disabled={!config.particle} value={config.particleDuration} min={240} max={1200} onChange={(value) => updateActionConfig({ particleDuration: value })} suffix="ms" label="持续时间" />}
            />
          )}
          <FieldRow
            label="透明度"
            control={<Slider disabled={!config.particle} value={config.particleOpacity} min={20} max={100} onChange={(value) => updateActionConfig({ particleOpacity: value })} suffix="%" label="透明度" />}
          />
          <FieldRow
            label="颜色策略"
            control={<Select value={config.particleColorMode} options={PARTICLE_COLOR_MODE_OPTIONS} onChange={config.particle ? (value) => updateActionConfig({ particleColorMode: value }) : undefined} />}
          />
          <FieldRow
            label="预设色板"
            tooltip={config.particleColorMode === "跟随飘字色" ? "当前模式不使用色板。" : "点击选择预设色板。修改后将自动切换为自定义色板。"}
            control={
              <PaletteSwatches
                presets={PARTICLE_PALETTE_PRESETS}
                value={config.particlePalette}
                onChange={(palette) => updateActionConfig({ particlePalette: palette })}
              />
            }
          />
        </WorkbenchSettingSection>

        {!isOrbital && (
          <WorkbenchSettingSection disabled={!config.particle}>
            <SectionTitle>物理</SectionTitle>
            <FieldRow
              label="物理预设"
              tooltip="一键应用重力、风力和弹跳的组合。"
              control={<Select value="" options={PARTICLE_PHYSICS_PRESET_OPTIONS} onChange={config.particle ? (value) => { if (value && PARTICLE_PHYSICS_PRESET_VALUES[value]) { updateActionConfig({ ...PARTICLE_PHYSICS_PRESET_VALUES[value], particle: true }); } } : undefined} label="物理预设" />}
            />
            <FieldRow
              label="重力强度"
              control={<Slider disabled={!config.particle} value={config.particleGravity || 0} min={0} max={100} onChange={(value) => updateActionConfig({ particleGravity: value })} suffix="" label="重力强度" />}
            />
            <FieldRow
              label="风力偏移"
              control={<Slider disabled={!config.particle} value={config.particleWind || 0} min={-50} max={50} onChange={(value) => updateActionConfig({ particleWind: value })} suffix="" label="风力偏移" />}
            />
            <FieldRow
              label="弹跳强度"
              control={<Slider disabled={!config.particle} value={config.particleBounce || 0} min={0} max={100} onChange={(value) => updateActionConfig({ particleBounce: value })} suffix="" label="弹跳强度" />}
            />
            <FieldRow
              label="拖尾效果"
              control={<Switch checked={config.particleTrail || false} disabled={!config.particle} onCheckedChange={(next) => updateActionConfig({ particleTrail: next })} aria-label="拖尾开关" />}
            />
          </WorkbenchSettingSection>
        )}
      </div>
    </WorkbenchEffectCard>
  );
}
