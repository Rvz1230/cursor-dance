import { useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PRESETS } from "../lib/presets.js";

const COMBO_WINDOW = 800;

export default function DemoArea({ activePresetId, onPresetChange }) {
  const [effects, setEffects] = useState([]);
  const activePreset = PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
  const containerRef = useRef(null);
  const lastClickRef = useRef(0);
  const comboRef = useRef(0);
  const effectIdRef = useRef(0);

  const removeEffect = useCallback((id) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addParticles = useCallback((x, y, count, opts = {}) => {
    const preset = PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
    const colors = opts.colors || preset.particleColors;
    const newEffects = [];
    for (let i = 0; i < count; i++) {
      const id = ++effectIdRef.current;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 70;
      newEffects.push({
        id,
        type: "particle",
        x,
        y,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        color: colors[i % colors.length],
        size: (opts.size || 3) + Math.random() * 4,
        duration: 0.6 + Math.random() * 0.4,
      });
    }
    setEffects((prev) => [...prev, ...newEffects]);
  }, [activePresetId]);

  const addRipple = useCallback((x, y, opts = {}) => {
    const preset = PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
    const id = ++effectIdRef.current;
    setEffects((prev) => [...prev, {
      id,
      type: "ripple",
      x,
      y,
      color: opts.color || preset.rippleColor,
      size: opts.size || 80,
    }]);
  }, [activePresetId]);

  const addText = useCallback((x, y, text, opts = {}) => {
    const preset = PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
    const id = ++effectIdRef.current;
    setEffects((prev) => [...prev, {
      id,
      type: "text",
      x,
      y,
      text,
      color: opts.color || preset.textColor,
      fontSize: opts.fontSize || 20,
    }]);
  }, [activePresetId]);

  const handleClick = useCallback(
    (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const now = Date.now();
      const elapsed = now - lastClickRef.current;
      lastClickRef.current = now;

      if (elapsed < COMBO_WINDOW) {
        comboRef.current += 1;
      } else {
        comboRef.current = 1;
      }

      const combo = comboRef.current;
      addParticles(x, y, 8 + Math.min(combo, 3) * 2);
      addRipple(x, y, { size: 60 + combo * 10 });
      addText(x, y, `+${combo}`, {
        fontSize: 18 + Math.min(combo, 5) * 4,
        color: combo >= 5 ? "#fbbf24" : combo >= 3 ? activePreset.textColor : activePreset.textColor,
      });

      if (elapsed < 320 && elapsed > 80) {
        addParticles(x, y, 14, { colors: ["#fbbf24", "#f59e0b", "#f97316", "#fbbf24", "#f59e0b"] });
        addRipple(x, y, { size: 100, color: "rgba(251,191,36,0.5)" });
        addText(x, y - 20, "combo!", { fontSize: 22, color: "#fbbf24" });
      }
    },
    [addParticles, addRipple, addText, activePresetId]
  );

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addParticles(x, y, 10, { colors: ["#f87171", "#fb923c", "#fbbf24", "#f87171", "#fb923c"] });
      addRipple(x, y, { size: 70, color: "rgba(248,113,113,0.5)" });
    },
    [addParticles, addRipple]
  );

  const handlePresetChange = useCallback((preset) => {
    onPresetChange?.(preset.id);
    comboRef.current = 0;
    lastClickRef.current = 0;
  }, [onPresetChange]);

  return (
    <div className="relative z-20 w-full max-w-2xl mx-auto px-6 pb-16">
      {/* Preset selector */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetChange(preset)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-violet-400 outline-none ${
              activePreset.id === preset.id
                ? "bg-violet-500/20 border border-violet-500/30 text-violet-300"
                : "bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/15"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Browser window */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] cursor-crosshair select-none"
        role="region"
        aria-label="交互演示区 — 点击查看粒子、波纹和飘字效果"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 mx-3 bg-white/[0.04] rounded-md px-3 py-1 text-[11px] text-white/25 text-center font-medium">
            any-website.com
          </div>
        </div>

        {/* Simulated page content */}
        <div className="px-8 py-10 space-y-5 min-h-[280px] relative">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 select-text">
            <h3 className="text-white/60 text-lg font-semibold mb-1.5">欢迎体验</h3>
            <p className="text-white/20 text-sm leading-relaxed max-w-md">
              当前预设：
              <span className="text-white/50 font-medium">{activePreset.label}</span>
              — 点击任意位置查看粒子、波纹、飘字效果。连续快速点击体验连击！
            </p>
          </div>

          <div className="relative z-10 flex gap-3">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.06] text-white/50 text-xs font-medium">
              点击这里
            </span>
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.06] text-white/50 text-xs font-medium">
              试试双击
            </span>
          </div>

          <div className="relative z-10 max-w-xs rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 select-text">
            <p className="text-white/25 text-xs leading-relaxed">
              右键点击触发另一种效果。上方按钮可切换不同主题预设。
            </p>
          </div>

          {/* Effects layer */}
          <AnimatePresence>
            {effects.map((ef) => {
              if (ef.type === "particle") {
                return (
                  <motion.div
                    key={ef.id}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 0.9 }}
                    animate={{ x: ef.tx, y: ef.ty, scale: 0, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: ef.duration, ease: "easeOut" }}
                    onAnimationComplete={() => removeEffect(ef.id)}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      left: ef.x,
                      top: ef.y,
                      width: ef.size,
                      height: ef.size,
                      background: ef.color,
                      boxShadow: `0 0 8px ${ef.color}`,
                    }}
                  />
                );
              }
              if (ef.type === "ripple") {
                return (
                  <motion.div
                    key={ef.id}
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    onAnimationComplete={() => removeEffect(ef.id)}
                    className="absolute rounded-full border-2 pointer-events-none"
                    style={{
                      left: ef.x,
                      top: ef.y,
                      width: ef.size,
                      height: ef.size,
                      marginLeft: -ef.size / 2,
                      marginTop: -ef.size / 2,
                      borderColor: ef.color,
                    }}
                  />
                );
              }
              if (ef.type === "text") {
                return (
                  <motion.div
                    key={ef.id}
                    initial={{ marginTop: 0, opacity: 0.95, scale: 0.8 }}
                    animate={{ marginTop: -60, opacity: 0, scale: 1.1 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    onAnimationComplete={() => removeEffect(ef.id)}
                    className="absolute pointer-events-none font-bold select-none"
                    style={{
                      left: ef.x,
                      top: ef.y,
                      transform: "translate(-50%, -50%)",
                      color: ef.color,
                      fontSize: ef.fontSize,
                      textShadow: `0 4px 12px ${ef.color}44`,
                    }}
                  >
                    {ef.text}
                  </motion.div>
                );
              }
              return null;
            })}
          </AnimatePresence>

          <div className="absolute bottom-3 right-4 z-20 text-white/20 text-[10px] pointer-events-none select-text">
            点击任意位置查看效果
          </div>
        </div>
      </div>
    </div>
  );
}
