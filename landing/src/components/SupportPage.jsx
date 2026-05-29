import PageLayout from "./PageLayout.jsx";

export default function SupportPage() {
  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">帮助支持</h1>
        <p className="text-white/40 text-sm mb-10">安装、使用和常见问题</p>

        <div className="space-y-8 text-white/50 leading-relaxed">
          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">如何安装</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>打开 Chrome 浏览器，访问 Chrome Web Store</li>
              <li>搜索 "CursorDance" 或直接点击安装链接</li>
              <li>点击 "添加到 Chrome" 按钮</li>
              <li>安装完成后，浏览器右上角会出现 CursorDance 图标</li>
            </ol>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">如何使用</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>点击浏览器右上角的 CursorDance 图标打开弹出面板</li>
              <li>从主题列表中选择一个预设主题，或点击 "打开工作台" 自定义</li>
              <li>选择主题后，打开任何网页即可看到光标特效</li>
              <li>在工作台中，你可以编辑粒子、波纹、飘字、音效等所有参数</li>
            </ol>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">常见问题</h2>

            <div className="space-y-5">
              <div>
                <h3 className="text-white/60 font-medium mb-1">Q: 特效不显示？</h3>
                <p>A: 请检查：① 插件是否已启用 ② 当前站点是否在站点规则中被禁用 ③ 刷新页面后重试。</p>
              </div>
              <div>
                <h3 className="text-white/60 font-medium mb-1">Q: 如何在不同网站使用不同主题？</h3>
                <p>A: 在工作台的 "站点规则" 面板中，可以为每个网站单独配置主题。</p>
              </div>
              <div>
                <h3 className="text-white/60 font-medium mb-1">Q: 会影响网页性能吗？</h3>
                <p>A: CursorDance 使用 Web Animations API 和 GPU 加速渲染，经过优化不会明显影响页面加载和滚动性能。</p>
              </div>
              <div>
                <h3 className="text-white/60 font-medium mb-1">Q: 如何备份我的主题？</h3>
                <p>A: 在工作台的主题库侧栏中，可以导出主题包为 JSON 文件，也可以导入他人分享的主题。</p>
              </div>
              <div>
                <h3 className="text-white/60 font-medium mb-1">Q: 遇到 Bug 怎么反馈？</h3>
                <p>
                  A: 请在{" "}
                  <a href="https://github.com/Rvz1230/cursor-dance/issues" className="text-violet-400 hover:text-violet-300 transition-colors" target="_blank" rel="noopener noreferrer">
                    GitHub Issues
                  </a>{" "}
                  提交问题报告，附上浏览器版本、插件版本和问题描述。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
