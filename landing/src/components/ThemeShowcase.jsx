import { motion } from "framer-motion";
import ThemePreview from "./ThemePreview.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

const themes = [
  {
    name: "极光之舞",
    desc: "紫蓝渐变粒子，模拟北极光效果",
    gradient: "from-violet-500/20 via-blue-500/10 to-cyan-500/20",
    previewId: "aurora",
  },
  {
    name: "烈焰涟漪",
    desc: "橙红暖色波纹，点击如火焰绽放",
    gradient: "from-orange-500/20 via-red-500/10 to-rose-500/20",
    previewId: "flame",
  },
  {
    name: "极简轻量",
    desc: "半透明拖尾光晕，不打扰的优雅",
    gradient: "from-white/[0.04] via-white/[0.02] to-white/[0.01]",
    previewId: "minimal",
  },
  {
    name: "霓虹都市",
    desc: "赛博朋克风格，霓虹色粒子爆发",
    gradient: "from-pink-500/20 via-fuchsia-500/10 to-cyan-400/20",
    previewId: "neon",
  },
  {
    name: "星尘轨迹",
    desc: "金色粒子拖尾，鼠标划过如流星",
    gradient: "from-amber-400/20 via-yellow-500/10 to-orange-400/20",
    previewId: "stardust",
  },
  {
    name: "深海波纹",
    desc: "蓝绿色涟漪扩散，如水面触感",
    gradient: "from-teal-400/20 via-cyan-500/10 to-blue-500/20",
    previewId: "ocean",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const card = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
};

export default function ThemeShowcase({ onSelectPreset }) {
  const handleCardClick = (previewId, e) => {
    e.preventDefault();
    onSelectPreset?.(previewId);
    const demo = document.querySelector(".cursor-crosshair");
    if (demo) {
      demo.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  return (
    <section id="themes" className="py-24 md:py-32 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-cyan-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Theme Gallery
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            精选主题
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            从内置主题库开始，或用 AI 生成属于自己的独特风格
          </p>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {themes.map((t) => (
            <motion.div
              key={t.name}
              variants={card}
              role="button"
              tabIndex={0}
              aria-label={`选择主题：${t.name}`}
              onClick={(e) => handleCardClick(t.previewId, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(t.previewId, e);
                }
              }}
              className="glass-card overflow-hidden group cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f] outline-none"
            >
              <div className={`h-36 bg-gradient-to-br ${t.gradient} relative flex items-center justify-center`}>
                <ErrorBoundary fallback={<div className="absolute inset-0 bg-white/[0.02]" />}>
                  <ThemePreview themeId={t.previewId} />
                </ErrorBoundary>
              </div>
              <div className="p-5">
                <h3 className="font-semibold mb-1.5">{t.name}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{t.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
