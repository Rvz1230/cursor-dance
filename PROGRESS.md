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
- [ ] 任务 2.1：迁移 visual-effects.ts
- [ ] 任务 2.2：迁移 cursor-overlay.ts
- [ ] 任务 2.3：迁移 audio.ts
- [ ] 任务 2.4：迁移 trigger-handlers.ts
- [ ] 任务 2.5：迁移其余引擎模块
- [ ] 任务 2.6：主进程鼠标事件捕获
- [ ] 任务 2.7：overlay 窗口和引擎连线
- [ ] 任务 2.8：Workbench 预览对接引擎

## 阶段三：存储与通信
- [ ] 任务 3.0：实现 ElectronStoreAdapter
- [ ] 任务 3.1：主题导入导出适配
- [ ] 任务 3.2：get-windows 集成

## 阶段四：UI 迁移
- [ ] 任务 4.0：Workbench 自绘标题栏
- [ ] 任务 4.1：系统托盘
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
- **上次提交**：d38a888 阶段一 1.2
- **阻塞项**：无
- **扩展状态**：`npm run test` 115 tests 全绿（含新增 entry 占位测试），`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：阶段二开局——任务 2.0 完成，引擎共享 types.ts (CursorEvent / EngineDeps / 子模块占位类型) + entry.ts (createEffectEngine) 已就位。各 createXxx 暂返回空对象，等待 2.1+ 逐个填充。下一步任务 2.1 迁移 visual-effects → src/renderer/engine/visual-effects.ts。
