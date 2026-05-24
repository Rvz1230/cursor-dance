import { motion } from "framer-motion";
import { MousePointerClick, Sparkles, Wand2, Volume2 } from "lucide-react";

const features = [
  {
    icon: MousePointerClick,
    title: "光标反馈",
    description:
      "点击波纹、拖尾光晕、状态切换动画。每一次鼠标交互都有视觉回响，让浏览变成一种享受。",
  },
  {
    icon: Sparkles,
    title: "粒子系统",
    description:
      "粒子数量、速度、颜色、形状、生命周期——全部可控。高性能 Web Animations API 驱动，不拖慢页面。",
  },
  {
    icon: Wand2,
    title: "AI 配色助手",
    description:
      "描述你想要的风格，AI 自动生成完整配色方案。一键套用，无需从零调参。",
  },
  {
    icon: Volume2,
    title: "音效同步",
    description:
      "点击音效与视觉特效同步触发。支持自定义音频、音量 Duck 压缩，让反馈更立体。",
  },
];

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            一切皆可定制
          </h2>
          <p className="text-white/25 text-lg max-w-xl mx-auto">
            6 种光标状态 &times; 50+ 可调参数 &times; 无限主题组合
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={item} className="glass-card p-8 group">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-5 group-hover:bg-violet-500/15 transition-colors">
                <f.icon size={22} className="text-violet-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2.5">{f.title}</h3>
              <p className="text-white/25 text-sm leading-relaxed">
                {f.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
