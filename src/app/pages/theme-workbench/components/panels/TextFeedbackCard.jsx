import { Input } from "@/components/ui/input.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import {
  NUMBER_STYLE_OPTIONS,
  PANEL_META,
  TEXT_EASING_OPTIONS,
  TEXT_KIND_OPTIONS,
  TEXT_MODE_OPTIONS,
  TEXT_SHADOW_OPTIONS,
  TEXT_TAG_PLAY_OPTIONS,
  TEXT_WEIGHT_OPTIONS,
} from "../../model/workbenchSchema.js";
import {
  ColorOptions,
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
  SmallSelect,
  TextTagEditor,
} from "../WorkbenchControls.jsx";

export function TextFeedbackCard({ config, updateActionConfig }) {
  return (
    <Panel
      title="飘字反馈"
      icon={PANEL_META.text.icon}
      iconTone={PANEL_META.text.tone}
      action={<Switch checked={config.textEnabled} onCheckedChange={(next) => updateActionConfig({ textEnabled: next })} aria-label="飘字开关" />}
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.textEnabled}>
          <SectionTitle>内容</SectionTitle>
          <FieldRow
            label="飘字类型"
            hint="数字或文案。"
            control={<SmallSelect value={config.textKind} options={TEXT_KIND_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textKind: value, textEnabled: true }) : undefined} />}
          />
          {config.textKind === "数字飘字" ? (
            <>
              <FieldRow
                label="数字样式"
                hint="显示形式。"
                control={<SmallSelect value={config.textStyle} options={NUMBER_STYLE_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textStyle: value, textEnabled: true }) : undefined} />}
              />
              <FieldRow
                label="数字模式"
                hint="默认或模板。"
                control={<SmallSelect value={config.textMode} options={TEXT_MODE_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textMode: value, textEnabled: true }) : undefined} />}
              />
              {config.textMode === "模板模式" ? (
                <FieldRow
                  label="模板字符串"
                  hint="${number} 为占位符。"
                  control={<Input disabled={!config.textEnabled} value={config.textTemplate} onChange={(event) => updateActionConfig({ textTemplate: event.target.value, textEnabled: true })} className="rounded-2xl bg-white" />}
                />
              ) : null}
              <FieldRow
                label="连击累加"
                hint="连续触发累加。"
                control={<Switch checked={config.comboEnabled} disabled={!config.textEnabled} onCheckedChange={(next) => updateActionConfig({ comboEnabled: next, textEnabled: true })} aria-label="连击累加开关" />}
              />
            </>
          ) : (
            <>
              <FieldRow
                label="显示模式"
                hint="顺序或随机。"
                control={<SmallSelect value={config.textTagPlayMode} options={TEXT_TAG_PLAY_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textTagPlayMode: value, textEnabled: true }) : undefined} />}
              />
              <FieldRow
                label="标签内容"
                hint="多条轮播。"
                control={
                  <TextTagEditor
                    tags={config.textTags}
                    disabled={!config.textEnabled}
                    onChange={(next) =>
                      updateActionConfig({
                        textTags: next,
                        textContent: next[0] ?? "",
                        textEnabled: true,
                      })
                    }
                  />
                }
              />
            </>
          )}
        </SettingSection>

        <SettingSection disabled={!config.textEnabled}>
          <SectionTitle>动画</SectionTitle>
          <FieldRow
            label="持续时间"
            hint="显示时长。"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textDuration} min={300} max={1800} onValueChange={(value) => updateActionConfig({ textDuration: value[0], textEnabled: true })} suffix="ms" width="w-16" />}
          />
          <FieldRow
            label="缓动效果"
            hint="运动节奏。"
            control={<SmallSelect value={config.textEasing} options={TEXT_EASING_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textEasing: value, textEnabled: true }) : undefined} />}
          />
          <FieldRow
            label="水平偏移"
            hint="左右偏移。"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOffsetX} min={-24} max={24} onValueChange={(value) => updateActionConfig({ textOffsetX: value[0] })} suffix="px" width="w-16" />}
          />
          <FieldRow
            label="垂直偏移"
            hint="上下偏移。"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOffsetY} min={-48} max={12} onValueChange={(value) => updateActionConfig({ textOffsetY: value[0] })} suffix="px" width="w-16" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.textEnabled}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="飘字大小"
            hint="字号。"
            control={<ControlSlider disabled={!config.textEnabled} value={config.fontSize} min={14} max={30} onValueChange={(value) => updateActionConfig({ fontSize: value[0] })} suffix="px" />}
          />
          <FieldRow label="飘字颜色" hint="颜色。" control={<ColorOptions disabled={!config.textEnabled} value={config.textColor} onChange={(color) => updateActionConfig({ textColor: color })} />} />
          <FieldRow
            label="透明度"
            hint="透明度。"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ textOpacity: value[0] })} suffix="%" />}
          />
          <FieldRow
            label="字重"
            hint="粗细。"
            control={<SmallSelect value={config.textWeight} options={TEXT_WEIGHT_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textWeight: value }) : undefined} />}
          />
          <FieldRow
            label="描边"
            hint="描边宽度。"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOutlineWidth} min={0} max={3} onValueChange={(value) => updateActionConfig({ textOutlineWidth: value[0] })} suffix="px" />}
          />
          <FieldRow
            label="阴影效果"
            hint="阴影。"
            control={<SmallSelect value={config.textShadow} options={TEXT_SHADOW_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textShadow: value }) : undefined} />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
