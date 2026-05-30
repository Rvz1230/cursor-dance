# CursorDance

<p align="center">
  <img src="public/icon-128.png" alt="CursorDance" width="128" height="128">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License: AGPL-3.0"></a>
  <a href="https://github.com/Rvz1230/cursor-dance"><img src="https://img.shields.io/badge/GitHub-Rvz1230%2Fcursor--dance-181717.svg?logo=github" alt="GitHub"></a>
  <img src="https://img.shields.io/badge/version-0.6.0-orange.svg" alt="Version 0.6.0">
  <img src="https://img.shields.io/badge/platform-Chrome%20114%2B-lightgrey.svg" alt="Chrome 114+">
</p>

Chrome 扩展（Manifest V3）。为网页添加可定制的鼠标交互效果——点击粒子、波纹、飘字、音效、光标状态切换等。用户在 React 工作台中编辑主题，通过 Popup 切换主题，效果由内容脚本在目标网页上实时渲染。

## 截图

> 将截图放在 `screenshots/` 目录下，然后替换下方占位链接。

<p align="center">
  <img src="screenshots/workbench.png" alt="工作台" width="720">
  <br><em>主题工作台 — 编辑动作配置、实时预览效果</em>
</p>

<p align="center">
  <img src="screenshots/popup.png" alt="Popup" width="300">
  <br><em>Popup 快速切换主题</em>
</p>

## 安装

### Chrome 应用商店

> 上线后替换为实际链接。

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-green.svg)](https://chromewebstore.google.com/detail/cursordance)

### 手动安装（开发模式）

1. `npm install && npm run build`
2. 打开 `chrome://extensions`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist/` 目录
4. 打开任意网页即可看到效果；点击工具栏上的 CursorDance 图标打开 Popup

## 功能

- **6 种触发动作**：左键单击、右键单击、双击、长按、滚轮、悬停
- **7 类反馈效果**：数字/文本飘字、粒子、波纹、音效、动画、图片贴纸、光标形状
- **5 种光标状态**：默认、手型、文本、等待、禁用——每种可独立绑定动作和光标图案
- **主题系统**：4 套内置主题 + 自定义主题的创建、复制、导入/导出
- **站点规则**：按域名独立配置启用/禁用、指定专属主题
- **AI 方案助手**：自然语言描述需求，自动生成效果配置
- **实时预览**：工作台 Live Preview 即时在目标网页上查看效果
- **Popup 快速切换**：工具栏弹窗一键切换主题，站点规则感知

## 技术栈

| 层 | 技术 |
|---|------|
| 工作台 + Popup | React 18 + Vite + Tailwind CSS + Framer Motion |
| 内容脚本运行时 | 原生 IIFE 模块（无打包器），Web Animations API + Web Audio API |
| 状态管理 | useReducer + chrome.storage.local / chrome.storage.session |
| 数据格式 | schema v2，单 key `cursordance.config` |
| 测试 | Vitest (98 用例) + Playwright (E2E smoke) |
| AI API | Node.js + OpenAI Responses API 格式 → DeepSeek 模型 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（Vite dev server，含 HMR）
npm run dev

# 运行单元测试
npm run test

# 生产构建 → dist/
npm run build
```

### 在 Chrome 中加载

1. `npm run build`
2. 打开 `chrome://extensions`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist/` 目录
4. 打开任意网页，点击页面查看效果
5. 点击工具栏 CursorDance 图标打开 Popup

### AI 功能（可选）

```bash
# 启动 AI API 服务
npm run ai:dev
```

在工作台右侧面板使用自然语言描述效果需求。

## 架构

```
┌─────────────────────────────────────────────────┐
│  Popup (360×540px)         Workbench (选项页)    │
│  popup-main.jsx            main.jsx              │
│  usePopupState.js          useThemeWorkbenchState│
│       │                          │               │
│       └────────┬─────────────────┘               │
│                │ chrome.storage                   │
│         cursordance.config                       │
│         cursordance.livePreviewConfig            │
│                │                                  │
│                ▼                                  │
│  ┌─────────────────────────────┐                 │
│  │   Content Script Runtime    │                 │
│  │   content.js (DI 容器)      │                 │
│  │   ├─ config-store.js        │                 │
│  │   ├─ trigger-handlers.js    │                 │
│  │   ├─ visual-effects.js      │                 │
│  │   ├─ audio.js               │                 │
│  │   └─ cursor-overlay.js      │                 │
│  └─────────────────────────────┘                 │
└─────────────────────────────────────────────────┘
```

### 数据流

1. 用户在工作台编辑主题 → 保存到 `chrome.storage.local`（key: `cursordance.config`）
2. Live Preview → 写入 `chrome.storage.session`（key: `cursordance.livePreviewConfig`）
3. 内容脚本通过 `chrome.storage.onChanged` 监听变更 → `syncConfigFromStorage()` 同步配置
4. DOM 事件（pointerdown/up/move, wheel, contextmenu）→ `trigger-handlers.js` 解析动作配置 → `visual-effects.js` 渲染效果
5. Popup 读取配置并解析站点规则，显示实际生效的主题

## 项目结构

```
cursor-dance/
├── public/                     # 内容脚本（无打包，IIFE 注册到 window）
│   ├── config.js               # 默认配置 & normalizeConfig
│   ├── content.js              # DI 容器，组装运行时模块
│   ├── manifest.json           # Chrome 扩展清单
│   ├── config-runtime/         # 配置辅助（字段定义、pick 函数）
│   └── content-runtime/        # 运行时模块
│       ├── config-store.js     # 配置读取/合并/站点规则解析
│       ├── trigger-handlers.js # 事件处理 & 动作调度
│       ├── visual-effects.js   # 粒子/波纹/飘字/光标渲染
│       ├── audio.js            # Web Audio 音效播放
│       └── cursor-overlay.js   # 自定义光标覆盖层
├── src/
│   ├── app/pages/
│   │   ├── popup/              # Popup 页面
│   │   │   ├── PopupPage.jsx
│   │   │   └── usePopupState.js
│   │   └── theme-workbench/    # 工作台页面
│   │       ├── ThemeWorkbenchPage.jsx
│   │       ├── components/     # UI 组件（Header, Sidebar, Panels）
│   │       ├── hooks/          # 状态管理（useReducer + persistence）
│   │       ├── model/          # Schema, ActionConfig 预设值
│   │       └── lib/            # Storage 适配、主题适配、AI 助手
│   └── components/ui/          # 通用 UI 组件（Button, Switch, Slider...）
├── cursor-dance-api/           # AI API 服务
├── landing/                    # 独立 Vite 落地页
├── scripts/                    # 构建 & 开发辅助脚本
├── index.html                  # 工作台入口
├── popup.html                  # Popup 入口
├── CLAUDE.md                   # 开发指南
└── LICENSE                     # AGPL-3.0
```

## 配置数据格式

```js
{
  schemaVersion: 2,
  enabled: true,
  activeThemePackId: "woodfish",
  themePacks: [{
    id: "woodfish",
    name: "木鱼方案",
    cursorStates: { default: { mode: "inherit", size: 48 }, ... },
    workbenchDraft: {
      actionConfigs: {
        leftClick: { textEnabled: true, particle: true, ripple: true, sound: true, ... },
        rightClick: { ... },
        doubleClick: { ... },
        longPress: { ... },
        wheel: { ... },
        hover: { ... }
      }
    }
  }],
  siteRules: [
    { id: "r1", pattern: { type: "glob", value: "*.example.com" }, action: { enable: true, theme: "petal" } }
  ],
  performance: { maxActiveEffects: 48 }
}
```

## 命令行

```bash
npm run dev           # Vite dev server（工作台 + Popup）
npm run build         # 生产构建 → dist/
npm run test          # Vitest 单元测试（98 用例）
npm run test:smoke    # Playwright E2E 冒烟测试
npm run ai:dev        # AI API 服务
```

## 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feat/amazing-feature`)
3. 提交修改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

提交信息请遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范（本项目使用 `feat:`、`fix:`、`refactor:`、`docs:`、`test:` 等前缀）。

开始开发前请阅读 [CLAUDE.md](./CLAUDE.md) 了解架构约定和项目规范。

## 许可证

本项目基于 **GNU Affero General Public License v3.0 (AGPL-3.0)** 发布。

- ✅ 你可以自由使用、修改、分发本软件
- ✅ 你可以将本软件用于商业目的
- ⚠️ 如果你修改了本软件并通过网络提供服务（包括作为 Web 应用或浏览器扩展），你必须公开你的修改后的完整源代码
- ⚠️ 所有衍生作品必须以相同的 AGPL-3.0 协议发布

完整协议文本见 [LICENSE](./LICENSE)。
