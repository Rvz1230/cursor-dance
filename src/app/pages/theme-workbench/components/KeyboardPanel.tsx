import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import { EASING_NAMES, FONTS } from "@/components/ui/control-data";
import { Slider } from "@/components/ui/slider";
import { XYPad } from "@/components/ui/xy-pad";
import { FieldRow } from "@/components/ui/field-row";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import { PANEL_META } from "../model/workbenchSchema";
import { defaultKeyFeedbackConfig, type KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { WorkbenchSettingSection } from "./WorkbenchSettingSection";

const ANIMATION_STYLES = [
  { value: "bounce", label: "弹跳", description: "Q弹弹簧物理曲线" },
  { value: "raindrop", label: "雨滴", description: "从顶部落下带重力感" },
] as const;

const ORIGIN_EDGES = [
  { value: "bottom", label: "底部" },
  { value: "top", label: "顶部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
] as const;
const ORIGIN_MAPPINGS = [
  { value: "keyboardLayout", label: "跟随键位", description: "按 Q 出现在左边，按 P 出现在右边" },
  { value: "center", label: "固定位置", description: "所有按键从同一个位置飞入" },
] as const;
const EASING_OPTIONS = EASING_NAMES;
const FONT_WEIGHTS = ["标准", "中等", "半粗", "加粗"];
const FONT_FAMILIES = FONTS.map(({ value }) => value);
// 二选一 + 需要人话标签 → 用 Segmented 而不是下拉。
// 原先是普通下拉，options 直接是 ["typed","physical"]，
// 于是界面上真的显示英文枚举值给用户看。
const KEY_DISPLAY_MODE_OPTIONS = [
  { value: "typed", label: "真实输入" },
  { value: "physical", label: "物理键名" },
] as const;

interface KeyboardPanelProps {
  config: KeyFeedbackConfig;
  themeName?: string;
  onUpdate: (patch: Partial<KeyFeedbackConfig>) => void;
}

export function KeyboardPanel({ config, themeName, onUpdate }: KeyboardPanelProps) {
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
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdate({ ...defaultKeyFeedbackConfig })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                恢复默认
              </button>
              <Switch checked={enabled} onCheckedChange={(v) => onUpdate({ enabled: v })} aria-label="键盘动效开关" />
            </div>
          }
        >
          <p className="text-xs text-slate-500">正在编辑当前主题{themeName ? `：${themeName}` : ""}。</p>
          {enabled && (
            <p className="mt-1 text-xs text-slate-500">按下任意键查看效果，需辅助功能权限。</p>
          )}
        </Panel>

        {/* 动画风格 */}
        <Panel
          id="key-feedback-style"
          title="动画风格"
          icon={PANEL_META.keyboard.icon}
          collapsible
          defaultOpen
          enabled={enabled}
        >
          <div className="space-y-4">
            <WorkbenchSettingSection disabled={!enabled}>
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
            </WorkbenchSettingSection>
          </div>
        </Panel>

        {/* 动画参数 */}
        <Panel
          id="key-feedback-params"
          title="动画参数"
          icon={PANEL_META.keyboard.icon}
          collapsible
          defaultOpen
          enabled={enabled}
        >
          <div className="space-y-4">
            <WorkbenchSettingSection disabled={!enabled}>
              <SectionTitle>基础</SectionTitle>
              <FieldRow
                label="持续时长"
                tooltip="单个字符从入场到淡出的总时长"
                control={<Slider disabled={!enabled} value={config.duration} defaultValue={defaultKeyFeedbackConfig.duration} min={200} max={2000} onChange={(v) => onUpdate({ duration: v })} suffix="ms" label="持续时长" />}
              />
              <FieldRow
                label="缓动曲线"
                tooltip="动画整体的速度变化方式。弹跳曲线已内置多段振荡，此项主要影响入场段"
                control={<Select value={config.easing} options={EASING_OPTIONS} onChange={enabled ? (v) => onUpdate({ easing: v }) : undefined} />}
              />
              <FieldRow
                label="字号大小"
                tooltip="字符基础字号（像素）"
                control={<Slider disabled={!enabled} value={config.fontSize} defaultValue={defaultKeyFeedbackConfig.fontSize} min={16} max={120} onChange={(v) => onUpdate({ fontSize: v })} suffix="px" label="字号大小" />}
              />
              <FieldRow
                label="缩放倍率"
                tooltip="叠加在字号上的整体缩放，方便快速放大/缩小所有字符"
                control={<Slider disabled={!enabled} value={config.scale * 10} defaultValue={defaultKeyFeedbackConfig.scale * 10} min={5} max={30} onChange={(v) => onUpdate({ scale: v / 10 })} suffix="x" label="缩放倍率" />}
              />
              <FieldRow
                label="不透明度"
                tooltip="字符峰值不透明度，淡入淡出按此比例进行"
                control={<Slider disabled={!enabled} value={config.opacity} defaultValue={defaultKeyFeedbackConfig.opacity} min={10} max={100} onChange={(v) => onUpdate({ opacity: v })} suffix="%" label="不透明度" />}
              />
            </WorkbenchSettingSection>

            {config.animationStyle === "bounce" && (
              <WorkbenchSettingSection disabled={!enabled}>
                <SectionTitle>弹跳参数</SectionTitle>
                <FieldRow
                  label="弹跳高度"
                  tooltip="字符从入场边飞入后停留位置距入场边的距离"
                  control={<Slider disabled={!enabled} value={config.bounceHeight} defaultValue={defaultKeyFeedbackConfig.bounceHeight} min={40} max={400} onChange={(v) => onUpdate({ bounceHeight: v })} suffix="px" label="弹跳高度" />}
                />
              </WorkbenchSettingSection>
            )}

            {config.animationStyle === "raindrop" && (
              <WorkbenchSettingSection disabled={!enabled}>
                <SectionTitle>雨滴参数</SectionTitle>
                <FieldRow
                  label="重力强度"
                  tooltip="末段加速程度，值越大下落越急促"
                  control={<Slider disabled={!enabled} value={config.gravity} defaultValue={defaultKeyFeedbackConfig.gravity} min={0} max={1} step={0.1} ticks={[0.3, 0.6, 0.9]} snapToTicks onChange={(v) => onUpdate({ gravity: v })} label="重力强度" />}
                />
                <FieldRow
                  label="水平风力"
                  tooltip="下落时叠加的横向偏移，0 为无风，负值向左、正值向右"
                  control={<Slider disabled={!enabled} value={config.wind} defaultValue={defaultKeyFeedbackConfig.wind} min={-1} max={1} step={0.1} bipolar onChange={(v) => onUpdate({ wind: v })} label="水平风力" />}
                />
              </WorkbenchSettingSection>
            )}
          </div>
        </Panel>

        {/* 弹出位置 */}
        <Panel
          id="key-feedback-position"
          title="弹出位置"
          icon={PANEL_META.keyboard.icon}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <WorkbenchSettingSection disabled={!enabled}>
              <FieldRow
                label="起始边缘"
                tooltip="字符从哪个边缘飞入屏幕"
                control={<Select value={config.originEdge} options={ORIGIN_EDGES} onChange={enabled ? (v) => onUpdate({ originEdge: v }) : undefined} />}
              />
              <FieldRow
                label="水平定位"
                tooltip="keyboardLayout=按 QWERTY 键位映射位置；center=使用统一偏移"
                control={<Select value={config.originMapping} options={ORIGIN_MAPPINGS} onChange={enabled ? (v) => onUpdate({ originMapping: v }) : undefined} />}
              />
              {showHorizontalOffset && showVerticalOffset ? (
                <FieldRow
                  label="统一偏移"
                  tooltip="在二维区域内同时设置水平与垂直位置；方向键微调，Shift 加速"
                  control={(
                    <XYPad
                      label="字符位置偏移"
                      value={{ x: config.globalOffsetX * 100, y: config.globalOffsetY * 100 }}
                      yRange={[5, 100]}
                      disabled={!enabled}
                      onChange={({ x, y }) => onUpdate({ globalOffsetX: x / 100, globalOffsetY: y / 100 })}
                    />
                  )}
                />
              ) : null}
              {showHorizontalOffset && !showVerticalOffset && (
                <FieldRow
                  label="水平偏移"
                  tooltip={isVerticalEdge ? "字符在水平方向的位置（屏宽比例）" : "字符距入场边的弹跳距离（屏宽比例）"}
                  control={<Slider disabled={!enabled} value={config.globalOffsetX * 100} min={0} max={100} onChange={(v) => onUpdate({ globalOffsetX: v / 100 })} suffix="%" label="水平偏移" />}
                />
              )}
              {showVerticalOffset && !showHorizontalOffset && (
                <FieldRow
                  label="垂直偏移"
                  tooltip={isVerticalEdge ? "字符距入场边的弹跳距离（屏高比例）" : "字符在垂直方向的位置（屏高比例）"}
                  control={<Slider disabled={!enabled} value={config.globalOffsetY * 100} min={5} max={100} onChange={(v) => onUpdate({ globalOffsetY: v / 100 })} suffix="%" label="垂直偏移" />}
                />
              )}
            </WorkbenchSettingSection>
          </div>
        </Panel>

        {/* 字符样式 */}
        <Panel
          id="key-feedback-text"
          title="字符样式"
          icon={PANEL_META.keyboard.icon}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <WorkbenchSettingSection disabled={!enabled}>
              <FieldRow
                label="颜色"
                tooltip="字符主体颜色"
                control={<ColorField label="字符颜色" disabled={!enabled} value={config.color} onChange={(v) => onUpdate({ color: v })} />}
              />
              <FieldRow
                label="字体粗细"
                tooltip="字符笔画粗细"
                control={<Select value={config.fontWeight} options={FONT_WEIGHTS} onChange={enabled ? (v) => onUpdate({ fontWeight: v }) : undefined} />}
              />
              <FieldRow
                label="字体"
                tooltip="字符使用的字体族，未安装时回退到系统默认"
                control={<Select value={config.fontFamily} options={FONT_FAMILIES} onChange={enabled ? (v) => onUpdate({ fontFamily: v }) : undefined} />}
              />
              <FieldRow
                label="显示模式"
                tooltip="真实输入会把 Shift+1 显示为 !；物理键名会保留按键本身，适合展示快捷键训练"
                control={(
                  <Segmented
                    ariaLabel="按键显示模式"
                    options={KEY_DISPLAY_MODE_OPTIONS}
                    value={config.keyDisplayMode}
                    disabled={!enabled}
                    onChange={(keyDisplayMode) => onUpdate({ keyDisplayMode })}
                  />
                )}
              />
              <FieldRow
                label="语义分层"
                tooltip="普通输入、快捷键、特殊键、单独修饰键使用不同强度，让打字和快捷操作更容易区分"
                control={<Switch checked={config.semanticStyles} disabled={!enabled} onCheckedChange={(v) => onUpdate({ semanticStyles: v })} aria-label="语义分层" />}
              />
              <FieldRow
                label="输入节奏"
                tooltip="快速连续输入时逐步增强缩放、亮度和轻微发光，停顿后自动归零"
                control={<Switch checked={config.typingCombo} disabled={!enabled} onCheckedChange={(v) => onUpdate({ typingCombo: v })} aria-label="输入节奏" />}
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
            </WorkbenchSettingSection>
          </div>
        </Panel>

        {/* 特效增强 */}
        <Panel
          id="key-feedback-effects"
          title="特效增强"
          icon={PANEL_META.keyboard.icon}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <WorkbenchSettingSection disabled={!enabled}>
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
                    control={<ColorField label="发光颜色" disabled={!enabled} value={config.glowColor} onChange={(v) => onUpdate({ glowColor: v })} />}
                  />
                  <FieldRow
                    label="发光半径"
                    tooltip="发光扩散范围，过大会让字符变模糊"
                    control={<Slider disabled={!enabled} value={config.glowRadius} defaultValue={defaultKeyFeedbackConfig.glowRadius} min={1} max={30} onChange={(v) => onUpdate({ glowRadius: v })} suffix="px" label="发光半径" />}
                  />
                </>
              )}
            </WorkbenchSettingSection>
          </div>
        </Panel>

        {/* 高级 */}
        <Panel
          id="key-feedback-advanced"
          title="高级"
          icon={PANEL_META.keyboard.icon}
          collapsible
          enabled={enabled}
        >
          <div className="space-y-4">
            <WorkbenchSettingSection disabled={!enabled}>
              <FieldRow
                label="冷却时间"
                tooltip="同一按键两次触发的最小间隔，过低会让按住时刷屏，过高会丢失自动重复"
                control={<Slider disabled={!enabled} value={config.cooldownMs} defaultValue={defaultKeyFeedbackConfig.cooldownMs} min={0} max={500} onChange={(v) => onUpdate({ cooldownMs: v })} suffix="ms" label="冷却时间" />}
              />
              <FieldRow
                label="最大同显"
                tooltip="屏幕上同时存在的字符上限，达到上限后新按键会被丢弃"
                control={<Slider disabled={!enabled} value={config.maxSimultaneous} defaultValue={defaultKeyFeedbackConfig.maxSimultaneous} min={1} max={50} onChange={(v) => onUpdate({ maxSimultaneous: v })} label="最大同显" />}
              />
            </WorkbenchSettingSection>
          </div>
        </Panel>
      </div>
    </div>
  );
}
