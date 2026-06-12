import { Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ColorOptions, ControlSlider, FieldRow, Panel } from "../WorkbenchControls";

export function CursorGlowCard({ value, onChange }) {
  return (
    <Panel
      id="card-cursor-glow"
      title="光标光晕"
      icon={Sun}
      iconTone="bg-amber-100 text-amber-700"
      collapsible
      defaultOpen={value.enabled}
      summary={value.enabled ? `${value.size}px` : "已关闭"}
    >
      <FieldRow
        label="启用"
        hint="开启光标周围的光晕效果。"
        control={<Switch checked={value.enabled} onCheckedChange={(next) => onChange({ enabled: next })} aria-label="光标光晕开关" />}
      />
      {value.enabled ? (
        <>
          <FieldRow
            label="光晕大小"
            hint="光晕的直径。"
            control={<ControlSlider value={value.size} min={40} max={300} onValueChange={(val) => onChange({ size: val[0] })} suffix="px" label="光晕大小" />}
          />
          <FieldRow
            label="透明度"
            hint="光晕的不透明度。"
            control={<ControlSlider value={Math.round(value.opacity * 100)} min={1} max={50} onValueChange={(val) => onChange({ opacity: val[0] / 100 })} suffix="%" label="透明度" />}
          />
          <FieldRow
            label="光晕颜色"
            hint="光晕的色调。"
            control={<ColorOptions value={value.color} onChange={(color) => onChange({ color })} />}
          />
        </>
      ) : null}
    </Panel>
  );
}
