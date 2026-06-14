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
- [ ] 任务 4.2：应用规则面板改造
- [ ] 任务 4.3：首次启动引导 + 空状态

## 阶段五：AI API 服务
- [ ] 任务 5.0：嵌入 AI 服务

## 阶段六：构建与打包
- [ ] 任务 6.0：electron-builder 配置
- [ ] 任务 6.1：自动更新 + CI

---

## 当前状态

- **分支**：desktop/phase-0
- **上次提交**：阶段四 4.0
- **阻塞项**：无
- **扩展状态**：`npm run test` 176 tests 全绿,`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 4.1 完成 —— 系统托盘 + 全局 enabled 同步。新建 `src/main/tray.ts`:`createTray(deps)` 接受 `iconPath / openWorkbench / quitApp / isEnabled / toggleEnabled / onEnabledChange`,对存储无感(依赖注入)。菜单结构:[暂停/开启效果, 分隔, 打开工作台, 分隔, 退出 CursorDance]。macOS 走 `nativeImage.setTemplateImage(true)` 让状态栏明暗自动反色;左键 `tray.on('click')` 直接打开 workbench(覆盖 macOS 默认弹菜单),右键走 contextMenu。enabled 变更通过 onEnabledChange 订阅 → `Menu.buildFromTemplate` 重建上下文菜单。`destroyTray()` 退订 listener + `tray.destroy()`,并在 `before-quit` 调用。重复 `createTray` 自动 destroy 上一个 handle(兼容热重载)。`src/main/index.ts` 接线:`getEnabledFromStore()` 从 `electron-store.cursordance.config.enabled` 读,未写入默认 `true`(与扩展端 `normalizeStoredConfig` 默认一致);`toggleEnabled()` 写回 store 后由 `STORE_CHANGED` 自动广播给所有 renderer,`onConfigChange` 兜底同步 overlay 显隐(show/hide 而不是 destroy,便宜)。`openWorkbench()` 复用现有 window:minimize 时 restore + show + focus,否则 `createWorkbenchWindow()` 重建。`resolveTrayIconPath()` dev 走 `__dirname/../../public/icon-16.png`(prod 留待任务 6.0 接 extraResources)。新增 `tray.test.ts` 11 用例(菜单 label / 结构 / 各项 click / 初次构建 / tray click / onEnabledChange 重建 / destroy 退订 / 重复 createTray);mock `electron` 用 `vi.hoisted` 处理 hoist 顺序。下一步任务 4.2 应用规则面板改造。
