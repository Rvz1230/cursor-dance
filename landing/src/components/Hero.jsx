import DemoArea from "./DemoArea.jsx";
import { useToast } from "./Toast.jsx";

const scrollToDemo = () => {
  const demo = document.querySelector(".cursor-crosshair");
  if (demo) demo.scrollIntoView({ behavior: "smooth", block: "center" });
};

export default function Hero({ activePresetId, onPresetChange }) {
  const showToast = useToast();
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Central glow orb — z-30 so nothing paints over it */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none z-30"
        style={{
          boxShadow:
            "0 0 80px rgba(139,92,246,.25), 0 0 160px rgba(59,130,246,.12)",
        }}
      />

      {/* Text content */}
      <div className="relative z-20 text-center px-6 max-w-4xl mx-auto pt-28 pb-8">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/50 text-xs font-medium px-3 py-1.5 rounded-full mb-8 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Chrome Extension &middot; Manifest V3
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-none tracking-tight mb-6">
          让你的光标
          <br />
          <span className="text-gradient">跳起舞来</span>
        </h1>

        <p className="text-lg md:text-xl text-white/35 max-w-lg mx-auto mb-10 leading-relaxed">
          为你的浏览器注入灵魂。粒子、光晕、波纹——
          <br />
          每一个点击都是一场微型演出。
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); showToast("即将上架 Chrome Web Store，敬请期待"); scrollToDemo(); }}
            className="inline-flex items-center justify-center bg-white text-gray-900 px-8 py-3.5 rounded-full font-semibold text-base hover:bg-gray-100 transition shadow-lg shadow-violet-500/20"
          >
            免费安装
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center border border-white/15 text-white/60 px-8 py-3.5 rounded-full font-semibold text-base hover:border-white/30 hover:text-white/80 transition"
          >
            了解更多
          </a>
        </div>
      </div>

      {/* Interactive Demo Area — showcases actual CursorDance effects */}
      <DemoArea activePresetId={activePresetId} onPresetChange={onPresetChange} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent z-20 pointer-events-none" />
    </section>
  );
}
