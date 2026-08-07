import { Input } from "@/components/ui/input";
import { TextTagEditor } from "@/components/ui/text-tag-editor";
import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
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
import { WorkbenchSettingSection } from "../WorkbenchSettingSection";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

function getFontPresetValue(value) {
  return TEXT_FONT_PRESETS.includes(value) ? value : "自定义";
}

export function TextFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  const fontPresetValue = getFontPresetValue(config.textFontFamily || "系统默认");

  return (
    <WorkbenchEffectCard
      id={panelId}
      cardKey="text"
      title="飘字"
      icon={PANEL_META.text.icon}
      enabled={config.textEnabled}
      config={config}
      baseline={reset?.baseline}
      onChange={(patch) => updateActionConfig({ ...patch, textEnabled: true })}
      onToggle={(next) => updateActionConfig({ textEnabled: next })}
      onReset={reset?.onReset}
      settingCount={19}
      primaryCount={4}
      primary={(
        <>
          <FieldRow label="文案" control={<Input className="h-8 px-2 text-xs" value={config.textContent || "Nice!"} onChange={(event) => updateActionConfig({ textContent: event.target.value, textEnabled: true })} />} />
          <FieldRow label="字号" control={<Slider compact value={config.fontSize} min={12} max={96} onChange={(value) => updateActionConfig({ fontSize: value })} suffix="px" label="字号" />} />
          <FieldRow label="颜色" control={<ColorField compact label="颜色" value={config.textColor} onChange={(color) => updateActionConfig({ textColor: color })} />} />
          <FieldRow label="上浮距离" control={<Slider compact value={Math.abs(config.textOffsetY || 0)} min={10} max={240} onChange={(value) => updateActionConfig({ textOffsetY: -value })} suffix="px" label="上浮距离" />} />
        </>
      )}
    >
      <div className="space-y-4">
        <WorkbenchSettingSection disabled={!config.textEnabled}>
          <SectionTitle>内容</SectionTitle>
          <FieldRow label="文本种类" control={<Select value={config.textKind} options={TEXT_KIND_OPTIONS} onChange={(value) => updateActionConfig({ textKind: value, textEnabled: true })} />} />
          {config.textKind === "文本飘字" ? (
            <FieldRow
              label="词库"
              control={<TextTagEditor tags={config.textTags} onChange={(next) => updateActionConfig({ textTags: next, textContent: next[0] ?? "", textEnabled: true })} />}
            />
          ) : null}
          {config.textKind === "数字飘字" ? (
            <>
              <FieldRow
                label="数字样式"
                control={<Select value={config.textStyle} options={NUMBER_STYLE_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textStyle: value, textEnabled: true }) : undefined} />}
              />
              <FieldRow
                label="数字模式"
                control={<Select value={config.textMode} options={TEXT_MODE_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textMode: value, textEnabled: true }) : undefined} />}
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
                  control={<Slider disabled={!config.textEnabled} value={config.comboWindowMs || 900} min={120} max={3000} onChange={(value) => updateActionConfig({ comboWindowMs: value })} suffix="ms" label="连击窗口" />}
                />
              ) : null}
            </>
          ) : (
            <>
              <FieldRow
                label="显示模式"
                control={<Select value={config.textTagPlayMode} options={TEXT_TAG_PLAY_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textTagPlayMode: value, textEnabled: true }) : undefined} />}
              />
            </>
          )}
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.textEnabled}>
          <SectionTitle>动画</SectionTitle>
          <FieldRow
            label="持续时间"
            control={<Slider disabled={!config.textEnabled} value={config.textDuration} min={300} max={1800} onChange={(value) => updateActionConfig({ textDuration: value, textEnabled: true })} suffix="ms" label="持续时间" />}
          />
          <FieldRow
            label="缓动效果"
            control={<Select value={config.textEasing} options={TEXT_EASING_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textEasing: value, textEnabled: true }) : undefined} />}
          />
          <FieldRow
            label="水平偏移"
            control={<Slider disabled={!config.textEnabled} value={config.textOffsetX} min={-24} max={24} onChange={(value) => updateActionConfig({ textOffsetX: value })} suffix="px" label="水平偏移" />}
          />
          <FieldRow
            label="垂直偏移"
            control={<Slider disabled={!config.textEnabled} value={config.textOffsetY} min={-48} max={12} onChange={(value) => updateActionConfig({ textOffsetY: value })} suffix="px" label="垂直偏移" />}
          />
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.textEnabled}>
          <SectionTitle>样式</SectionTitle>
          <FieldRow
            label="飘字字体"
            control={<Select value={fontPresetValue} options={TEXT_FONT_PRESETS} onChange={config.textEnabled ? (value) => updateActionConfig({ textFontFamily: value }) : undefined} label="飘字字体" />}
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
          <FieldRow
            label="透明度"
            control={<Slider disabled={!config.textEnabled} value={config.textOpacity} min={20} max={100} onChange={(value) => updateActionConfig({ textOpacity: value })} suffix="%" label="透明度" />}
          />
          <FieldRow
            label="字重"
            control={<Select value={config.textWeight} options={TEXT_WEIGHT_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textWeight: value }) : undefined} />}
          />
          <FieldRow
            label="描边"
            control={<Slider disabled={!config.textEnabled} value={config.textOutlineWidth} min={0} max={3} onChange={(value) => updateActionConfig({ textOutlineWidth: value })} suffix="px" label="描边" />}
          />
          <FieldRow
            label="阴影效果"
            control={<Select value={config.textShadow} options={TEXT_SHADOW_OPTIONS} onChange={config.textEnabled ? (value) => updateActionConfig({ textShadow: value }) : undefined} />}
          />
        </WorkbenchSettingSection>
      </div>
    </WorkbenchEffectCard>
  );
}
