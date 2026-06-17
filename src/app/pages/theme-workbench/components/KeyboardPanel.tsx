import { Switch } from "@/components/ui/switch";
import { PANEL_META } from "../model/workbenchSchema";
import type { KeyFeedbackConfig } from "@/desktop/renderer/engine/key-feedback-types";
import {
  ColorOptions,
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
  SmallSelect,
} from "./WorkbenchControls";

const ANIMATION_STYLES = [
  { value: "bounce", label: "弹跳", description: "Q弹弹簧物理曲线" },
  { value: "raindrop", label: "雨滴", description: "从顶部落下带重力感" },
] as const;

const ORIGIN_EDGES = ["bottom", "top", "left", "right"];
const ORIGIN_MAPPINGS = ["keyboardLayout", "center"];
const EASING_OPTIONS = ["弹跳", "缓出", "缓入", "缓入缓出", "弹性", "线性"];
const FONT_WEIGHTS = ["标准", "中等", "半粗", "加粗"];
const FONT_FAMILIES = ["系统默认", "SF Mono", "SF Pro Rounded", "Helvetica Neue"];
const KEY_DISPLAY_MODES = ["typed", "physical"];

interface KeyboardPanelProps {
  config: KeyFeedbackConfig;
  onUpdate: (patch: Partial<KeyFeedbackConfig>) => void;
}

export function KeyboardPanel({ config, onUpdate }: KeyboardPanelProps) {
  const enabled = config.enabled;
  const isVerticalEdge = ["bottom", "top"].includes(config.originEdge);
  const showHorizontalOffset = config.originMapping === "center" && (config.animationStyle === "bounce" || isVerticalEdge);
  const showVerticalOffset = config.originMapping === "center" && (config.animationStyle === "bounce" || !isVerticalEdge);

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="space-y-4">
        {/* 启用横幅 */}
        <Panel
          id="key-feedback-enable"
          title="键盘动效"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          summary={
            enabled ? (
              <span className="inline-flex items-center gap-1.5">
                <span>{config.animationStyle === "bounce" ? "弹跳" : "雨滴"}</span>
                <span className="text-slate-400">·</span>
                <span>{config.fontSize}px</span>
                <span className="text-slate-400">·</span>
                <span
                  aria-label={`颜色 ${config.color}`}
                  className="inline-block h-3 w-3 rounded-full border border-slate-200 align-middle"
                  style={{ backgroundColor: config.color }}
                />
              </span>
            ) : "已关闭"
          }
          action={<Switch checked={enabled} onCheckedChange={(v) => onUpdate({ enabled: v })} aria-label="键盘动效开关" />}
        >
          {enabled && (
            <p className="text-xs text-slate-500">按下任意键查看效果，需辅助功能权限。</p>
          )}
        </Panel>

        {/* 动画风格 */}
        <Panel
          id="key-feedback-style"
          title="动画风格"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          collapsible
          defaultOpen
          enabled={enabled}
        >
          <div className="space-y-4">
            <SettingSection disabled={!enabled}>
              <div className="flex gap-2">
                {ANIMATION_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => onUpdate({ animationStyle: style.value })}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      config.animationStyle === style.value
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-sm font-medium">{style.label}</div>
                    <div className="text-xs text-slate-500">{style.description}</div>
                  </button>
                ))}
              </div>
            </SettingSection>
          </div>
        </Panel>

        {/* 动画参数 */}
        <Panel
          id="key-feedback-params"
          title="动画参数"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          collapsible
          defaultOpen
          enabled={enabled}
        >
          <div className="space-y-4">
            <SettingSection disabled={!enabled}>
              <SectionTitle>基础</SectionTitle>
              <FieldRow
                label="持续时长"
                tooltip="单个字符从入场到淡出的总时长"
                control={<ControlSlider disabled={!enabled} value={config.duration} min={200} max={2000} onValueChange={(v) => onUpdate({ duration: v[0] })} suffix="ms" label="持续时长" />}
              />
              <FieldRow
                label="缓动曲线"
                tooltip="动画整体的速度变化方式。弹跳曲线已内置多段振荡，此项主要影响入场段"
                control={<SmallSelect value={config.easing} options={EASING_OPTIONS} onChange={enabled ? (v) => onUpdate({ easing: v }) : undefined} />}
              />
              <FieldRow
                label="字号大小"
                tooltip="字符基础字号（像素）"
                control={<ControlSlider disabled={!enabled} value={config.fontSize} min={16} max={120} onValueChange={(v) => onUpdate({ fontSize: v[0] })} suffix="px" label="字号大小" />}
              />
              <FieldRow
                label="缩放倍率"
                tooltip="叠加在字号上的整体缩放，方便快速放大/缩小所有字符"
                control={<ControlSlider disabled={!enabled} value={config.scale * 10} min={5} max={30} onValueChange={(v) => onUpdate({ scale: v[0] / 10 })} suffix="x" label="缩放倍率" />}
              />
              <FieldRow
                label="不透明度"
                tooltip="字符峰值不透明度，淡入淡出按此比例进行"
                control={<ControlSlider disabled={!enabled} value={config.opacity} min={10} max={100} onValueChange={(v) => onUpdate({ opacity: v[0] })} suffix="%" label="不透明度" />}
              />
            </SettingSection>

            {config.animationStyle === "bounce" && (
              <SettingSection disabled={!enabled}>
                <SectionTitle>弹跳参数</SectionTitle>
                <FieldRow
                  label="弹跳高度"
                  tooltip="字符从入场边飞入后停留位置距入场边的距离"
                  control={<ControlSlider disabled={!enabled} value={config.bounceHeight} min={40} max={400} onValueChange={(v) => onUpdate({ bounceHeight: v[0] })} suffix="px" label="弹跳高度" />}
                />
              </SettingSection>
            )}

            {config.animationStyle === "raindrop" && (
              <SettingSection disabled={!enabled}>
                <SectionTitle>雨滴参数</SectionTitle>
                <FieldRow
                  label="重力强度"
                  tooltip="末段加速程度，值越大下落越急促"
                  control={<ControlSlider disabled={!enabled} value={config.gravity * 10} min={0} max={10} onValueChange={(v) => onUpdate({ gravity: v[0] / 10 })} label="重力强度" />}
                />
                <FieldRow
                  label="水平风力"
                  tooltip="下落时叠加的横向偏移，5 为无风，左右两端为最大风力"
                  control={<ControlSlider disabled={!enabled} value={(config.wind + 1) * 5} min={0} max={10} onValueChange={(v) => onUpdate({ wind: v[0] / 5 - 1 })} label="水平风力" />}
                />
              </SettingSection>
            )}
          </div>
        </Panel>

        {/* 弹出位置 */}
        <Panel
          id="key-feedback-position"
          title="弹出位置"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <SettingSection disabled={!enabled}>
              <FieldRow
                label="起始边缘"
                tooltip="字符从哪个边缘飞入屏幕"
                control={<SmallSelect value={config.originEdge} options={ORIGIN_EDGES} onChange={enabled ? (v) => onUpdate({ originEdge: v }) : undefined} />}
              />
              <FieldRow
                label="水平定位"
                tooltip="keyboardLayout=按 QWERTY 键位映射位置；center=使用统一偏移"
                control={<SmallSelect value={config.originMapping} options={ORIGIN_MAPPINGS} onChange={enabled ? (v) => onUpdate({ originMapping: v }) : undefined} />}
              />
              {showHorizontalOffset && (
                <FieldRow
                  label="水平偏移"
                  tooltip={isVerticalEdge ? "字符在水平方向的位置（屏宽比例）" : "字符距入场边的弹跳距离（屏宽比例）"}
                  control={<ControlSlider disabled={!enabled} value={config.globalOffsetX * 100} min={0} max={100} onValueChange={(v) => onUpdate({ globalOffsetX: v[0] / 100 })} suffix="%" label="水平偏移" />}
                />
              )}
              {showVerticalOffset && (
                <FieldRow
                  label="垂直偏移"
                  tooltip={isVerticalEdge ? "字符距入场边的弹跳距离（屏高比例）" : "字符在垂直方向的位置（屏高比例）"}
                  control={<ControlSlider disabled={!enabled} value={config.globalOffsetY * 100} min={5} max={100} onValueChange={(v) => onUpdate({ globalOffsetY: v[0] / 100 })} suffix="%" label="垂直偏移" />}
                />
              )}
            </SettingSection>
          </div>
        </Panel>

        {/* 字符样式 */}
        <Panel
          id="key-feedback-text"
          title="字符样式"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <SettingSection disabled={!enabled}>
              <FieldRow
                label="颜色"
                tooltip="字符主体颜色"
                control={<ColorOptions disabled={!enabled} value={config.color} onChange={(v) => onUpdate({ color: v })} />}
              />
              <FieldRow
                label="字体粗细"
                tooltip="字符笔画粗细"
                control={<SmallSelect value={config.fontWeight} options={FONT_WEIGHTS} onChange={enabled ? (v) => onUpdate({ fontWeight: v }) : undefined} />}
              />
              <FieldRow
                label="字体"
                tooltip="字符使用的字体族，未安装时回退到系统默认"
                control={<SmallSelect value={config.fontFamily} options={FONT_FAMILIES} onChange={enabled ? (v) => onUpdate({ fontFamily: v }) : undefined} />}
              />
              <FieldRow
                label="显示模式"
                tooltip="真实输入会把 Shift+1 显示为 !；物理键名会保留按键本身，适合展示快捷键训练"
                control={<SmallSelect value={config.keyDisplayMode} options={KEY_DISPLAY_MODES} onChange={enabled ? (v) => onUpdate({ keyDisplayMode: v }) : undefined} />}
              />
              <FieldRow
                label="显示修饰键"
                tooltip="开启后单独按 Shift / Command / Control / Option 也会显示 ⇧ / ⌘ / ⌃ / ⌥"
                control={<Switch checked={config.showModifierKeys} disabled={!enabled} onCheckedChange={(v) => onUpdate({ showModifierKeys: v })} aria-label="显示单独修饰键" />}
              />
              <FieldRow
                label="强制大写"
                tooltip="开启后所有字符显示为大写形式"
                control={<Switch checked={config.uppercase} disabled={!enabled} onCheckedChange={(v) => onUpdate({ uppercase: v })} aria-label="强制大写" />}
              />
            </SettingSection>
          </div>
        </Panel>

        {/* 特效增强 */}
        <Panel
          id="key-feedback-effects"
          title="特效增强"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <SettingSection disabled={!enabled}>
              <FieldRow
                label="发光"
                tooltip="为字符添加柔和发光，提高在浅色桌面上的辨识度"
                control={<Switch checked={config.glow} disabled={!enabled} onCheckedChange={(v) => onUpdate({ glow: v })} aria-label="发光开关" />}
              />
              {config.glow && (
                <>
                  <FieldRow
                    label="发光颜色"
                    tooltip="发光的颜色，建议与主体色接近或形成互补"
                    control={<ColorOptions disabled={!enabled} value={config.glowColor} onChange={(v) => onUpdate({ glowColor: v })} />}
                  />
                  <FieldRow
                    label="发光半径"
                    tooltip="发光扩散范围，过大会让字符变模糊"
                    control={<ControlSlider disabled={!enabled} value={config.glowRadius} min={1} max={30} onValueChange={(v) => onUpdate({ glowRadius: v[0] })} suffix="px" label="发光半径" />}
                  />
                </>
              )}
            </SettingSection>
          </div>
        </Panel>

        {/* 高级 */}
        <Panel
          id="key-feedback-advanced"
          title="高级"
          icon={PANEL_META.keyboard.icon}
          iconTone={PANEL_META.keyboard.tone}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <SettingSection disabled={!enabled}>
              <FieldRow
                label="冷却时间"
                tooltip="同一按键两次触发的最小间隔，过低会让按住时刷屏，过高会丢失自动重复"
                control={<ControlSlider disabled={!enabled} value={config.cooldownMs} min={0} max={500} onValueChange={(v) => onUpdate({ cooldownMs: v[0] })} suffix="ms" label="冷却时间" />}
              />
              <FieldRow
                label="最大同显"
                tooltip="屏幕上同时存在的字符上限，达到上限后新按键会被丢弃"
                control={<ControlSlider disabled={!enabled} value={config.maxSimultaneous} min={1} max={50} onValueChange={(v) => onUpdate({ maxSimultaneous: v[0] })} label="最大同显" />}
              />
            </SettingSection>
          </div>
        </Panel>
      </div>
    </div>
  );
}
