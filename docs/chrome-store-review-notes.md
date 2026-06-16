# CursorDance Chrome 商店审核备忘

## 单一用途

CursorDance 为网页添加可定制的光标状态和鼠标反馈效果。用户可在选项页配置点击飘字、粒子、波纹、可选音效、光标图案，以及 AI 辅助方案提案。

## 权限说明

### `storage`

在 Chrome 扩展本地存储中保存用户的 CursorDance 配置、已选主题、站点规则和上传的光标素材。

### `activeTab`

用户从 Popup 或工作台预览主题时使用。CursorDance 仅向当前活动标签页发送预览消息，让用户在保存前查看效果。

### `unlimitedStorage`

用于存储用户提供的光标图片和特效素材。CursorDance 以 Data URL 形式在本地存储这些素材，并在代码中限制单个光标图片的大小。此权限避免用户在创建多个主题时触发 Chrome 本地存储配额限制。

### Content Script 匹配范围

CursorDance 在 `http://*/*` 和 `https://*/*` 上运行，因为其核心功能是网页光标和指针反馈。内容脚本不会为 AI 功能读取页面文本，也不会将浏览历史发送至 AI 后端。

### `host_permissions`

源文件 `extension/manifest.json` 不包含宽泛的远程主机权限。构建打包扩展时运行：

```bash
npm run build
CURSORDANCE_EXTENSION_HOST_PERMISSIONS=https://YOUR_API_DOMAIN/* npm run extension:prepare-manifest
```

脚本会将精确的 API 源写入 `dist/manifest.json`。会拒绝宽泛的通配符主机模式。

## AI 数据披露

CursorDance 包含可选的 AI 方案助手。用户提交 AI 请求时，CursorDance 发送：

- 用户输入的提示文本
- 当前动作配置
- 精简的待处理提案上下文（如有）
- 任务模式
- 扩展版本
- schema 版本

CursorDance 不会发送完整的可见聊天历史。后端不得记录完整的提示、配置、模型提示或模型原始响应。仅记录隐私安全的运维指标（字节大小、状态码、耗时、模式、丢弃字段数）。

AI 提案不会自动应用。模型输出经过白名单清洗后展示给用户，仅在确认后应用。

## 远程代码声明

CursorDance 不在扩展中执行远程代码。AI 响应被视为 JSON 数据提案。返回的字段在使用前经过清洗和数值钳位。

## 数据出售与广告

CursorDance 不出售用户数据，不使用用户数据用于广告。不收集遥测数据或使用统计。

## 商店上架清单

- [ ] 使用生产环境 `VITE_CURSORDANCE_AI_API_ENDPOINT` 构建。
- [ ] 使用精确的 API 主机权限运行 `npm run extension:prepare-manifest`。
- [ ] 确认 `dist/manifest.json` 中没有 `https://*/*` 或 `<all_urls>` 主机权限。
- [ ] 确认 `dist/manifest.json` 仅使用 `storage`、`activeTab` 和 `unlimitedStorage`。
- [ ] 确认隐私政策和支持页面 URL 已发布并可公开访问。
- [ ] 确认 AI 后端日志不包含完整提示或配置体。
