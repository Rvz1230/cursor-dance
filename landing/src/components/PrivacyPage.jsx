import PageLayout from "./PageLayout.jsx";

export default function PrivacyPage() {
  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">隐私政策</h1>
        <p className="text-white/25 text-sm mb-10">最后更新：2026 年 5 月 29 日</p>

        <div className="space-y-8 text-white/50 leading-relaxed">
          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">1. 本地存储的信息</h2>
            <p>
              CursorDance 将以下配置数据<strong className="text-white/60">仅保存在用户本地浏览器的 Chrome Storage 中</strong>，
              不会上传至任何服务器：
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>主题配置（特效参数、颜色、粒子、波纹、音效等）</li>
              <li>站点规则（按域名自定义启用/禁用和主题绑定）</li>
              <li>用户上传的光标图片和特效素材（以 Data URL 形式存储）</li>
              <li>AI 对话面板的本地消息记录</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">2. 可选 AI 方案助手</h2>
            <p>AI 方案助手是可选功能。当您主动提交 AI 请求时，CursorDance 仅发送以下必要信息至 CursorDance AI 后端：</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>您输入的提示文本</li>
              <li>当前主题的动作配置</li>
              <li>任务模式（快速模式 / Agent 模式）</li>
              <li>扩展版本号和 schema 版本号</li>
              <li>待处理提案的简要上下文（如有）</li>
            </ul>
            <p className="mt-3">
              <strong className="text-white/60">不会发送的内容：</strong>完整的可见聊天历史、浏览历史、网页内容、页面文本。
            </p>
            <p className="mt-1">
              AI 生成的方案<strong className="text-white/60">不会自动应用</strong>。
              模型输出经过白名单过滤、类型校验、数值钳位后展示给您，仅在您手动确认后才会写入配置。
            </p>
            <p className="mt-1">
              清除 AI 对话会移除本地面板消息和待处理提案上下文，不会影响已应用的配置。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">3. AI 请求的第三方处理</h2>
            <p>
              AI 请求由 CursorDance AI 后端转发至配置的模型服务商（默认为 DeepSeek）进行处理。
              使用 AI 功能即表示您同意将上述必要信息传输至第三方 AI 服务商以生成配置方案。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">4. 后端日志策略</h2>
            <p>
              CursorDance 后端<strong className="text-white/60">不会记录</strong>以下内容：
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>完整的用户提示文本</li>
              <li>完整的配置数据</li>
              <li>模型发送的完整提示</li>
              <li>模型返回的原始响应</li>
              <li>模型服务商的 API 密钥</li>
            </ul>
            <p className="mt-3">
              仅记录隐私安全的运维指标：请求大小、提示长度、任务模式、状态码、错误码、耗时、丢弃字段数。
              可通过环境变量 <code className="text-white/40 bg-white/5 px-1 rounded">CURSORDANCE_AI_METRICS_LOG=0</code> 完全关闭指标日志。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">5. 权限说明</h2>
            <p>CursorDance 需要以下浏览器权限以提供核心功能：</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong className="text-white/60">storage</strong> — 在本地 Chrome 扩展存储中保存主题配置、站点规则和用户偏好。
              </li>
              <li>
                <strong className="text-white/60">activeTab</strong> — 从 Popup 或工作台预览主题时，向当前活动标签页发送预览消息，让用户实时查看效果。
              </li>
              <li>
                <strong className="text-white/60">unlimitedStorage</strong> — 存储用户上传的光标图片和特效素材。CursorDance 在代码中对单个光标图片的 Data URL 大小设有限制。此权限避免用户在创建多个主题时触发 Chrome 本地存储配额限制。
              </li>
              <li>
                <strong className="text-white/60">host_permissions</strong> — 仅对 CursorDance AI API 域名生效，用于 AI 方案助手请求。内容脚本运行在 <code className="text-white/40 bg-white/5 px-1 rounded">http://*/*</code> 和 <code className="text-white/40 bg-white/5 px-1 rounded">https://*/*</code> 上是因为光标反馈功能需要在用户访问的网页上渲染效果。内容脚本<strong className="text-white/60">不会</strong>为 AI 功能读取页面文本，也<strong className="text-white/60">不会</strong>将浏览历史发送至 AI 后端。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">6. 数据共享与广告</h2>
            <p>
              CursorDance <strong className="text-white/60">不出售用户数据</strong>，
              <strong className="text-white/60">不使用用户数据用于广告</strong>。
              CursorDance 不收集遥测数据、使用统计或用户行为分析数据。
            </p>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">7. 用户控制</h2>
            <p>您可以随时：</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>通过 Popup 开关禁用 CursorDance</li>
              <li>创建、修改、删除主题配置</li>
              <li>删除上传的光标素材</li>
              <li>清除 AI 对话面板中的对话历史</li>
              <li>从 Chrome 中卸载扩展以彻底移除所有本地数据</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white/80 text-lg font-semibold mb-3">8. 联系我们</h2>
            <p>
              如果您对本隐私政策有任何疑问，请通过 GitHub Issues 联系我们：
              <br />
              <a
                href="https://github.com/Rvz1230/cursor-dance"
                className="text-violet-400 hover:text-violet-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/Rvz1230/cursor-dance
              </a>
            </p>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
