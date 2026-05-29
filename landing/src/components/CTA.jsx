import { motion } from "framer-motion";
import InstallButton from "./InstallButton.jsx";

export default function CTA() {
  return (
    <section className="py-24 md:py-32 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="relative rounded-3xl overflow-hidden bg-white/[0.02] border border-white/[0.06] px-8 py-16 md:py-20 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          {/* Glow behind text */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">
              准备好让你的光标
              <span className="text-gradient"> 跳舞 </span>
              了吗？
            </h2>
            <p className="text-white/45 text-lg mb-10 max-w-md mx-auto">
              免费安装，即装即用。让你的每一次点击都充满惊喜。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <InstallButton className="px-10 py-4 text-base" />
              <a
                href="https://github.com/Rvz1230/cursor-dance"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-white/40 hover:text-white/70 transition text-sm"
              >
                在 GitHub 上查看源码 &rarr;
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
