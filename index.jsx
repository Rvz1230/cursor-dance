import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bell,
  Zap,
  Waves,
  Heart,
  Settings2,
  Volume2,
  VolumeX,
  MousePointer2,
  Pointer,
  Type,
  ChevronRight,
  Search,
  Copy,
  Download,
  Trash2,
  X,
  Eye,
  Palette,
  Flame,
  AudioLines,
  Image as ImageIcon,
  Shield,
  ArrowLeft,
  Maximize2,
  Check,
  Moon,
  SunMedium,
  SlidersHorizontal,
  RotateCcw,
  Star,
  Info,
  BadgeCheck,
  Wand2,
  Play,
  ExternalLink,
} from "lucide-react";
import { Button } from "./src/components/ui/button.jsx";
import { Badge } from "./src/components/ui/badge.jsx";
import { Input } from "./src/components/ui/input.jsx";
import { Switch } from "./src/components/ui/switch.jsx";
import { Slider } from "./src/components/ui/slider.jsx";
import { Tabs, TabsList, TabsTrigger } from "./src/components/ui/tabs.jsx";

const presets = [
  {
    id: "woodfish",
    name: "木鱼修行",
    desc: "功德+1，轻禅意，有记忆点。",
    icon: Bell,
    tint: "from-amber-200 via-orange-100 to-orange-300",
    tags: ["禅意", "解压"],
    left: "功德+1",
    right: "静默",
    mood: "轻敲一下，很解压",
  },
  {
    id: "combo",
    name: "游戏连击",
    desc: "越点越上头，带 combo 爆发感。",
    icon: Zap,
    tint: "from-sky-200 via-cyan-100 to-violet-300",
    tags: ["游戏感", "Combo"],
    left: "+1 +2 +3",
    right: "Burst",
    mood: "越点越热闹",
  },
  {
    id: "ripple",
    name: "极简波纹",
    desc: "不吵不闹，适合长时间使用。",
    icon: Waves,
    tint: "from-slate-200 via-zinc-100 to-slate-300",
    tags: ["极简", "办公"],
    left: "柔和波纹",
    right: "淡入淡出",
    mood: "安静但有存在感",
  },
  {
    id: "paw",
    name: "猫爪点击",
    desc: "软萌一点，适合轻松风格。",
    icon: Heart,
    tint: "from-pink-200 via-rose-100 to-orange-200",
    tags: ["可爱", "贴纸"],
    left: "肉球印章",
    right: "喵一下",
    mood: "有点可爱，有点欠摸",
  },
];

const schemeSeed = [
  { id: 1, name: "木鱼修行 - 我的版本", sub: "2 小时前更新" },
  { id: 2, name: "Combo Neon", sub: "昨天更新" },
  { id: 3, name: "Office Ripple", sub: "3 天前更新" },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Glass({ className = "", children }) {
  return (
    <div
      className={cn(
        "rounded-[30px] border border-black/5 bg-white/72 shadow-[0_12px_48px_rgba(15,23,42,0.08)] backdrop-blur-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftButton({ className = "", active = false, children, ...props }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      {...props}
      className={cn(
        "rounded-full px-3 py-2 text-sm transition",
        active ? "bg-slate-950 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-black/5 hover:bg-slate-50",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

function MacDots() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
    </div>
  );
}

function TopToast({ text, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      className="fixed left-1/2 top-5 z-[80] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-sm text-white shadow-xl"
    >
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4" />
        {text}
        <button onClick={onClose} className="ml-1 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function PopupPreviewStage({ mode = "woodfish", compact = false, interactive = false, trigger = 0, cursorState = "default" }) {
  const dotCount = compact ? 8 : 14;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[26px] border border-black/5 bg-[linear-gradient(180deg,#f8fafc,#eef2ff)]",
        compact ? "h-[200px]" : "h-[360px]",
        interactive && "cursor-pointer"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-12 border-b border-black/5 bg-white/60 backdrop-blur-xl" />
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between text-xs text-slate-400">
        <span>预览区域</span>
        <span>{mode === "woodfish" ? "左键木鱼" : mode === "combo" ? "连击模式" : mode === "paw" ? "猫爪模式" : "轻量波纹"}</span>
      </div>

      <div className="absolute right-3 top-14 rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-black/5">
        光标：{cursorState}
      </div>

      {mode === "woodfish" && (
        <>
          <motion.div
            key={`woodfish-halo-${trigger}`}
            initial={{ scale: 0.72, opacity: 0.28 }}
            animate={{ scale: [0.72, 1.18], opacity: [0.3, 0] }}
            transition={{ duration: 1.1 }}
            className="absolute left-1/2 top-[57%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/80"
          />
          <motion.div
            key={`woodfish-text-${trigger}`}
            initial={{ y: 8, opacity: 0, scale: 0.95 }}
            animate={{ y: [-2, -18, -28], opacity: [0, 1, 0], scale: [0.96, 1.02, 1.04] }}
            transition={{ duration: 1.2 }}
            className="absolute left-1/2 top-[48%] -translate-x-1/2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-700 shadow-sm"
          >
            功德+1
          </motion.div>
          <motion.div
            key={`woodfish-core-${trigger}`}
            initial={{ scale: 0.9, rotate: -2 }}
            animate={{ scale: [0.9, 1.09, 1], rotate: [-2, 2, 0] }}
            transition={{ duration: 0.58 }}
            className="absolute left-1/2 top-[57%] h-14 w-14 -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 shadow-[0_10px_30px_rgba(251,191,36,0.22)]"
          />
          <motion.div
            key={`woodfish-tapper-${trigger}`}
            initial={{ x: 10, y: -10, rotate: 16 }}
            animate={{ x: [10, 0, 8], y: [-10, 2, -6], rotate: [16, -12, 8] }}
            transition={{ duration: 0.55 }}
            className="absolute left-1/2 top-[50%] h-10 w-2 rounded-full bg-amber-700/80 shadow-sm"
          />
          {Array.from({ length: dotCount }).map((_, i) => (
            <motion.span
              key={`${mode}-${i}-${trigger}`}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                x: (i % 2 ? -1 : 1) * (10 + i * 2),
                y: -12 - i * 2,
                opacity: [0, 0.95, 0],
                scale: [0.8, 1, 0.8],
              }}
              transition={{ duration: 0.9, delay: i * 0.03 }}
              className="absolute left-1/2 top-[63%] h-1.5 w-1.5 rounded-full bg-amber-300"
            />
          ))}
        </>
      )}

      {mode === "combo" && (
        <>
          <motion.div
            key={`combo-ring-${trigger}`}
            initial={{ scale: 0.8, opacity: 0.1 }}
            animate={{ scale: [0.8, 1.35], opacity: [0.22, 0] }}
            transition={{ duration: 0.8 }}
            className="absolute left-1/2 top-[56%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200"
          />
          <motion.div
            key={`combo-text-${trigger}`}
            initial={{ scale: 0.86, opacity: 0, y: 8 }}
            animate={{ scale: [0.92, 1.1, 1], opacity: [0, 1, 1], y: [8, 0, -2] }}
            transition={{ duration: 0.52 }}
            className="absolute left-1/2 top-[46%] -translate-x-1/2 rounded-full bg-sky-100 px-5 py-2 text-base font-semibold text-sky-700 shadow-sm"
          >
            Combo x8
          </motion.div>
          <motion.div
            key={`combo-flash-${trigger}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.25),transparent_34%)]"
          />
          {Array.from({ length: compact ? 10 : 18 }).map((_, i) => (
            <motion.span
              key={`${mode}-${i}-${trigger}`}
              initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
              animate={{
                x: Math.cos(i) * (16 + i * 2),
                y: Math.sin(i) * (10 + i) - 20,
                opacity: [0, 1, 0],
                scale: [0.5, 1.12, 0.8],
              }}
              transition={{ duration: 0.95, delay: i * 0.03 }}
              className="absolute left-1/2 top-[56%] h-2 w-2 rounded-full bg-sky-300"
            />
          ))}
        </>
      )}

      {mode === "ripple" && (
        <>
          <motion.div
            key={`r1-${trigger}`}
            initial={{ scale: 0.7, opacity: 0.45 }}
            animate={{ scale: 1.38, opacity: 0 }}
            transition={{ duration: 1.05 }}
            className="absolute left-1/2 top-[56%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-300"
          />
          <motion.div
            key={`r2-${trigger}`}
            initial={{ scale: 0.75, opacity: 0.34 }}
            animate={{ scale: 1.75, opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.12 }}
            className="absolute left-1/2 top-[56%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-300"
          />
        </>
      )}

      {mode === "paw" && (
        <>
          <motion.div
            key={`paw-${trigger}`}
            initial={{ scale: 0.82, rotate: -5, opacity: 0 }}
            animate={{ scale: [0.85, 1.08, 1], rotate: [-6, 4, 0], opacity: [0, 1, 1] }}
            transition={{ duration: 0.65 }}
            className="absolute left-1/2 top-[54%] -translate-x-1/2 rounded-full bg-pink-100 px-4 py-2 text-sm font-medium text-rose-600 shadow-sm"
          >
            喵~
          </motion.div>
          <motion.div
            key={`paw-heart-${trigger}`}
            initial={{ opacity: 0, y: 4, x: 4 }}
            animate={{ opacity: [0, 0.9, 0], y: [-2, -16, -22], x: [4, 12, 18] }}
            transition={{ duration: 1.1 }}
            className="absolute left-1/2 top-[46%] text-pink-400"
          >
            ❤
          </motion.div>
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: [0.92, 1.05, 1] }}
            transition={{ duration: 0.5 }}
            className="absolute left-1/2 top-[62%] -translate-x-1/2"
          >
            <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-pink-200 to-rose-300 shadow-[0_10px_24px_rgba(244,114,182,0.18)]">
              <div className="absolute -left-2 top-1 h-3.5 w-3.5 rounded-full bg-pink-200" />
              <div className="absolute left-2 top-[-6px] h-3.5 w-3.5 rounded-full bg-pink-200" />
              <div className="absolute right-2 top-[-6px] h-3.5 w-3.5 rounded-full bg-pink-200" />
              <div className="absolute -right-2 top-1 h-3.5 w-3.5 rounded-full bg-pink-200" />
            </div>
          </motion.div>
        </>
      )}

      <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
        <div className={cn("rounded-2xl bg-white/75 px-3 py-2 text-center ring-1 ring-black/5", cursorState === "default" && "text-slate-900")}>默认</div>
        <div className={cn("rounded-2xl bg-white/75 px-3 py-2 text-center ring-1 ring-black/5", cursorState === "pointer" && "text-slate-900")}>按钮</div>
        <div className={cn("rounded-2xl bg-white/75 px-3 py-2 text-center ring-1 ring-black/5", cursorState === "text" && "text-slate-900")}>文本</div>
      </div>
    </div>
  );
}

function PopupHome({ openDetail, pushToast }) {
  const [pluginOn, setPluginOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [activePreset, setActivePreset] = useState("woodfish");
  const [previewTrigger, setPreviewTrigger] = useState(0);
  const [cursorState, setCursorState] = useState("default");
  const [favoriteIds, setFavoriteIds] = useState(["woodfish"]);
  const [installedPresetIds, setInstalledPresetIds] = useState(["woodfish"]);
  const [hoveredPreset, setHoveredPreset] = useState(null);

  const preset = presets.find((p) => p.id === activePreset) ?? presets[0];
  const PresetIcon = preset.icon;

  const cycleCursor = () => {
    setCursorState((prev) => (prev === "default" ? "pointer" : prev === "pointer" ? "text" : "default"));
  };

  const triggerPreview = () => {
    setPreviewTrigger((v) => v + 1);
    cycleCursor();
  };

  const toggleFavorite = (id) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="mx-auto mt-8 w-[438px] max-w-full">
      <div className="mb-3 flex items-center justify-center">
        <div className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] text-slate-500 ring-1 ring-black/5 backdrop-blur-xl">
          模拟浏览器右上角插件弹窗
        </div>
      </div>

      <Glass className="overflow-hidden rounded-[28px] shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="border-b border-black/5 bg-white/78 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MacDots />
              <div>
                <div className="text-sm font-semibold text-slate-900">CursorDance</div>
                <div className="text-[11px] text-slate-400">轻巧的鼠标特效插件</div>
              </div>
            </div>
            <Switch
              checked={pluginOn}
              onCheckedChange={(v) => {
                setPluginOn(v);
                pushToast(v ? "CursorDance 已开启" : "CursorDance 已暂停");
              }}
            />
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between rounded-[22px] bg-white px-3 py-2 ring-1 ring-black/5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Wand2 className="h-4 w-4 text-slate-400" />
              今天想让鼠标变得有点什么感觉？
            </div>
            <button onClick={() => pushToast("已随机切换一个预设")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-200">
              随机一下
            </button>
          </div>

          <div className="rounded-[26px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.88))] p-4 ring-1 ring-black/5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">当前方案</div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">{preset.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    toggleFavorite(activePreset);
                    pushToast(favoriteIds.includes(activePreset) ? "已取消收藏" : "已加入收藏");
                  }}
                  className={cn(
                    "rounded-full p-2 transition ring-1 ring-black/5",
                    favoriteIds.includes(activePreset) ? "bg-amber-50 text-amber-600" : "bg-white text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Star className={cn("h-4 w-4", favoriteIds.includes(activePreset) && "fill-current")} />
                </button>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br", preset.tint)}>
                  <PresetIcon className="h-5 w-5 text-slate-700" />
                </div>
              </div>
            </div>

            <p className="mb-2 text-sm leading-6 text-slate-500">{preset.desc}</p>
            <div className="mb-4 text-xs text-slate-400">{preset.mood}</div>

            <div onClick={triggerPreview}>
              <PopupPreviewStage mode={activePreset} compact interactive trigger={previewTrigger} cursorState={cursorState} />
            </div>

            <div className="mt-4 flex items-center gap-2 overflow-auto pb-1">
              {presets.map((item) => {
                const isActive = activePreset === item.id;
                const isInstalled = installedPresetIds.includes(item.id);
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onHoverStart={() => setHoveredPreset(item.id)}
                    onHoverEnd={() => setHoveredPreset(null)}
                    onClick={() => {
                      setActivePreset(item.id);
                      setPreviewTrigger((v) => v + 1);
                    }}
                    className={cn(
                      "group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full px-3 py-2 text-sm transition",
                      isActive ? "bg-slate-950 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-black/5 hover:bg-slate-50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                    {isInstalled && !isActive ? <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    <AnimatePresence>
                      {hoveredPreset === item.id && !isActive ? (
                        <motion.span
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
                        />
                      ) : null}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
              <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-black/5">左键：{preset.left}</div>
              <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-black/5">右键：{preset.right}</div>
              <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-black/5">声音：{soundOn ? "开" : "关"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                if (!installedPresetIds.includes(activePreset)) {
                  setInstalledPresetIds((prev) => [...prev, activePreset]);
                }
                pushToast(`已启用「${preset.name}」`);
              }}
              className="relative overflow-hidden rounded-[24px] bg-slate-950 px-4 py-4 text-left text-white shadow-sm"
            >
              <motion.span
                animate={{ x: ["-140%", "140%"] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: "linear" }}
                className="absolute inset-y-0 w-10 bg-white/10 blur-md"
              />
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4" /> 一键启用
              </div>
              <div className="text-xs text-white/70">立即应用当前预设</div>
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={openDetail}
              className="rounded-[24px] bg-white px-4 py-4 text-left text-slate-900 shadow-sm ring-1 ring-black/5 transition hover:bg-slate-50"
            >
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="h-4 w-4" /> 微调效果
              </div>
              <div className="text-xs text-slate-500">进入详情页修改常用项</div>
            </motion.button>
          </div>

          <div className="grid grid-cols-4 gap-3 text-sm">
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} onClick={() => pushToast("左键预设已切换")} className="rounded-[22px] bg-white p-4 text-left ring-1 ring-black/5 transition hover:bg-slate-50">
              <div className="mb-2 flex items-center gap-2 text-slate-500"><MousePointer2 className="h-4 w-4" /> 左键</div>
              <div className="font-medium text-slate-900">{preset.left}</div>
            </motion.button>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} onClick={() => pushToast("右键预设已切换")} className="rounded-[22px] bg-white p-4 text-left ring-1 ring-black/5 transition hover:bg-slate-50">
              <div className="mb-2 flex items-center gap-2 text-slate-500"><Pointer className="h-4 w-4" /> 右键</div>
              <div className="font-medium text-slate-900">{preset.right}</div>
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                setSoundOn((v) => !v);
                pushToast(soundOn ? "声音已关闭" : "声音已开启");
              }}
              className="rounded-[22px] bg-white p-4 text-left ring-1 ring-black/5 transition hover:bg-slate-50"
            >
              <div className="mb-2 flex items-center gap-2 text-slate-500">{soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} 声音</div>
              <div className="font-medium text-slate-900">{soundOn ? "已开启" : "已关闭"}</div>
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                toggleFavorite(activePreset);
                pushToast(favoriteIds.includes(activePreset) ? "已取消收藏" : "已加入收藏");
              }}
              className="rounded-[22px] bg-white p-4 text-left ring-1 ring-black/5 transition hover:bg-slate-50"
            >
              <div className="mb-2 flex items-center gap-2 text-slate-500"><Star className={cn("h-4 w-4", favoriteIds.includes(activePreset) && "fill-current text-amber-500")} /> 收藏</div>
              <div className="font-medium text-slate-900">{favoriteIds.includes(activePreset) ? "已收藏" : "点亮"}</div>
            </motion.button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} onClick={triggerPreview} className="flex items-center justify-between rounded-[22px] bg-white px-4 py-3 text-left ring-1 ring-black/5 transition hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-slate-900">试玩一下</div>
                <div className="text-xs text-slate-500">点预览区域也会有即时反馈</div>
              </div>
              <Play className="h-4 w-4 text-slate-400" />
            </motion.button>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} onClick={openDetail} className="flex items-center justify-between rounded-[22px] bg-white px-4 py-3 text-left ring-1 ring-black/5 transition hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-slate-900">更多设置</div>
                <div className="text-xs text-slate-500">方案库、导入导出、光标、预览放大</div>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </motion.button>
          </div>
        </div>
      </Glass>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 p-2 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function CollapsibleCard({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = icon;
  return (
    <div className="rounded-[24px] bg-white p-4 ring-1 ring-black/5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-slate-400 transition", open && "rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function DetailPage({ goBack, pushToast }) {
  const [tab, setTab] = useState("preset");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fontSize, setFontSize] = useState([22]);
  const [volume, setVolume] = useState([78]);
  const [particleCount, setParticleCount] = useState([8]);
  const [combo, setCombo] = useState([1200]);
  const [previewTrigger, setPreviewTrigger] = useState(0);
  const [previewMode, setPreviewMode] = useState("woodfish");
  const [cursorState, setCursorState] = useState("default");
  const [theme, setTheme] = useState("light");
  const [search, setSearch] = useState("");
  const [mySchemes, setMySchemes] = useState(schemeSeed);
  const [leftEnabled, setLeftEnabled] = useState(true);
  const [rightEnabled, setRightEnabled] = useState(true);
  const [mute, setMute] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const filteredPresets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return presets;
    return presets.filter((item) => (item.name + item.desc + item.tags.join(" ")).toLowerCase().includes(keyword));
  }, [search]);

  const triggerPreview = (mode = previewMode) => {
    setPreviewMode(mode);
    setPreviewTrigger((v) => v + 1);
  };

  const cycleCursor = () => {
    setCursorState((prev) => (prev === "default" ? "pointer" : prev === "pointer" ? "text" : "default"));
    setPreviewTrigger((v) => v + 1);
  };

  const removeScheme = (id) => {
    setMySchemes((prev) => prev.filter((item) => item.id !== id));
    pushToast("方案已删除");
  };

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={goBack} variant="ghost" className="rounded-full px-3 text-slate-600 hover:bg-white/70">
            <ArrowLeft className="mr-1 h-4 w-4" /> 返回插件
          </Button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CursorDance</div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">详情页</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => pushToast("已导出当前方案")} className="rounded-full border-black/5 bg-white/70 text-slate-700 hover:bg-white">
            <Download className="mr-2 h-4 w-4" /> 导出
          </Button>
          <Button onClick={() => pushToast("更改已保存")} className="rounded-full bg-slate-950 text-white hover:bg-slate-800">保存更改</Button>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.82))] shadow-[0_16px_50px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur-2xl">
        <div className="relative px-5 py-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.18),transparent_26%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_24%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-slate-400">当前方案</div>
                <div className="text-xl font-semibold text-slate-900">木鱼修行 - 我的版本</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <Badge className="border-0 bg-white/80 text-slate-700 ring-1 ring-black/5">已启用</Badge>
                  <span>最近编辑于今天 14:32</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="rounded-full bg-white/80 p-1 ring-1 ring-black/5">
                  <TabsTrigger value="preset" className="rounded-full">方案</TabsTrigger>
                  <TabsTrigger value="edit" className="rounded-full">编辑</TabsTrigger>
                  <TabsTrigger value="library" className="rounded-full">方案库</TabsTrigger>
                  <TabsTrigger value="settings" className="rounded-full">设置</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-1 rounded-full bg-white/80 p-1 ring-1 ring-black/5">
                <SoftButton active={theme === "light"} onClick={() => setTheme("light")} className="flex items-center gap-1.5"><SunMedium className="h-4 w-4" /> 浅色</SoftButton>
                <SoftButton active={theme === "dark"} onClick={() => setTheme("dark")} className="flex items-center gap-1.5"><Moon className="h-4 w-4" /> 深色预览</SoftButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {tab === "preset" && (
            <>
              <Glass className="p-5">
                <SectionTitle
                  icon={Sparkles}
                  title="推荐预设"
                  sub="先让用户觉得好玩，再让用户去编辑"
                  action={<Button variant="ghost" onClick={() => pushToast("已刷新推荐预设")} className="rounded-full text-slate-500 hover:bg-slate-100">换一批</Button>}
                />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {presets.map((presetItem) => {
                    const Icon = presetItem.icon;
                    return (
                      <motion.div key={presetItem.id} whileHover={{ y: -3 }} transition={{ duration: 0.18 }} className="rounded-[26px] bg-white p-4 ring-1 ring-black/5">
                        <div className={cn("mb-4 flex h-28 items-start justify-between rounded-[22px] bg-gradient-to-br p-4", presetItem.tint)}>
                          <div className="rounded-2xl bg-white/60 p-2.5 text-slate-700"><Icon className="h-4 w-4" /></div>
                          <Badge className="border-0 bg-white/60 text-slate-700">官方</Badge>
                        </div>
                        <div className="mb-1 text-lg font-medium text-slate-900">{presetItem.name}</div>
                        <div className="mb-3 text-sm leading-6 text-slate-500">{presetItem.desc}</div>
                        <div className="mb-4 flex flex-wrap gap-2">
                          {presetItem.tags.map((tag) => (
                            <Badge key={tag} className="border-0 bg-slate-100 text-slate-600">{tag}</Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => { setPreviewMode(presetItem.id); triggerPreview(presetItem.id); pushToast(`已启用「${presetItem.name}」`); }} className="flex-1 rounded-full bg-slate-950 text-white hover:bg-slate-800">一键启用</Button>
                          <Button variant="outline" onClick={() => pushToast(`已复制「${presetItem.name}」`)} className="rounded-full border-black/5 bg-white text-slate-700 hover:bg-slate-50">复制</Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Glass>

              <Glass className="p-5">
                <SectionTitle icon={Search} title="我的方案" sub="轻量管理，不做后台式列表" />
                <div className="space-y-3">
                  {mySchemes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[22px] bg-white px-4 py-4 ring-1 ring-black/5">
                      <div>
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-sm text-slate-500">{item.sub}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => pushToast(`已复制「${item.name}」`)} className="rounded-full border-black/5 bg-white hover:bg-slate-50"><Copy className="h-4 w-4" /></Button>
                        <Button variant="outline" onClick={() => pushToast(`已导出「${item.name}」`)} className="rounded-full border-black/5 bg-white hover:bg-slate-50"><Download className="h-4 w-4" /></Button>
                        <Button variant="outline" onClick={() => removeScheme(item.id)} className="rounded-full border-black/5 bg-white hover:bg-slate-50"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Glass>
            </>
          )}

          {tab === "edit" && (
            <>
              <Glass className="p-5">
                <SectionTitle icon={MousePointer2} title="左右键方案" sub="最常用的配置直接露出" />
                <div className="grid gap-4 md:grid-cols-2">
                  <button onClick={() => { setLeftEnabled((v) => !v); pushToast(leftEnabled ? "左键效果已关闭" : "左键效果已开启"); }} className="rounded-[22px] bg-white p-4 text-left ring-1 ring-black/5 transition hover:bg-slate-50">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900"><MousePointer2 className="h-4 w-4" /> 左键</div>
                      <Switch checked={leftEnabled} onCheckedChange={setLeftEnabled} />
                    </div>
                    <div className="text-sm text-slate-500">当前：木鱼修行</div>
                  </button>
                  <button onClick={() => { setRightEnabled((v) => !v); pushToast(rightEnabled ? "右键效果已关闭" : "右键效果已开启"); }} className="rounded-[22px] bg-white p-4 text-left ring-1 ring-black/5 transition hover:bg-slate-50">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900"><Pointer className="h-4 w-4" /> 右键</div>
                      <Switch checked={rightEnabled} onCheckedChange={setRightEnabled} />
                    </div>
                    <div className="text-sm text-slate-500">当前：游戏连击</div>
                  </button>
                </div>
              </Glass>

              <div className="grid gap-5 md:grid-cols-2">
                <CollapsibleCard title="文案" icon={Type}>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-sm text-slate-500">文案内容</div>
                      <Input defaultValue="功德+1" className="rounded-2xl border-black/5 bg-slate-50" />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                        <span>字号</span>
                        <span className="text-slate-900">{fontSize[0]} px</span>
                      </div>
                      <Slider value={fontSize} onValueChange={(v) => { setFontSize(v); triggerPreview(); }} min={12} max={40} step={1} />
                    </div>
                    <div>
                      <div className="mb-2 text-sm text-slate-500">文案颜色</div>
                      <div className="flex gap-3">
                        {["#F6D365", "#0F172A", "#60A5FA", "#FB7185", "#A78BFA"].map((c) => (
                          <button key={c} onClick={() => pushToast("已切换文案颜色")} className="h-9 w-9 rounded-full ring-1 ring-black/5 transition hover:scale-105" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="音效" icon={AudioLines}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">木鱼敲击音</div>
                        <div className="text-xs text-slate-500">preset://woodfish/hit</div>
                      </div>
                      <Button variant="outline" onClick={() => pushToast("试听成功")} className="rounded-full border-black/5 bg-white">试听</Button>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                        <span>音量</span>
                        <span className="text-slate-900">{volume[0]}%</span>
                      </div>
                      <Slider value={volume} onValueChange={(v) => { setVolume(v); triggerPreview(); }} min={0} max={100} step={1} />
                    </div>
                    <div className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                      <div className="text-sm text-slate-600">允许重叠播放</div>
                      <Switch checked />
                    </div>
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="粒子" icon={Sparkles}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {["点状", "星星", "图片"].map((t, i) => (
                        <button
                          key={t}
                          onClick={() => {
                            const mode = i === 1 ? "combo" : i === 2 ? "paw" : "woodfish";
                            setPreviewMode(mode);
                            triggerPreview(mode);
                          }}
                          className={cn("rounded-[20px] px-3 py-3 text-sm transition", i === 0 ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600 ring-1 ring-black/5 hover:bg-white")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                        <span>粒子数量</span>
                        <span className="text-slate-900">{particleCount[0]}</span>
                      </div>
                      <Slider value={particleCount} onValueChange={(v) => { setParticleCount(v); triggerPreview(); }} min={0} max={20} step={1} />
                    </div>
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="连击" icon={Flame}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                      <div className="text-sm text-slate-600">启用连击效果</div>
                      <Switch checked />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                        <span>时间窗口</span>
                        <span className="text-slate-900">{combo[0]} ms</span>
                      </div>
                      <Slider value={combo} onValueChange={(v) => { setCombo(v); setPreviewMode("combo"); triggerPreview("combo"); }} min={300} max={2500} step={100} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                      {["+1", "x5", "x10"].map((label) => (
                        <button key={label} onClick={() => { setPreviewMode("combo"); triggerPreview("combo"); }} className="rounded-[18px] bg-slate-50 px-3 py-3 ring-1 ring-black/5 hover:bg-white">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CollapsibleCard>
              </div>

              <Glass className="p-5">
                <SectionTitle icon={Settings2} title="高级设置" sub="默认折叠，避免复杂度一下子扑到脸上" />
                <div className="grid gap-4 md:grid-cols-3">
                  <CollapsibleCard title="图片 / 图标" icon={ImageIcon} defaultOpen={false}>
                    <div className="space-y-3 text-sm text-slate-500">
                      <div>上传贴纸、设置大小、透明度和入场方式。</div>
                      <Button variant="outline" onClick={() => pushToast("演示：已选择图片资源")} className="rounded-full border-black/5 bg-white">选择资源</Button>
                    </div>
                  </CollapsibleCard>

                  <CollapsibleCard title="光标" icon={Palette} defaultOpen={false}>
                    <div className="space-y-3 text-sm text-slate-500">
                      <div>根据区域切换鼠标状态，并在预览里即时反馈。</div>
                      <Button variant="outline" onClick={cycleCursor} className="rounded-full border-black/5 bg-white">切换光标状态</Button>
                    </div>
                  </CollapsibleCard>

                  <CollapsibleCard title="无障碍" icon={Shield} defaultOpen={false}>
                    <div className="space-y-3 text-sm text-slate-500">
                      <div className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                        <span>减少动画</span>
                        <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                      </div>
                      <div className="flex items-center justify-between rounded-[20px] bg-slate-50 px-4 py-3">
                        <span>静音模式</span>
                        <Switch checked={mute} onCheckedChange={setMute} />
                      </div>
                    </div>
                  </CollapsibleCard>
                </div>
              </Glass>
            </>
          )}

          {tab === "library" && (
            <Glass className="p-5">
              <SectionTitle icon={Search} title="方案库" sub="搜索、复制、快速试用" />
              <div className="mb-4 flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 ring-1 ring-black/5">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索预设名称、描述、标签"
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredPresets.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="rounded-[24px] bg-white p-4 ring-1 ring-black/5">
                      <div className={cn("mb-3 flex h-24 items-start justify-between rounded-[20px] bg-gradient-to-br p-4", item.tint)}>
                        <div className="rounded-2xl bg-white/60 p-2.5 text-slate-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <Badge className="border-0 bg-white/60 text-slate-700">预设</Badge>
                      </div>
                      <div className="text-base font-medium text-slate-900">{item.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.desc}</div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          onClick={() => {
                            setPreviewMode(item.id);
                            triggerPreview(item.id);
                            pushToast(`正在预览「${item.name}」`);
                          }}
                          className="flex-1 rounded-full bg-slate-950 text-white hover:bg-slate-800"
                        >
                          试用
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => pushToast(`已复制「${item.name}」`)}
                          className="rounded-full border-black/5 bg-white"
                        >
                          复制
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Glass>
          )}

          {tab === "settings" && (
            <Glass className="p-5">
              <SectionTitle icon={Settings2} title="基础设置" sub="插件开关、预览与声音行为" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] bg-white p-4 ring-1 ring-black/5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-600">静音模式</span>
                    <Switch checked={mute} onCheckedChange={setMute} />
                  </div>
                  <div className="text-xs text-slate-500">关闭所有演示音效</div>
                </div>

                <div className="rounded-[22px] bg-white p-4 ring-1 ring-black/5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-600">减少动画</span>
                    <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                  </div>
                  <div className="text-xs text-slate-500">降低高频动效强度</div>
                </div>

                <div className="rounded-[22px] bg-white p-4 ring-1 ring-black/5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-600">恢复默认</span>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFontSize([22]);
                        setVolume([78]);
                        setParticleCount([8]);
                        setCombo([1200]);
                        setCursorState("default");
                        setMute(false);
                        setReduceMotion(false);
                        pushToast("已恢复默认设置");
                        triggerPreview("woodfish");
                      }}
                      className="rounded-full border-black/5 bg-white"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> 重置
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">将常用参数恢复到初始状态</div>
                </div>
              </div>
            </Glass>
          )}
        </div>

        <div className="space-y-5">
          <Glass className="p-5">
            <SectionTitle
              icon={Eye}
              title="实时预览"
              sub="点击下方区域触发一次效果"
              action={
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  className="rounded-full border-black/5 bg-white"
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  放大
                </Button>
              }
            />
            <div onClick={() => triggerPreview(previewMode)}>
              <PopupPreviewStage
                mode={previewMode}
                trigger={previewTrigger}
                cursorState={cursorState}
              />
            </div>
          </Glass>

          <Glass className="p-5">
            <SectionTitle icon={Info} title="当前参数" />
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
              <div className="rounded-[18px] bg-white px-3 py-3 ring-1 ring-black/5">字号：{fontSize[0]} px</div>
              <div className="rounded-[18px] bg-white px-3 py-3 ring-1 ring-black/5">音量：{mute ? 0 : volume[0]}%</div>
              <div className="rounded-[18px] bg-white px-3 py-3 ring-1 ring-black/5">粒子：{particleCount[0]}</div>
              <div className="rounded-[18px] bg-white px-3 py-3 ring-1 ring-black/5">连击窗口：{combo[0]} ms</div>
            </div>
          </Glass>
        </div>
      </div>

      <AnimatePresence>
        {previewOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl rounded-[32px] bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">放大预览</div>
                  <div className="text-sm text-slate-500">点击区域可再次触发动画</div>
                </div>
                <Button variant="ghost" onClick={() => setPreviewOpen(false)} className="rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div onClick={() => triggerPreview(previewMode)}>
                <PopupPreviewStage
                  mode={previewMode}
                  trigger={previewTrigger}
                  cursorState={cursorState}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function CursorDanceDemo() {
  const [page, setPage] = useState("home");
  const [toast, setToast] = useState("");

  const pushToast = (text) => {
    setToast(text);
    if (typeof window !== "undefined") {
      window.clearTimeout(window.__cursorDanceToastTimer);
      window.__cursorDanceToastTimer = window.setTimeout(() => {
        setToast("");
      }, 2200);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc,#eef2ff)] p-6 text-slate-900">
      <AnimatePresence>
        {toast ? <TopToast text={toast} onClose={() => setToast("")} /> : null}
      </AnimatePresence>

      {page === "home" ? (
        <PopupHome openDetail={() => setPage("detail")} pushToast={pushToast} />
      ) : (
        <DetailPage goBack={() => setPage("home")} pushToast={pushToast} />
      )}
    </div>
  );
}
