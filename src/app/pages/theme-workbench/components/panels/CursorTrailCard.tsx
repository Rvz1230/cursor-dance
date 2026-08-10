import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ClipboardPaste, Copy, Download, MousePointer2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { FieldRow } from "@/components/ui/field-row";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { NumberField } from "@/components/ui/number-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  CURSOR_TRAIL_PRESETS,
  DEFAULT_CURSOR_TRAIL_CONFIG,
  DEFAULT_CURSOR_TRAIL_SEGMENTS,
  normalizeCursorTrailConfig,
  type AtmosphereConfig,
  type CursorTrailConfig,
  type CursorTrailSegmentId,
} from "@/shared/config/cursor-trail";
import { parseCursorTrailRecipe } from "@/shared/config/cursor-trail-recipe";
import { isDesktop } from "@/shared/runtime";
import type { EffectPreset } from "../../lib/effectCardModel";
import {
  copyCursorTrailRecipe,
  downloadCursorTrailRecipe,
  pickCursorTrailRecipeFile,
  readCursorTrailRecipeClipboard,
} from "../../lib/cursorTrailRecipeIo";
import {
  listSavedCursorTrailRecipes,
  removeSavedCursorTrailRecipe,
  restoreSavedCursorTrailRecipe,
  saveCursorTrailRecipe,
  type SavedCursorTrailRecipe,
} from "../../lib/cursorTrailRecipeLibrary";
import { WorkbenchEffectCard } from "../effect-cards/WorkbenchEffectCard";

const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "正常", description: "忠实保留设定颜色" },
  { value: "screen", label: "滤色", description: "在深色背景上更明亮" },
  { value: "soft-light", label: "柔光", description: "轻柔融入背景明暗" },
  { value: "overlay", label: "叠加", description: "加强背景对比与饱和度" },
] as const;

const QUALITY_OPTIONS = [
  { value: "auto", label: "自动", description: "从精细开始，持续掉帧时逐级降档" },
  { value: "eco", label: "省电", description: "30 FPS、低像素密度与较少粒子" },
  { value: "balanced", label: "平衡", description: "兼顾清晰度和资源占用" },
  { value: "fine", label: "精细", description: "完整采样与高像素密度" },
] as const;

const MATERIAL_OPTIONS = [
  { value: "neon", label: "霓虹", description: "保留当前光带、星尘、像素或残像几何" },
  { value: "flame", label: "火焰", description: "沿路径向上跃动的炽热光团" },
  { value: "ink", label: "墨水", description: "浓淡相叠的圆润墨迹" },
  { value: "liquid", label: "液态", description: "柔滑主轨与流动气泡" },
  { value: "lightning", label: "闪电", description: "带确定性抖动的折线电弧" },
  { value: "petal", label: "花瓣", description: "沿轨迹旋转散落的椭圆花瓣" },
  { value: "note", label: "音符", description: "按路径浮现的节奏符号" },
  { value: "code", label: "代码字符", description: "0、1 与括号组成的字符流" },
] as const;

type GestureResponseKey = "settleResponse" | "flickResponse" | "stopResponse" | "circleResponse";

const GESTURE_RESPONSE_CONTROLS: readonly {
  key: GestureResponseKey;
  label: string;
  hint: string;
}[] = [
  { key: "settleResponse", label: "停顿收束", hint: "停止移动后在轨迹末端聚成光点；0% 时关闭。" },
  { key: "flickResponse", label: "快速甩动", hint: "高速移动时向前喷发火花；0% 时关闭。" },
  { key: "stopResponse", label: "急停涟漪", hint: "高速移动突然停止时向外扩散；0% 时关闭。" },
  { key: "circleResponse", label: "绕圈光环", hint: "识别闭合圆周后沿拟合轨迹成环；0% 时关闭。" },
];

const TRAIL_PRESETS: EffectPreset[] = CURSOR_TRAIL_PRESETS.map((preset) => {
  const { enabled: _enabled, ...patch } = preset.config;
  return { name: preset.label, patch };
});

interface CursorTrailCardProps {
  atmosphere: AtmosphereConfig | Record<string, unknown>;
  onChange(patch: Record<string, unknown>): void | (() => void);
}

export function CursorTrailCard({ atmosphere, onChange }: CursorTrailCardProps) {
  const config = normalizeCursorTrailConfig(atmosphere.trail);
  const recipeInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [recipeName, setRecipeName] = useState("");
  const [savedRecipes, setSavedRecipes] = useState<SavedCursorTrailRecipe[]>([]);

  useEffect(() => {
    setSavedRecipes(listSavedCursorTrailRecipes());
  }, []);

  function updateTrail(patch: Partial<CursorTrailConfig>): void {
    onChange({ trail: { ...config, ...patch } });
  }

  function updateSegment(segmentId: CursorTrailSegmentId, patch: Partial<CursorTrailConfig["segments"][CursorTrailSegmentId]>): void {
    const segments = {
      ...config.segments,
      [segmentId]: { ...config.segments[segmentId], ...patch },
    };
    updateTrail({
      segments,
      colors: [segments.tail.color, segments.head.color],
      width: segments.head.width,
      opacity: segments.head.opacity,
    });
  }

  function applyRecipeConfig(next: CursorTrailConfig, source: string): void {
    const undo = onChange({ trail: next });
    toast({
      tone: "success",
      title: "已应用拖尾配方",
      description: source,
      ...(typeof undo === "function" ? { undo: { run: undo } } : {}),
    });
  }

  function applyRecipeText(text: string, source: string): void {
    applyRecipeConfig(parseCursorTrailRecipe(text), source);
  }

  async function handleCopyRecipe(): Promise<void> {
    try {
      await copyCursorTrailRecipe(config);
      toast({ tone: "success", title: "已复制拖尾配方", description: "切换到其他主题后可直接粘贴。" });
    } catch (error) {
      toast({ tone: "error", title: "复制失败", description: error instanceof Error ? error.message : "无法复制拖尾配方。" });
    }
  }

  async function handlePasteRecipe(): Promise<void> {
    try {
      applyRecipeText(await readCursorTrailRecipeClipboard(), "来自剪贴板");
    } catch (error) {
      toast({ tone: "error", title: "粘贴失败", description: error instanceof Error ? error.message : "无法读取拖尾配方。" });
    }
  }

  async function handleExportRecipe(): Promise<void> {
    try {
      const fileName = await downloadCursorTrailRecipe(config);
      if (fileName) toast({ tone: "success", title: "已导出拖尾配方", description: fileName });
    } catch (error) {
      toast({ tone: "error", title: "导出失败", description: error instanceof Error ? error.message : "无法导出拖尾配方。" });
    }
  }

  async function handleImportRecipe(): Promise<void> {
    try {
      const picked = await pickCursorTrailRecipeFile();
      if (picked) {
        applyRecipeText(picked.contents, picked.fileName);
        return;
      }
      if (!window.cursorDanceDialog) recipeInputRef.current?.click();
    } catch (error) {
      toast({ tone: "error", title: "导入失败", description: error instanceof Error ? error.message : "无法读取拖尾配方。" });
    }
  }

  async function handleRecipeFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      applyRecipeText(await file.text(), file.name);
    } catch (error) {
      toast({ tone: "error", title: "导入失败", description: error instanceof Error ? error.message : "无法读取拖尾配方。" });
    }
  }

  function handleSaveToLibrary(): void {
    try {
      const next = saveCursorTrailRecipe(recipeName, config);
      const saved = next[0];
      setSavedRecipes(next);
      setRecipeName("");
      toast({ tone: "success", title: "已保存到配方库", description: saved.name });
    } catch (error) {
      toast({ tone: "error", title: "保存配方失败", description: error instanceof Error ? error.message : "无法保存拖尾配方。" });
    }
  }

  function handleRemoveSavedRecipe(id: string): void {
    const { items, removed } = removeSavedCursorTrailRecipe(id);
    setSavedRecipes(items);
    if (!removed) return;
    toast({
      tone: "success",
      title: "已移除配方",
      description: removed.name,
      undo: {
        run: () => setSavedRecipes(restoreSavedCursorTrailRecipe(removed)),
      },
    });
  }

  const recipeTools = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-800">拖尾配方</div>
      <div className="mt-0.5 text-2xs text-slate-500">只复制拖尾参数，不覆盖主题中的光标、点击或键盘效果。</div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="拖尾配方操作">
        <Button size="sm" variant="outline" onClick={() => void handleCopyRecipe()}><Copy className="mr-1.5 size-3.5" />复制</Button>
        <Button size="sm" variant="outline" onClick={() => void handlePasteRecipe()}><ClipboardPaste className="mr-1.5 size-3.5" />粘贴</Button>
        <Button size="sm" variant="outline" onClick={() => void handleExportRecipe()}><Download className="mr-1.5 size-3.5" />导出</Button>
        <Button size="sm" variant="outline" onClick={() => void handleImportRecipe()}><Upload className="mr-1.5 size-3.5" />导入</Button>
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={recipeName} maxLength={60} placeholder="配方名称" aria-label="拖尾配方名称" onChange={(event) => setRecipeName(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter") handleSaveToLibrary();
        }} />
        <Button size="sm" className="shrink-0" onClick={handleSaveToLibrary}>保存到库</Button>
      </div>
      {savedRecipes.length ? (
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto" role="list" aria-label="已保存拖尾配方">
          {savedRecipes.map((recipe) => {
            const material = MATERIAL_OPTIONS.find((option) => option.value === recipe.trail.material)?.label ?? recipe.trail.material;
            return (
              <div key={recipe.id} role="listitem" className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                <button type="button" className="min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-slate-50" aria-label={`应用配方 ${recipe.name}`} onClick={() => applyRecipeConfig(recipe.trail, `配方库 · ${recipe.name}`)}>
                  <span className="block truncate text-xs font-medium text-slate-700">{recipe.name}</span>
                  <span className="block text-2xs text-slate-500">{material}</span>
                </button>
                <button type="button" className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`删除配方 ${recipe.name}`} onClick={() => handleRemoveSavedRecipe(recipe.id)}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ) : <div className="mt-2 text-2xs text-slate-500">还没有保存的配方。</div>}
      <input ref={recipeInputRef} type="file" accept="application/json,.json" className="hidden" aria-label="选择拖尾配方文件" onChange={(event) => void handleRecipeFileChange(event)} />
    </div>
  );

  return (
    <WorkbenchEffectCard
      id="card-cursor-trail"
      cardKey="trail"
      title="鼠标拖尾"
      icon={MousePointer2}
      enabled={config.enabled}
      config={config}
      baseline={DEFAULT_CURSOR_TRAIL_CONFIG}
      presets={TRAIL_PRESETS}
      onChange={(patch) => updateTrail({ ...patch, enabled: true })}
      onToggle={(enabled) => updateTrail({ enabled })}
      onReset={() => onChange({ trail: {
        ...DEFAULT_CURSOR_TRAIL_CONFIG,
        colors: [...DEFAULT_CURSOR_TRAIL_CONFIG.colors],
        segments: {
          tail: { ...DEFAULT_CURSOR_TRAIL_SEGMENTS.tail },
          middle: { ...DEFAULT_CURSOR_TRAIL_SEGMENTS.middle },
          head: { ...DEFAULT_CURSOR_TRAIL_SEGMENTS.head },
        },
      } })}
      disabledContent={recipeTools}
      settingCount={26}
      primaryCount={4}
      primary={(
        <>
          <FieldRow label="轨迹长度" hint="保留多少个移动采样点。" control={<Slider value={config.length} min={6} max={48} ticks={[12, 24, 36]} snapToTicks onChange={(length) => updateTrail({ length })} label="鼠标拖尾轨迹长度" />} />
          <FieldRow label="余辉时间" hint="停止移动后，拖尾完全消散所需时间。" control={<Slider value={config.lifetimeMs} min={120} max={900} step={20} suffix="ms" onChange={(lifetimeMs) => updateTrail({ lifetimeMs })} label="鼠标拖尾余辉时间" />} />
          <FieldRow label="路径平滑" control={<Slider value={config.smoothing} min={0} max={90} suffix="%" onChange={(smoothing) => updateTrail({ smoothing })} label="鼠标拖尾路径平滑度" />} />
          <FieldRow label="柔光范围" control={<Slider value={config.glow} min={0} max={24} suffix="px" onChange={(glow) => updateTrail({ glow })} label="鼠标拖尾柔光范围" />} />
        </>
      )}
    >
      <div>
        <div className="mb-2">
          <div className="text-xs font-medium text-slate-700">分段轨迹</div>
          <div className="mt-0.5 text-2xs text-slate-500">三段之间会平滑过渡，可分别控制颜色、宽度和透明度。</div>
        </div>
        <div className="space-y-2">
          <TrailSegmentEditor segmentId="tail" label="尾部" description="即将消散" value={config.segments.tail} onChange={updateSegment} />
          <TrailSegmentEditor segmentId="middle" label="中段" description="主体过渡" value={config.segments.middle} onChange={updateSegment} />
          <TrailSegmentEditor segmentId="head" label="光标附近" description="最靠近指针" value={config.segments.head} onChange={updateSegment} />
        </div>
      </div>
      <FieldRow label="轨迹材质" hint="材质决定轨迹的绘制语言；霓虹会继续使用上方预设的几何形态。" control={<Select value={config.material} options={MATERIAL_OPTIONS} onChange={(material) => updateTrail({ material })} aria-label="鼠标拖尾轨迹材质" />} />
      <FieldRow label="混合模式" hint={isDesktop() ? "桌面覆盖窗使用 Canvas 内部合成；无法读取其他应用窗口的背景像素。" : "与当前网页或预览背景进行真实混合。"} control={<Select value={config.blendMode} options={BLEND_MODE_OPTIONS} onChange={(blendMode) => updateTrail({ blendMode })} aria-label="鼠标拖尾混合模式" />} />
      <FieldRow label="性能档位" hint="自动档只会逐级降档，避免在临界帧率反复跳动。" control={<Select value={config.quality} options={QUALITY_OPTIONS} onChange={(quality) => updateTrail({ quality })} aria-label="鼠标拖尾性能档位" />} />
      <FieldRow label="点击强调色" hint="按下鼠标时，整条可见轨迹会短暂切换到这个颜色。" control={<ColorField compact label="点击强调色" value={config.clickColor} onChange={(clickColor) => updateTrail({ clickColor })} />} />
      <FieldRow label="点击变色时长" control={<Slider value={config.clickDurationMs} min={80} max={600} step={20} suffix="ms" onChange={(clickDurationMs) => updateTrail({ clickDurationMs })} label="鼠标拖尾点击变色时长" />} />
      <FieldRow label="跟随光标状态色" hint="使用当前光标状态所绑定动作的光晕颜色；未设置光晕色时继续使用分段颜色。" control={<Switch checked={config.followCursorStateColor} onCheckedChange={(followCursorStateColor) => updateTrail({ followCursorStateColor })} aria-label="鼠标拖尾跟随光标状态色开关" />} />
      <FieldRow label="随机种子" hint="相同种子和路径会得到一致的粒子分布。" control={<NumberField compact value={config.randomSeed} min={0} max={9999} onChange={(randomSeed) => updateTrail({ randomSeed })} ariaLabel="鼠标拖尾随机种子" />} />
      <FieldRow label="速度响应" hint="移动越快，轨迹越有张力。" control={<Slider value={config.velocityResponse} min={0} max={100} suffix="%" onChange={(velocityResponse) => updateTrail({ velocityResponse })} label="鼠标拖尾速度响应" />} />
      <FieldRow label="转向散射" hint="拐弯越急，越容易甩出侧向光点。" control={<Slider value={config.turnResponse} min={0} max={100} suffix="%" onChange={(turnResponse) => updateTrail({ turnResponse })} label="鼠标拖尾转向散射" />} />
      {GESTURE_RESPONSE_CONTROLS.map((control) => (
        <FieldRow
          key={control.key}
          label={control.label}
          hint={control.hint}
          control={<Slider value={config[control.key]} min={0} max={100} suffix="%" onChange={(value) => updateTrail({ [control.key]: value } as Partial<CursorTrailConfig>)} label={`鼠标拖尾${control.label}`} />}
        />
      ))}
      {recipeTools}
    </WorkbenchEffectCard>
  );
}

function TrailSegmentEditor({
  segmentId,
  label,
  description,
  value,
  onChange,
}: {
  segmentId: CursorTrailSegmentId;
  label: string;
  description: string;
  value: CursorTrailConfig["segments"][CursorTrailSegmentId];
  onChange(segmentId: CursorTrailSegmentId, patch: Partial<CursorTrailConfig["segments"][CursorTrailSegmentId]>): void;
}) {
  return (
    <section aria-label={`${label}轨迹样式`} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: value.color }} aria-hidden="true" />
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        <span className="text-2xs text-slate-500">{description}</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ColorField label={`${label}颜色`} value={value.color} onChange={(color) => onChange(segmentId, { color })} />
        <div className="space-y-1">
          <Slider compact value={value.width} min={1} max={32} step={0.1} suffix="px" label={`${label}宽度`} onChange={(width) => onChange(segmentId, { width })} />
          <Slider compact value={value.opacity} min={0} max={100} suffix="%" label={`${label}透明度`} onChange={(opacity) => onChange(segmentId, { opacity })} />
        </div>
      </div>
    </section>
  );
}
