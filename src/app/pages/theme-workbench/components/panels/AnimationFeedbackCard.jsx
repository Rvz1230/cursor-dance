import { Switch } from "@/components/ui/switch.jsx";
import {
  ACTION_ANIMATION_FIELDS,
  ANIMATION_STYLE_OPTIONS,
  PANEL_META,
} from "../../model/workbenchSchema.js";
import {
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
  SmallSelect,
} from "../WorkbenchControls.jsx";

export function AnimationFeedbackCard({ config, updateActionConfig }) {
  return (
    <Panel
      title="基础动画反馈"
      icon={PANEL_META.trigger.icon}
      iconTone="bg-cyan-100 text-cyan-700"
      action={<Switch checked={config.animationEnabled} onCheckedChange={(next) => updateActionConfig({ animationEnabled: next })} aria-label="动画反馈开关" />}
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.animationEnabled}>
          <SectionTitle>形态</SectionTitle>
          <FieldRow
            label="动画样式"
            hint="先只支持三个轻量样式。"
            control={<SmallSelect value={config.animationStyle} options={ANIMATION_STYLE_OPTIONS} onChange={config.animationEnabled ? (value) => updateActionConfig({ animationStyle: value, animationEnabled: true }) : undefined} />}
          />
          <FieldRow
            label="动画时长"
            hint="一轮动画持续多久。"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationDuration} min={240} max={1400} onValueChange={(value) => updateActionConfig({ animationDuration: value[0] })} suffix="ms" width="w-16" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.animationEnabled}>
          <SectionTitle>位置</SectionTitle>
          <FieldRow
            label="水平偏移"
            hint="左右位置。"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationOffsetX} min={-36} max={36} onValueChange={(value) => updateActionConfig({ animationOffsetX: value[0] })} suffix="px" width="w-16" />}
          />
          <FieldRow
            label="垂直偏移"
            hint="上下位置。"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationOffsetY} min={-48} max={24} onValueChange={(value) => updateActionConfig({ animationOffsetY: value[0] })} suffix="px" width="w-16" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.animationEnabled}>
          <SectionTitle>强度</SectionTitle>
          <FieldRow
            label="缩放强度"
            hint="控制动画展开尺度。"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationScale} min={60} max={160} onValueChange={(value) => updateActionConfig({ animationScale: value[0] })} suffix="%" />}
          />
          <FieldRow
            label="透明度"
            hint="控制动画存在感。"
            control={<ControlSlider disabled={!config.animationEnabled} value={config.animationOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ animationOpacity: value[0] })} suffix="%" />}
          />
          <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            当前这张卡只负责一个轻量装饰层动画，不和粒子 / 波纹复用配置，也不引入额外素材系统。共 {ACTION_ANIMATION_FIELDS.length} 个字段。
          </div>
        </SettingSection>
      </div>
    </Panel>
  );
}
