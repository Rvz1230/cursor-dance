import { Magnet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ControlSlider, FieldRow, Panel } from "../WorkbenchControls";

export function ElementMagnetCard({ value, onChange }) {
  return (
    <Panel
      id="card-element-magnet"
      title="元素磁吸"
      icon={Magnet}
      iconTone="bg-rose-100 text-rose-700"
      collapsible
      defaultOpen={value.enabled}
      summary={value.enabled ? value.selector : "已关闭"}
    >
      <FieldRow
        label="启用"
        hint="指定元素在 hover 时磁吸光标。"
        control={<Switch checked={value.enabled} onCheckedChange={(next) => onChange({ enabled: next })} aria-label="元素磁吸开关" />}
      />
      {value.enabled ? (
        <>
          <FieldRow
            label="目标选择器"
            hint="CSS 选择器，匹配需要磁吸效果的元素。"
            control={<Input value={value.selector} onChange={(e) => onChange({ selector: e.target.value })} aria-label="目标选择器" />}
          />
          <FieldRow
            label="扩展边距"
            hint="磁吸区域的外延距离。"
            control={<ControlSlider value={value.expandPadding} min={0} max={40} onValueChange={(val) => onChange({ expandPadding: val[0] })} suffix="px" label="扩展边距" />}
          />
        </>
      ) : null}
    </Panel>
  );
}
