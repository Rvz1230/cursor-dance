# CursorDance

Chrome 扩展（Manifest V3）。为网页添加可定制的鼠标交互效果——点击粒子、波纹、飘字、音效、光标状态切换等。用户在 React 工作台中编辑主题，通过 Popup 切换主题，效果由内容脚本在目标网页上实时渲染。

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
| 测试 | Vitest (51 用例) + Playwright (E2E smoke) |
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
├── scripts/                    # AI API 服务
├── index.html                  # 工作台入口
├── popup.html                  # Popup 入口
└── CLAUDE.md                   # 开发指南
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
npm run test          # Vitest 单元测试（51 用例）
npm run test:smoke    # Playwright E2E 冒烟测试
npm run ai:dev        # AI API 服务
```
