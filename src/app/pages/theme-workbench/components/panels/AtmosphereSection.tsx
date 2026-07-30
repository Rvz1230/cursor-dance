import { FieldRow } from "@/components/ui/field-row";
import { SectionTitle } from "@/components/ui/section-title";
import { SmallSelect } from "@/components/ui/small-select";
import { ATMOSPHERE_PRESET_OPTIONS } from "../../model/atmosphereDefaults";

export function AtmosphereSection({ atmosphere, onChangeModule }) {
  return (
    <div className="mt-6 space-y-3">
      <div className="border-t border-slate-200" />
      <SectionTitle>氛围动效</SectionTitle>
      <p className="-mt-2 text-xs leading-relaxed text-slate-500">
        鼠标在页面上移动时持续展示的视觉效果，与点击触发无关。
      </p>
      <FieldRow
        label="效果预设"
        hint="选择鼠标交互动效风格，保存后刷新页面查看效果。"
        control={
          <SmallSelect
            value={atmosphere.mode || "none"}
            options={ATMOSPHERE_PRESET_OPTIONS}
            onChange={(val) => onChangeModule("mode", val)}
          />
        }
      />
    </div>
  );
}
