import { motion } from "framer-motion";
import { Download, Palette, Globe } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Download,
    title: "安装插件",
    description:
      "从 Chrome Web Store 一键安装，不到 10 秒。无需注册，无需额外配置。",
  },
  {
    num: "02",
    icon: Palette,
    title: "选择主题",
    description:
      "从内置主题库挑选，或用 AI 配色助手一键生成。50+ 参数实时预览，所见即所得。",
  },
  {
    num: "03",
    icon: Globe,
    title: "所有网页生效",
    description:
      "打开任何网页，光标特效即刻生效。可按站点设置不同主题，工作娱乐互不干扰。",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const card = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-blue-400 text-sm font-semibold tracking-wider uppercase mb-3">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            三步，开始跳舞
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            从安装到生效，三分钟搞定
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-8 relative"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-gradient-to-r from-violet-500/30 via-blue-500/30 to-cyan-500/30" />

          {steps.map((s) => (
            <motion.div key={s.num} variants={card} className="relative text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/8 mb-6 relative z-10">
                <s.icon size={26} className="text-violet-400" />
              </div>
              <div className="text-xs font-bold text-violet-500/50 mb-2">{s.num}</div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
                {s.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
