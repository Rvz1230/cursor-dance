import { MousePointer2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BLEND_MODE_OPTIONS } from "../../model/atmosphereDefaults";
import { ColorOptions, ControlSlider, FieldRow, Panel, SmallSelect } from "../WorkbenchControls";

export function CustomCursorCard({ value, onChange }) {
  return (
    <Panel
      id="card-custom-cursor"
      title="自定义光标"
      icon={MousePointer2}
      iconTone="bg-sky-100 text-sky-700"
      collapsible
      defaultOpen={value.enabled}
      summary={value.enabled ? `${value.innerSize}/${value.outerSize}px` : "已关闭"}
    >
      <FieldRow
        label="启用"
        hint="用自定义双圆点光标替代系统光标。"
        control={<Switch checked={value.enabled} onCheckedChange={(next) => onChange({ enabled: next })} aria-label="自定义光标开关" />}
      />
      {value.enabled ? (
        <>
          <FieldRow
            label="内圆大小"
            hint="内层圆点的直径。"
            control={<ControlSlider value={value.innerSize} min={4} max={32} onValueChange={(val) => onChange({ innerSize: val[0] })} suffix="px" label="内圆大小" />}
          />
          <FieldRow
            label="内圆颜色"
            hint="内层圆点的颜色。"
            control={<ColorOptions value={value.innerColor} onChange={(color) => onChange({ innerColor: color })} />}
          />
          <FieldRow
            label="外圆大小"
            hint="外层圆环的直径。"
            control={<ControlSlider value={value.outerSize} min={16} max={80} onValueChange={(val) => onChange({ outerSize: val[0] })} suffix="px" label="外圆大小" />}
          />
          <FieldRow
            label="外圆颜色"
            hint="外层圆环的颜色。"
            control={<ColorOptions value={value.outerColor} onChange={(color) => onChange({ outerColor: color })} />}
          />
          <FieldRow
            label="跟随速度"
            hint="外层圆环跟随鼠标的缓动速度。"
            control={<ControlSlider value={Math.round(value.followSpeed * 100)} min={5} max={50} onValueChange={(val) => onChange({ followSpeed: val[0] / 100 })} label="跟随速度" />}
          />
          <FieldRow
            label="混合模式"
            hint="光标与页面内容的混合方式。"
            control={<SmallSelect value={value.blendMode} options={BLEND_MODE_OPTIONS} onChange={(val) => onChange({ blendMode: val })} />}
          />
        </>
      ) : null}
    </Panel>
  );
}
