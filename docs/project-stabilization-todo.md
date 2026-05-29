# CursorDance 项目稳定化 TODO

最后更新：2026-05-14

## 目标

本文档将当前架构和功能缺口转化为可执行的任务列表。

项目已不再处于结构不稳定的状态。下一阶段应从大范围重构转向：

1. 用测试锁定行为
2. 降低 `public/content.js` 的运行时维护风险
3. 完成剩余的产品功能

## 当前基线

- 配置语义在 Popup、工作台和内容运行时之间已基本统一。
- 存储、实时预览和草稿适配已分离为独立模块。
- 动作配置语义现在有共享的分组辅助函数，供适配器、预览和运行时读取使用。
- `public/content.js` 已精简为运行时装配层，聚焦模块放在 `public/content-runtime/` 下。
- 项目现在有通过 `package.json` 暴露的 `vitest` 单元测试覆盖和 Playwright 冒烟测试覆盖。

## 完成快照

本文档中定义的稳定化计划已完成。

- `P0-1` 完成：使用 `vitest` 添加了轻量级单元测试，以及 `test` / `test:watch` 脚本。
- `P0-2` 完成：配置转换不变量和适配器回归已覆盖。
- `P0-3` 完成：浏览器级冒烟测试覆盖了 popup/workbench/runtime 同步。
- `P1-1` 完成：`public/content.js` 已拆分为聚焦的运行时模块。
- `P1-2` 完成：`actionConfig` 存储和编辑器边界已规范化。
- `P1-3` 完成：可切换的运行时诊断已实现，可从工作台查看。
- `P2-1` 完成：主题复制/删除/导出生命周期已完整。
- `P2-2` 完成：图片特效编辑、预览、存储和运行时渲染已打通。
- `P2-3` 完成：基础动画特效路径在编辑器、Popup 选择和运行时之间已打通。
- `P2-4` 完成：素材中心和诊断面板在工作区中可见。
- `P2-5` 完成：B 站音频压低验证现在有站点特定配置和本地冒烟回归覆盖。

## 优先级排序

### P0：在进一步重构前稳定行为

#### 任务 P0-1：添加单元测试工具

状态：已完成（2026-05-14）

- 范围：
  - 为配置和适配器逻辑添加轻量级测试运行器
  - 在 `package.json` 中添加 `test` 和 `test:watch` 脚本
- 建议工具：`vitest`
- 涉及文件：
  - `package.json`
  - `vite.config.js`
  - `src/app/pages/theme-workbench/lib/runtimeConfig.js`
  - `src/app/pages/theme-workbench/lib/themeDraftAdapter.js`
- 完成定义：本地测试命令存在且正常运行；项目可在不需要浏览器扩展打包的情况下执行独立的逻辑测试

#### 任务 P0-2：覆盖配置转换不变量

状态：已完成（2026-05-14）

- 范围：
  - 验证 `themePack -> workbenchDraft -> stored themePack` 往返行为
  - 验证实时预览覆盖不会覆盖已持久化的配置语义
  - 验证数字/文本模式的文字特效推断
- 涉及文件：
  - `src/app/pages/theme-workbench/lib/themeDraftAdapter.js`
  - `src/app/pages/theme-workbench/lib/runtimeConfig.js`
  - `public/config.js`
- 建议测试用例：
  - 木鱼方案文字配置保留数字模式语义
  - 自定义文字标签保留顺序和主文本
  - `comboEnabled` 在回退推断后得到正确遵守
  - 光标状态继承在水合后保持稳定
- 完成定义：之前修复的 popup/content 不匹配问题的回归用例已覆盖

#### 任务 P0-3：添加运行时行为冒烟测试

状态：已完成（2026-05-14）

- 范围：
  - 验证主题切换、实时预览和持久化重载流程
  - 验证 Popup 选中的主题与内容运行时效果输出匹配
- 建议工具：Playwright 或其他浏览器级冒烟工具
- 涉及文件：
  - `public/content.js`
  - `src/app/pages/popup/usePopupState.js`
  - `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`
  - `src/app/pages/theme-workbench/lib/extensionStorage.js`
- 完成定义：至少一个自动化流程覆盖：在 Popup 中选择主题 → 观察运行时效果 → 在工作台中编辑草稿但不保存 → 观察实时预览覆盖 → 关闭/重置草稿并观察回退到已保存状态

### P1：降低运行时维护风险

#### 任务 P1-1：将 `public/content.js` 拆分为内部运行时模块

状态：已完成（2026-05-14）

- 原因：这仍是最大的单一维护热点
- 建议拆分：
  - `runtime-config-read`
  - `runtime-trigger-handlers`
  - `runtime-visual-effects`
  - `runtime-audio`
  - `runtime-cursor-overlay`
- 约束：保持外部行为不变；保持扩展打包输出与当前清单使用兼容
- 涉及文件：
  - `public/content.js`
  - `public/config.js`
- 完成定义：事件接线、渲染、音频和光标覆盖逻辑不再混在一个文件中；每个模块有且仅有一个明确职责

#### 任务 P1-2：规范化 `actionConfig` 模型边界

状态：已完成（2026-05-14）

- 原因：分组辅助函数已存在，但存储形状仍是大而扁的对象
- 范围：
  - 记录哪些字段是运行时语义、编辑器专用表单状态、仅预览派生状态
  - 在安全的前提下移除存储草稿中重复或派生的字段
- 涉及文件：
  - `src/app/pages/theme-workbench/model/actionConfigSchema.js`
  - `src/app/pages/theme-workbench/lib/themeDraftAdapter.js`
  - `src/app/pages/theme-workbench/lib/preview.js`
- 完成定义：新增动作字段有且仅有一个明确的归属；适配器逻辑无需猜测字段是规范字段还是派生字段

#### 任务 P1-3：添加可选的运行时诊断

状态：已完成（2026-05-14）

- 范围：
  - 基于待办项 `CD-002` 构建
  - 为动作解析、触发区域过滤和媒体压低添加可切换的调试通道
- 涉及文件：
  - `public/content.js`
  - 工作台中未来的调试设置入口或隐藏开关
- 完成定义：开发者可以不用手动猜测来解释某个动作为何触发或未触发

### P2：完成缺失的产品功能

#### 任务 P2-1：主题管理完整性

状态：已完成（2026-05-14）

- 范围：复制主题、删除主题、导出主题 JSON
- 涉及文件：
  - `src/app/pages/theme-workbench/components/ThemeLibrarySidebar.jsx`
  - `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`
  - `src/app/pages/theme-workbench/lib/extensionStorage.js`
- 完成定义：用户可以完整管理主题生命周期，无需手动编辑存储

#### 任务 P2-2：添加图片特效面板

状态：已完成（2026-05-14）

- 范围：工作台中的基于图片的点击反馈；存储 + 预览 + 运行时支持
- 依赖：建议在 `P1-2` 之后进行
- 完成定义：一个图片特效可在内容运行时中配置、预览、保存和渲染

#### 任务 P2-3：添加基础动画特效面板

状态：已完成（2026-05-14）

- 范围：独立于文字/粒子/波纹的轻量级动画特效
- 依赖：建议在 `P1-2` 之后进行
- 完成定义：至少一条动画特效路径在编辑器、Popup 选择和运行时之间打通

#### 任务 P2-4：构建素材中心和诊断面板

状态：已完成（2026-05-14）

- 范围：素材管理页面或工作区；诊断页面或面板
- 依赖：诊断应与 `P1-3` 对齐
- 完成定义：用户和开发者有一个可视化入口来查看素材和调试状态

#### 任务 P2-5：站点特定音频验证

状态：已完成（2026-05-14）

- 范围：继续待办项 `CD-001` 中的调查；在诊断工具就绪后验证 B 站媒体压低行为
- 完成定义：三种 `soundBlendMode` 值在 B 站上感知差异明显

## 推荐执行顺序

1. 完成 `P0-1` 至 `P0-3`
2. 之后才启动 `P1-1`
3. 在添加新特效类型前完成 `P1-2`
4. 使用 `P1-3` 诊断工具支持 `P2-5`
5. 在扩展更多功能前先交付 `P2-1`，因为主题生命周期是核心用户路径

## 停止条件

当以下所有条件满足时，项目可视为「工程上已足够稳定，可以专注于功能开发」：

- 配置转换测试存在且通过
- 至少一个浏览器级冒烟测试覆盖 popup/workbench/runtime 同步
- `public/content.js` 不再是一个大的混合职责文件
- 主题生命周期操作覆盖创建、导入、复制、删除和导出

当前状态：截至 2026-05-14 已满足以上全部停止条件。

## 本阶段明确不做的事

- 与架构或缺失功能交付无关的大范围视觉重设计
- 没有测试基础设施的投机性状态模型重写
- 再次替换 popup/workbench/content 数据流，除非测试显示了具体缺陷

## 推荐的后续重点

稳定化计划完成后，下一阶段应优先选择小型、低风险的清理，而非新的架构变动。

1. 拆分 `public/config.js` 中的热点辅助函数，减少运行时适配器蔓延。
2. 将 `useThemeWorkbenchState.js` 拆分为水合、主题生命周期和实时预览副作用等更窄的 hook。
3. 将 `actionConfigSchema.js` 拆分为字段组、预设值和存储辅助函数，避免新特效卡片不断扩展同一个文件。
4. 如果引入另一个重要的运行时特效，考虑按特效类型拆分 `visual-effects.js`。

## 当前热点文件

截至 2026-05-14，最大的文件为：

- `public/config.js`：694 行
- `src/app/pages/theme-workbench/model/actionConfigSchema.js`：632 行
- `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.js`：605 行
- `public/content-runtime/visual-effects.js`：544 行
