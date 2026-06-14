# CursorDance 桌面版开发进度

> 每个任务完成后更新对应的 checkbox。当前状态随时反映最新进度。

## 阶段零：代码梳理
- [x] 任务 0.0：创建 StorageAdapter 接口 → 新建 `src/shared/storage/StorageAdapter.ts`
- [x] 任务 0.1：提取 WorkbenchControls 通用组件 → 7 个组件移到 `src/components/ui/`
- [x] 任务 0.2：迁移纯函数文件 → compute-specs, action-config, text-semantics → `.ts`

## 阶段一：项目脚手架
- [x] 任务 1.0：安装 Electron 依赖
- [x] 任务 1.1：配置 electron-vite + 创建最小入口
- [x] 任务 1.2：创建目录结构和占位文件

## 阶段二：效果引擎迁移
- [x] 任务 2.0：创建引擎 DI 类型和入口
- [x] 任务 2.1：迁移 visual-effects.ts
- [x] 任务 2.2：迁移 cursor-overlay.ts
- [x] 任务 2.3：迁移 audio.ts
- [x] 任务 2.4：迁移 trigger-handlers.ts
- [x] 任务 2.5：迁移其余引擎模块
- [x] 任务 2.6：主进程鼠标事件捕获
- [x] 任务 2.7：overlay 窗口和引擎连线
- [x] 任务 2.8：Workbench 预览对接引擎
- [x] 任务 2.9：补全 4 套内置主题 5 个 action 默认配置

## 阶段三：存储与通信
- [x] 任务 3.0：实现 ElectronStoreAdapter
- [x] 任务 3.0.5：桌面 workbench 注入 runtime config 全局
- [x] 任务 3.1：主题导入导出适配
- [x] 任务 3.2：get-windows 集成

## 阶段四：UI 迁移
- [x] 任务 4.0：Workbench 自绘标题栏
- [x] 任务 4.1：系统托盘
- [x] 任务 4.2：应用规则面板改造
- [x] 任务 4.3：首次启动引导 + 空状态

## 阶段五：AI API 服务
- [x] 任务 5.0：嵌入 AI 服务

## 阶段六：构建与打包
- [ ] 任务 6.0：electron-builder 配置
- [ ] 任务 6.1：自动更新 + CI

---

## 当前状态

- **分支**：desktop/phase-0
- **上次提交**：阶段四 4.3
- **阻塞项**：无
- **扩展状态**：`npm run test` 191 tests / 27 files 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 5.0 完成 —— 桌面端嵌入 cursor-dance-api。新增 `src/main/api-server.ts`：用 `net.createServer().listen(port, '127.0.0.1')` 探测端口可用性，默认 8787，被占用时退到 OS 分配（port 0），启动前先 `syncEnvFromSettings()` + `configureRateLimiter(process.env)`，导出 `start/stop/getEndpoint` 三个 API。新增 `src/main/ai-config.ts`：用独立 electron-store（name: cursordance-ai）存 AI 配置，apiKey 走 `safeStorage.encryptString` 写入 `apiKeyCipher`（base64），`safeStorage` 不可用时退化为 `apiKeyPlain` 明文槽位；写入时主动清掉对侧槽位避免切换 keychain 状态后两个槽位并存；`readSettingsView()` 只回 `{hasApiKey, baseUrl, model, apiMode, accessToken}`，不向 renderer 暴露 apiKey 明文；`syncEnvFromSettings()` 把 `CURSORDANCE_AI_API_KEY` / `OPENAI_API_KEY` / baseUrl / model / apiMode / accessToken 注入 process.env，空值同步删 env。新增 `src/main/ai-ipc.ts`：注册 `cursordance:ai-get-runtime-config` / `ai-get-user-settings` / `ai-set-user-settings` 三个 ipcMain.handle。`src/main/index.ts` 在 whenReady 里 `registerAiIpc + startEmbeddedAiServer`，`before-quit` 里反注册。preload 扩展 `cursorDanceAi` bridge（getRuntimeConfig / getSettings / setSettings），`vite-env.d.ts` 同步 4 个新 interface。renderer entry 用 top-level await `installAiEndpointGlobals()` 把 `globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT` 等 4 个全局注入 React mount 之前，cursor-dance-api/src/client.js 同步读取这些全局即可工作。新增 `components/AiSettingsDialog.tsx`：三个 provider 预设（DeepSeek / OpenAI / 自定义）+ Base URL / Model / API Key 表单 +「已保存」徽章 +「清除已保存的 API key」按钮，apiKey 留空不下发避免覆盖已存值。`TitleBar` 加 Settings 齿轮按钮（仅桌面端），`ThemeWorkbenchPage` 在 `window.cursorDanceAi` 存在时挂载 dialog。新增 `ai-config.test.ts` 9 tests 覆盖加密 round-trip、视图脱敏、空值清除、明文退化、env sync、槽位切换。下一步任务 6.0 electron-builder 打包配置。
