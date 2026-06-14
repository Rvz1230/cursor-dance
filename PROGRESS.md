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
- [x] 任务 6.0：electron-builder 配置
- [ ] 任务 6.1：自动更新 + CI

---

## 当前状态

- **分支**：desktop/phase-0
- **上次提交**：阶段五 5.0
- **阻塞项**：无
- **扩展状态**：`npm run test` 191 tests / 27 files 全绿，`npm run build` 与 `npx electron-vite build` 双绿，`npm run package:mac:arm64`（带镜像 env）已成功产出 4 个发布物
- **备注**：任务 6.0 完成 —— electron-builder 26.15.3 打包链路打通。新增 `electron-builder.yml`：`appId=com.cursordance.app` / `productName=CursorDance` / output=`release/` / buildResources=`build/`；files 限定 `out/**/*` + 排除 renderer source map；`extraResources` 把 `public/`（托盘图标）整体拷到 `Resources/public/`，与 `src/main/index.ts` 的 `resolveTrayIconPath()` 在 `process.resourcesPath/public/icon-16.png` 的查找路径匹配；`asarUnpack` 解压 `uiohook-napi` 与 `get-windows` 两个原生模块，避免 asar 内 dlopen 失败；`mac` 段开 `hardenedRuntime` + `entitlements`/`entitlementsInherit` 指向 `build/entitlements.mac.plist`，`identity: null` 暂跳过签名，target 同时产 dmg 与 zip × (x64, arm64)；`win` 段产 nsis + portable × x64，省略 `win.icon` 让 builder 自动从 `build/icon.png` 派生 .ico。新增 `build/entitlements.mac.plist`：`cs.allow-jit` + `cs.disable-library-validation` + `network.client/server` + `automation.apple-events`，覆盖 Electron + uiohook 的 dlopen 与全局键鼠监听。新增 `build/icon.png`（512×512，sips 从 public/icon-512.png 转）+ `build/icon.icns`（iconutil 打包 16/32/64/128/256/512/512@2x iconset），`.gitignore` 加 `release/` 与 `build/icon.iconset/`。`package.json` 加描述、author、5 个脚本：`package:mac` / `package:mac:arm64` / `package:mac:x64` / `package:win` / `package:dir`。**镜像 env 必备**：受限网络下必须三个一起设——`ELECTRON_BUILDER_BINARIES_MIRROR=https://cdn.npmmirror.com/binaries/electron-builder-binaries/` + `ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/` + `ELECTRON_CUSTOM_DIR={{ version }}`，缺其中任何一个都会回退到默认 CDN 触发 600s 超时。已产出 4 个发布物（`release/` 下）：`CursorDance-0.6.0-arm64.dmg` 120M / `CursorDance-0.6.0-arm64-mac.zip` 120M / `CursorDance-0.6.0.dmg` 122M / `CursorDance-0.6.0-mac.zip` 122M。**坑点**：electron-builder 的 @electron/rebuild 跑 dual-arch 时会把 `node_modules/uiohook-napi/build/Release/uiohook_napi.node` 重写成 x86_64（与本机 arm64 不匹配），破坏 `npm run test` 中 `src/main/native-events.test.ts` 的加载——修法是从 `node_modules/uiohook-napi/prebuilds/darwin-arm64/uiohook-napi.node` 拷回 `build/Release/uiohook_napi.node`，每次 `package:*` 之后都要跑一次。下一步任务 6.1 自动更新 + CI。
