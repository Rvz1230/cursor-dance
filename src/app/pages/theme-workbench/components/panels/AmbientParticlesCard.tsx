import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ColorOptions, ControlSlider, FieldRow, Panel } from "../WorkbenchControls";

export function AmbientParticlesCard({ value, onChange }) {
  return (
    <Panel
      id="card-ambient-particles"
      title="环境粒子"
      icon={Sparkles}
      iconTone="bg-teal-100 text-teal-700"
      collapsible
      defaultOpen={value.enabled}
      summary={value.enabled ? `${value.count}个 · ${value.size}px` : "已关闭"}
    >
      <FieldRow
        label="启用"
        tooltip="开启环境粒子漂浮效果。"
        control={<Switch checked={value.enabled} onCheckedChange={(next) => onChange({ enabled: next })} aria-label="环境粒子开关" />}
      />
      {value.enabled ? (
        <>
          <FieldRow
            label="粒子数量"
            control={<ControlSlider value={value.count} min={50} max={400} onValueChange={(val) => onChange({ count: val[0] })} label="粒子数量" />}
          />
          <FieldRow
            label="粒子大小"
            control={<ControlSlider value={value.size} min={1} max={8} step={0.5} onValueChange={(val) => onChange({ size: val[0] })} suffix="px" label="粒子大小" />}
          />
          <FieldRow
            label="透明度"
            control={<ControlSlider value={Math.round(value.opacity * 100)} min={5} max={100} onValueChange={(val) => onChange({ opacity: val[0] / 100 })} suffix="%" label="透明度" />}
          />
          <FieldRow
            label="漂移速度"
            control={<ControlSlider value={value.speed} min={1} max={10} onValueChange={(val) => onChange({ speed: val[0] })} label="漂移速度" />}
          />
          <FieldRow
            label="粒子颜色"
            control={<ColorOptions value={value.color} onChange={(color) => onChange({ color })} />}
          />
          <FieldRow
            label="引力半径"
            tooltip="鼠标吸引粒子的范围。"
            control={<ControlSlider value={value.gravityRadius} min={50} max={500} onValueChange={(val) => onChange({ gravityRadius: val[0] })} suffix="px" label="引力半径" />}
          />
          <FieldRow
            label="引力强度"
            tooltip="粒子被吸引的力度。"
            control={<ControlSlider value={Math.round(value.gravityStrength * 10)} min={0} max={50} onValueChange={(val) => onChange({ gravityStrength: val[0] / 10 })} label="引力强度" />}
          />
          <FieldRow
            label="阻尼"
            tooltip="粒子运动的惯性衰减。"
            control={<ControlSlider value={Math.round(value.damping * 100)} min={50} max={99} onValueChange={(val) => onChange({ damping: val[0] / 100 })} suffix="%" label="阻尼" />}
          />
        </>
      ) : null}
    </Panel>
  );
}
