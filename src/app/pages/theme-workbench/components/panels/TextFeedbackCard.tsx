import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ColorOptions } from "@/components/ui/color-options";
import { ControlSlider } from "@/components/ui/control-slider";
import { FieldRow } from "@/components/ui/field-row";
import { Panel } from "@/components/ui/panel";
import { SectionTitle } from "@/components/ui/section-title";
import { SmallSelect } from "@/components/ui/small-select";
import {
  NUMBER_STYLE_OPTIONS,
  PANEL_META,
  TEXT_EASING_OPTIONS,
  TEXT_FONT_PRESETS,
  TEXT_KIND_OPTIONS,
  TEXT_MODE_OPTIONS,
  TEXT_SHADOW_OPTIONS,
  TEXT_TAG_PLAY_OPTIONS,
  TEXT_WEIGHT_OPTIONS,
} from "../../model/workbenchSchema";
import {
  SettingSection,
  TextTagEditor,
} from "../WorkbenchControls";
import { ResetCardButton } from "./ResetCardButton";

function getFontPresetValue(value) {
  return TEXT_FONT_PRESETS.includes(value) ? value : "自定义";
}

export function TextFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  const fontPresetValue = getFontPresetValue(config.textFontFamily || "系统默认");

  return (
    <Panel
      id={panelId}
      title="飘字反馈"
      icon={PANEL_META.text.icon}
      collapsible
      defaultOpen={config.textEnabled}
      enabled={config.textEnabled}
      summary={config.textEnabled ? `${config.textKind} · ${config.fontSize}px · ${config.textColor}` : "关闭飘字反馈"}
      action={
        <div className="flex items-center gap-2">
          {reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : null}
          <Switch checked={config.textEnabled} onCheckedChange={(next) => updateActionConfig({ textEnabled: next })} aria-label="飘字开关" />
        </div>
      }
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.textEnabled}>
          <SectionTitle>内容</SectionTitle>
          <FieldRow
            label="飘字类型"
            tooltip="数字或文案。"
            control={<SmallSelect value={config.textKind} options={TEXT_KIND_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textKind: value, textEnabled: true }) : undefined} />}
          />
          {config.textKind === "数字飘字" ? (
            <>
              <FieldRow
                label="数字样式"
                control={<SmallSelect value={config.textStyle} options={NUMBER_STYLE_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textStyle: value, textEnabled: true }) : undefined} />}
              />
              <FieldRow
                label="数字模式"
                control={<SmallSelect value={config.textMode} options={TEXT_MODE_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textMode: value, textEnabled: true }) : undefined} />}
              />
              {config.textMode === "模板模式" ? (
                <FieldRow
                  label="模板字符串"
                  tooltip="${number} 为占位符。"
                  control={<Input disabled={!config.textEnabled} value={config.textTemplate} onChange={(event) => updateActionConfig({ textTemplate: event.target.value, textEnabled: true })} className="rounded-2xl bg-white" />}
                />
              ) : null}
              <FieldRow
                label="连击累加"
                tooltip="连续触发累加。"
                control={<Switch checked={config.comboEnabled} disabled={!config.textEnabled} onCheckedChange={(next) => updateActionConfig({ comboEnabled: next, textEnabled: true })} aria-label="连击累加开关" />}
              />
              {config.comboEnabled ? (
                <FieldRow
                  label="连击窗口"
                  tooltip="多久以内算连续。"
                  control={<ControlSlider disabled={!config.textEnabled} value={config.comboWindowMs || 900} min={120} max={3000} onValueChange={(value) => updateActionConfig({ comboWindowMs: value[0] })} suffix="ms" label="连击窗口" />}
                />
              ) : null}
            </>
          ) : (
            <>
              <FieldRow
                label="显示模式"
                control={<SmallSelect value={config.textTagPlayMode} options={TEXT_TAG_PLAY_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textTagPlayMode: value, textEnabled: true }) : undefined} />}
              />
              <FieldRow
                label="标签内容"
                tooltip="多条轮播。"
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
            control={<ControlSlider disabled={!config.textEnabled} value={config.textDuration} min={300} max={1800} onValueChange={(value) => updateActionConfig({ textDuration: value[0], textEnabled: true })} suffix="ms" label="持续时间" />}
          />
          <FieldRow
            label="缓动效果"
            control={<SmallSelect value={config.textEasing} options={TEXT_EASING_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textEasing: value, textEnabled: true }) : undefined} />}
          />
          <FieldRow
            label="水平偏移"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOffsetX} min={-24} max={24} onValueChange={(value) => updateActionConfig({ textOffsetX: value[0] })} suffix="px" label="水平偏移" />}
          />
          <FieldRow
            label="垂直偏移"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOffsetY} min={-48} max={12} onValueChange={(value) => updateActionConfig({ textOffsetY: value[0] })} suffix="px" label="垂直偏移" />}
          />
        </SettingSection>

        <SettingSection disabled={!config.textEnabled}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="飘字大小"
            control={<ControlSlider disabled={!config.textEnabled} value={config.fontSize} min={14} max={30} onValueChange={(value) => updateActionConfig({ fontSize: value[0] })} suffix="px" label="飘字大小" />}
          />
          <FieldRow
            label="飘字字体"
            control={<SmallSelect value={fontPresetValue} options={TEXT_FONT_PRESETS} onChange={config.textEnabled ? (value) => updateActionConfig({ textFontFamily: value }) : undefined} label="飘字字体" />}
          />
          {fontPresetValue === "自定义" ? (
            <FieldRow
              label="字体名称"
              tooltip="本机字体。"
              control={
                <Input
                  disabled={!config.textEnabled}
                  value={config.textFontFamily || ""}
                  onChange={(event) => updateActionConfig({ textFontFamily: event.target.value })}
                  className="rounded-2xl bg-white"
                  placeholder='例如 "霞鹜文楷", serif'
                  aria-label="输入自定义飘字字体"
                />
              }
            />
          ) : null}
          <FieldRow label="飘字颜色" control={<ColorOptions disabled={!config.textEnabled} value={config.textColor} onChange={(color) => updateActionConfig({ textColor: color })} />} />
          <FieldRow
            label="透明度"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOpacity} min={20} max={100} onValueChange={(value) => updateActionConfig({ textOpacity: value[0] })} suffix="%" label="透明度" />}
          />
          <FieldRow
            label="字重"
            control={<SmallSelect value={config.textWeight} options={TEXT_WEIGHT_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textWeight: value }) : undefined} />}
          />
          <FieldRow
            label="描边"
            control={<ControlSlider disabled={!config.textEnabled} value={config.textOutlineWidth} min={0} max={3} onValueChange={(value) => updateActionConfig({ textOutlineWidth: value[0] })} suffix="px" label="描边" />}
          />
          <FieldRow
            label="阴影效果"
            control={<SmallSelect value={config.textShadow} options={TEXT_SHADOW_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textShadow: value }) : undefined} />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
