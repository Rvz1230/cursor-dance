import PageLayout from "./PageLayout.jsx";

export default function AboutPage() {
  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">关于 CursorDance</h1>
        <p className="text-white/40 text-sm mb-10">让你的光标跳起舞来</p>

        <div className="space-y-10 text-white/50 leading-relaxed">
          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">项目简介</h2>
            <p>
              CursorDance 是一个 Chrome 浏览器扩展，为你的光标添加粒子特效、波纹动画、飘字反馈和音效。
              灵感来源于让日常的浏览体验变得更有趣——每一次点击都是一场微型演出。
            </p>
            <p className="mt-3">
              基于 Manifest V3 构建，使用 Web Animations API 实现高性能渲染，支持 6 种光标状态、50+ 可调参数，
              以及 AI 驱动的配色方案生成。完全开源，代码托管在 GitHub。
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["React", "Vite", "Tailwind CSS", "Web Animations API", "Chrome Extension", "Manifest V3"].map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/30 text-xs">
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">联系作者</h2>
            <div className="space-y-2">
              <p>
                GitHub Issues（推荐）：{" "}
                <a href="https://github.com/Rvz1230/cursor-dance/issues" className="text-violet-400 hover:text-violet-300 transition-colors" target="_blank" rel="noopener noreferrer">
                  github.com/Rvz1230/cursor-dance/issues
                </a>
              </p>
              <p>
                邮箱：{" "}
                <a href="mailto:rvz1230@163.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                  rvz1230@163.com
                </a>
              </p>
              <p>
                微信：<span className="text-white/50">Rvz1230</span>
              </p>
              <p className="text-white/25 text-sm mt-3">
                我是个人开发者，会尽力及时回复。如遇 Bug 请优先使用 GitHub Issues，方便跟踪处理进度。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">更新记录</h2>
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-medium">v1.0.0</span>
                  <span className="text-white/20 text-xs">2026-05-25</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  <li>首次发布</li>
                  <li>6 种光标状态 × 50+ 可调参数</li>
                  <li>粒子爆发、波纹扩散、飘字反馈、音效同步</li>
                  <li>AI 配色助手</li>
                  <li>站点规则（不同网站不同主题）</li>
                  <li>主题导入/导出</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
