import { Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PARALLAX_INTENSITY_OPTIONS } from "../../model/atmosphereDefaults";
import { FieldRow, Panel, SmallSelect } from "../WorkbenchControls";

export function ParallaxCard({ value, onChange }) {
  return (
    <Panel
      id="card-parallax"
      title="视差景深"
      icon={Layers}
      iconTone="bg-slate-100 text-slate-700"
      collapsible
      defaultOpen={value.enabled}
      summary={value.enabled ? value.intensity : "已关闭"}
    >
      <FieldRow
        label="启用"
        hint="页面元素跟随鼠标偏移，产生景深感。"
        control={<Switch checked={value.enabled} onCheckedChange={(next) => onChange({ enabled: next })} aria-label="视差景深开关" />}
      />
      {value.enabled ? (
        <>
          <FieldRow
            label="强度"
            hint="视差偏移的幅度。"
            control={<SmallSelect value={value.intensity} options={PARALLAX_INTENSITY_OPTIONS} onChange={(val) => onChange({ intensity: val })} />}
          />
          <FieldRow
            label="目标选择器"
            hint="CSS 选择器，匹配需要视差效果的元素。"
            control={<Input value={value.selector} onChange={(e) => onChange({ selector: e.target.value })} aria-label="目标选择器" />}
          />
        </>
      ) : null}
    </Panel>
  );
}
