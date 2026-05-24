import PageLayout from "./PageLayout.jsx";

export default function PrivacyPage() {
  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">隐私政策</h1>
        <p className="text-white/25 text-sm mb-10">最后更新：2026 年 5 月 24 日</p>

        <div className="space-y-8 text-white/50 leading-relaxed">
          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">1. 信息收集</h2>
            <p>
              CursorDance 浏览器插件本身<strong className="text-white/60">不收集、不存储、不传输任何用户的个人信息</strong>。
              所有主题配置和偏好设置仅保存在用户本地浏览器的 Chrome Storage 中，不会上传至任何服务器。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">2. 可选 AI 功能</h2>
            <p>
              如果您主动使用 AI 配色助手功能，您的文本描述将被发送至 AI 模型服务商（DeepSeek）的 API 进行处理。
              此过程仅用于生成配色方案，我们不会在服务器端存储您的请求内容。使用 AI 功能即表示您同意将描述文本传输至第三方 AI 服务商。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">3. 权限说明</h2>
            <p>
              CursorDance 需要以下浏览器权限以提供核心功能：
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white/60">storage</strong> — 本地存储主题配置和用户偏好</li>
              <li><strong className="text-white/60">activeTab</strong> — 在当前激活的标签页上渲染光标特效</li>
              <li><strong className="text-white/60">host permissions</strong> — 在用户访问的网页上注入内容脚本以显示效果</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">4. 第三方服务</h2>
            <p>
              CursorDance 官网使用 Google Fonts 提供字体展示。Google Fonts 可能收集匿名使用数据，详情请参阅 Google 的隐私政策。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">5. 联系我们</h2>
            <p>
              如果您对本隐私政策有任何疑问，请通过 GitHub Issues 联系我们：
              <br />
              <a href="https://github.com/Rvz1230/cursor-dance" className="text-violet-400 hover:text-violet-300 transition-colors" target="_blank" rel="noopener noreferrer">
                github.com/Rvz1230/cursor-dance
              </a>
            </p>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
