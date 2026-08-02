# CursorDance 前端重构 UI 规范

这套稿子是**前端彻底重构的依据**，不是示意图。每一页都可点击、交互真实，参数与真实运行时对齐，编译用项目自己的 `tailwind.config.js` 尺度。

设计语言沿用现状（`DESIGN.md` 的「克制柔软」：slate 单色骨架 + `rounded-xl` + 1px 描边 + `shadow-sm` + L1–L6 排版层级）。琥珀金身份色那版提案已**否决**，留档在 `archive/`。

---

## 目录结构

```
docs/ui-spec/
├── README.md                 ← 本文件：规划、决策记录、实施顺序
├── index.html                ← 导航首页
├── _src.css                  ← 唯一样式源（@layer components 里的共享基元）
├── mockup.css                ← 编译产物，勿手改
├── tailwind.config.cjs       ← 只扫描本目录的 HTML
├── shell.js                  ← 共享外壳：标题栏 / 工作区导航 / 主题库侧边栏 /
│                               命令面板 / 自动保存 + 撤销 + 重做 / toast
├── controls.js               ← 共享控件：滑块（单/双/双向/刻度吸附）、带预览的下拉、
│                               可输入数值框、缓动曲线与形状缩略图
├── surfaces/                 ← 九个界面：五个工作区 + 工作台内的 AI 面板 + 三个独立窗口/面板
│   ├── 01-workbench.html     主题工作台（含实时预览 + 时间轴）
│   ├── 02-cursor-skin.html   光标皮肤
│   ├── 03-app-rules.html     应用规则
│   ├── 04-keyboard.html      键盘动效
│   ├── 05-diagnostics.html   诊断面板
│   ├── 06-ai.html            AI 助手（工作台内的面板，不是独立工作区）
│   ├── 07-settings.html      全局设置（独立窗口 ⌘,）
│   ├── 08-onboarding.html    首次启动引导（独立窗口）
│   └── 09-popup.html         托盘面板（320px）
│
│   注：07 / 08 / 09 **有意不加载 `shell.js`**。它们不是工作区，没有工作区导航与
│   主题库侧边栏；07/09 走 macOS 原生窗口/面板语义，08 是一次性向导。
│   共用的只有设计令牌与 `controls.js`。
├── library/                  ← 两个组件规范
│   ├── controls.html         配置控件（滑块家族 / 下拉 / 二维板 / 曲线编辑器…）
│   └── components.html       通用组件（PageHeader / EmptyState / Segmented / Skeleton…）
└── archive/                  ← 已否决或已并入的稿子，留档备查
    ├── identity-rejected.html          琥珀金身份色 + 深色舞台（否决）
    └── preview-timeline-rationale.html 时间轴改动的逐条对照（正式形态已并入 01）
```

编译样式（**新增或改动任何 HTML 后必须重跑**，因为 Tailwind 会按 content 扫描裁剪 `@layer components` 里的自定义类）：

```bash
npx tailwindcss -c docs/ui-spec/tailwind.config.cjs -i docs/ui-spec/_src.css -o docs/ui-spec/mockup.css --minify
```

---

## 每页对应要重构的真实代码

| 稿子 | 替换 / 重构 |
| --- | --- |
| `01-workbench.html` | `ThemeWorkbenchPage.tsx` 的 workbench 工作区、`WorkbenchPanel.tsx`、`panels/*Card.tsx`、`WorkbenchPreviewRail.tsx`、`preview-rail/*`（`PreviewStage` / `PreviewTimeline` / `TimelineTrackRow` / `PreviewPlaybackControls`）、`useWorkbenchColumnLayout.ts` |
| `02-cursor-skin.html` | `StatesPanel.tsx`、`cursor-skin/CursorSkinStudio.tsx`、`cursor-skin/cursorSkinModel.ts` |
| `03-app-rules.html` | `AppRulesPanel.tsx`、`SiteRulesPanel.tsx`、`context-rules/RulePrimitives.tsx` |
| `04-keyboard.html` | `KeyboardPanel.tsx` |
| `05-diagnostics.html` | `DiagnosticsPanel.tsx` |
| `06-ai.html` | `AiSchemePanel.tsx`、`ai-scheme/*`（`AiProposalPresentation` / `AiAgentActivity` / `AiConversationMessage`）、`useWorkbenchAiPreview.ts`、以及后端 `cursor-dance-api/src/agent-tools.js` 的工具集与交付形状 |
| `07-settings.html` | **新建**独立设置窗口（现在没有对应实现）；多屏策略与缩放换算要接 `desktop/main/windows.ts`，共享效果预算接 `performance.maxActiveEffects`，可改快捷键接 `desktop/main/tray.ts` + 新的快捷键注册层 |
| `08-onboarding.html` | **新建**首次启动引导窗口（现在没有对应实现）；辅助功能授权状态接 `desktop/main/native-events.ts` |
| `09-popup.html` | `src/app/pages/popup/*`（`usePopupState.ts` / `popupConfigModel.ts`）；「临时暂停 20 分钟 / 1 小时 / 直到重启」是走查补的缺口，需要在主进程加一个到期自动恢复的定时器 |
| `shell.js` | `WorkbenchChrome.tsx`（`DesktopWorkbenchToolbar`）、`WorkbenchHeader.tsx`、`ThemeLibrarySidebar.tsx`、`theme-library/*`、`ui/theme-card.tsx` |
| `controls.js` | `ui/control-slider.tsx`、`ui/select.tsx`、`ui/small-select.tsx`、`ui/color-options.tsx` —— 实现时应产出 `Slider` / `Select` / `NumberField` 三个组件，并**删掉 `small-select`**（它只是 `Select` 的薄包装，是第三套下拉的来源） |
| `library/controls.html` | `ui/control-slider.tsx`、`ui/small-select.tsx`、`ui/select.tsx`、`ui/color-options.tsx`、`ui/field-row.tsx` |
| `library/components.html` | `ui/panel.tsx`、`ui/inline-status.tsx`、`ui/toast.tsx`、`ui/icon-button.tsx`、`ui/tabs.tsx` + 新增 `PageHeader` / `EmptyState` / `Segmented` / `NumberField` / `Skeleton` |

---

## 交互闭环走查后补齐的行为（这一批是排查出来的，不是原始设计）

这些是走查时发现的闭环缺口，已在稿子里实现，重构必须一并带上：

| 行为 | 为什么 |
| --- | --- |
| **时间轴是横跨两列的底部抽屉**，可折叠、可拖高度（150–460px） | 原先挤在右列只有 ~400px 宽，而舞台被压到 212px——装不下自己要展示的效果（粒子扩散直径 176px + 文字上浮 54px）。现在舞台 304px、时间轴 684px。折叠后标题行保留「N 条轨道 · N 条已链接 · 播放头 xxx ms」，否则收起来就失去上下文。 |
| **标尺与轨道的栅格必须严格一致**（132px + gap-2.5 + px-1） | 原先标尺 96px、轨道 112px，刻度与色块错位、播放头偏 5px。播放头位置现在由实测几何算出，不再依赖常量——改布局不会再错一次。 |
| **独奏 S 与静音 M 并存** | 两种不同需求：独奏是「只看这一个」，静音是「排除这一个」。静音轨仍留在时间轴上（标成静音）并仍可作为链接目标。 |
| **循环区间随总长收缩钳制** | 关掉最长通道后区间会落在总长之外，播放卡死。 |
| **链接目标被关掉 → 固化为当时的绝对时间并明确告知** | 原先静默降级，色块会跳位置且不给解释。注意：固化必须在翻转开关**之前**取值，否则算出来的是降级后的 off。 |
| **拒绝链接成环** | A 链 B、B 链回 A 时无解。拒绝并提示，按绝对时间放置。 |
| **「其余 N 项」= 卡内分组折叠 + ⌘K 全局字段搜索** | 一套主题约 390 个配置决策，任何分组都不如直接搜字段名。搜到「其余项」里的字段时会自动展开分组、必要时先打开该效果，并让命中的字段闪一下。 |
| **值的四态溯源**：默认 / 预设 / AI / 自定义 | 字段旁一个小点标来源，双击回到预设值；卡头显示「弹跳 · 2 项已改」；预设 chip 显示「·已改」并给出「回到「弹跳」」。 |
| **撤销栈按主题分桶 + 重做 ⌘⇧Z** | 在主题 A 改了 3 步、切到 B 再 ⌘Z 撤销 A 的改动是错的。撤销函数返回重做函数，两者成对。 |
| **白名单模式与例外列表联动** | 「仅在指定应用中启用」下「关闭」是空操作。切过去后隐藏「关闭」段、把原本关闭的行标「白名单下无效」，并给一个「移除这些空配置」。 |
| **高级规则被例外应用覆盖时标出来** | 裁决顺序是例外 > 高级，被盖住的规则原先毫无提示，用户会反复调它。 |
| **诊断：采集开关（唯一真值）+ 暂停滚动** | 原先「实时接收」开关与「采集未开启」状态是两个纠缠的概念。 |
| **拦截分布可点击筛选** | 「40 次里 11 次被区域过滤」原先只是个数字，点一下应能筛出那 11 组。 |
| **布局预设按钮只在工作台出现** | 只有它是多列界面，放在外壳里会让另外 4 页出现点了没反应的死控件。 |

## 控件统一（这一批是「组件库没落地」的欠债）

`library/controls.html` 当初只是「展示」：界面里照旧用原生 `<input type=range>` 和 `<select>`，
还多出一套 `mini-select`。量化过的欠债是 **25 个原生 range + 4 个原生 select + 4 处 mini-select**。
现在全部收进 `controls.js`，五个界面与两个库页共用同一实现，**原生控件数为 0**。

实现时必须保持的手感约定（这些细节就是「精致」的全部来源）：

- 拖柄 hover 放大、拖拽时出数值气泡、松手才 commit（拖动过程不落 toast）
- 轨道下方一个小三角标出默认值，**双击拖柄回默认**
- 方向键 ±step、Shift ±10step、⌥ 临时关闭刻度吸附
- **标签可横向 scrub**（Blender / AE 手感，不占额外空间）
- 不变量收在 `paint()` 里：键盘、scrub、程序化赋值都经过它，双拖柄的 `v ≤ v2` 不会被绕过
- 禁用态由 CSS 后代选择器承担（`.sl-disabled .sl-fill`），不要用 JS 改类名——`.sl-fill` 是 `@apply` 组件类，元素上没有 `bg-slate-900` 可替换
- 下拉的选项要「长成结果的样子」：缓动画曲线并标过冲百分比、形状画图形、字体用该字体渲染样张

## AI 助手的重新定位（`06-ai.html`）

> **AI 不是配置生成器，是「提案人 + 排障助手」。它永远只产出一份待审补丁，用户是唯一的写入者。**

现状里已经做对、不要动的部分：Agent 在**服务端沙箱副本**上迭代（`createToolExecutor` 里 `configs = {...initialConfigs}` + 快照回滚），不碰真实配置；已有 `diffItems` 的改动详情；已有实时预览；已有 `revertAiChanges` 兜底；Agent 每步可观测。

要改的五处：

| 现状 | 改成 |
| --- | --- |
| 用户先选「快速 / Agent」两种模式（两条 endpoint、两种产物形状） | **取消模式选择**。一次能给出补丁就直接给；需要多步就展开可折叠的过程区。模式是实现细节，不该由用户决定 |
| `applyProposal` 一次写入全部 patch | **逐项接受**。AI 常 80% 对、20% 不对，必须能只接受一部分 |
| `diffItems` 只读、截断 12 条、不指向界面位置 | 每项一行 diff + 接受/跳过开关；**hover 高亮到左侧对应的卡片 / 字段 / 时间轴轨道** |
| AI 只能写扁平字段（`AI_SCHEME_PATCH_FIELDS` 白名单），会**冲掉**用户建立的锚点链接 | 补丁改成 **op 列表，五种 kind**：`preset` / `field` / `timing` / `curve` / `toggle`，一一对应新架构的五个可编辑面。`timing` op 用 `{ref, off}` 表达，所以不会把相对时间冲成绝对时间 |
| AI 看不到运行时，只能做审美建议 | 新增只读工具 `read_timeline` / `read_diagnostics` / `list_presets`，AI 能回答「**为什么没效果**」并给出预算收益 |

工具集：`read_config` / `read_timeline` / `read_diagnostics` / `list_presets`（全只读）+ `propose_patch`（唯一交付口，替代 `finalize_proposal`）。服务端沙箱与 `apply_config_patch` / `rollback` 可保留用于模型自我试算，但**不再是交付路径**。

其余已定：

- `revertAiChanges` 合并进全局撤销栈，只留一套回退；接受后被改字段标 `src: 'ai'`（对上四态溯源）
- **冲突标记**：某个 op 会覆盖用户手改过的值或已建立的链接时，行内明示「会覆盖你手改的字号 28」
- **好用的提案可一键存成自定义预设**，进入预设层复用，不再是一次性的
- **隐私**：诊断含前台应用名，**默认脱敏成「某应用」**，仅在用户显式开启「诊断里带上应用名」时发送真实名称，并在提问区就近说明

## 走查中发现的、稿子自身的实现级教训（重构时同类问题会再出现）

0. **同一个 landmine 我踩了两次。** 迁到共享外壳后，`02` 和 `03` 各自残留一套页内 toast，
   `$('toastUndo')` 变成 `null` → 整段页面脚本从那一行起不再执行。第一次只修了 `03`，
   没有全稿排查，`02` 又以同样方式坏了两轮（滑块、预设、精确值输入全是死的）。
   **发现一个此类问题时，必须立刻全稿 grep 同一模式，而不是只修当前页。**
1. **迁移到共享外壳后，页面残留的自有 DOM 引用会静默炸掉整段脚本。** `03-app-rules.html` 里旧的页内 toast 被移到外壳后，`$('toastUndo')` 变成 `null`，`.addEventListener` 抛错——从那一行起本页所有绑定（行内控件、高级规则折叠、应用挑选浮层）全部没执行，而页面看起来是正常的。**教训：抽取共享层时要逐个检查页面对被移走 DOM 的引用，并且要验证「交互是否真的还能用」而不只是「页面是否渲染」。**
2. **批量文本替换必须断言命中。** 至少三次补丁打在了不存在的模式上、静默什么也没改
   （`03` 的分段控件绑定、`02` 的滑块监听）。另有一次正则删除切错了边界，留下
   `easingThumb` 等已删除标识符的引用，导致整段脚本语法错误——**改完要跑一次
   「内联脚本语法自检」**：把每个 `<script>` 的内容喂给 `new Function()`，能一次性抓出这类问题。
3. **Tailwind 会按 content 扫描裁剪 `@layer components`**，新增 HTML 后必须重新编译，否则自定义类和任意值类（如 `h-[318px]`）会被摇掉，表现为「高度归零、栅格失效」。
4. **`<script defer>` 会晚于内联脚本执行。** 库页一开始用 `defer` 引 `controls.js`，
   内联脚本先跑、`Ctl` 还未定义。共享层必须用阻塞式 `<script src>` 且放在使用它的脚本之前。
5. **顶层 `const` 不会挂到 `window`**，跨脚本自检时取不到，需显式 `window.Ctl = Ctl`。
6. **编译校验要看全部输出**：`tail -2` 曾把 `CssSyntaxError` 挡在视野外，导致 CSS 长时间是旧的。用 `grep -E "Done|error"`。
7. **可选链防不住 TDZ。** `sizeSlider?.set(v)` 看起来是在防「还没初始化」，但 `?.` 只防
   null/undefined；若 `sizeSlider` 是后面才 `const` 声明的，访问它会抛
   `ReferenceError: Cannot access 'X' before initialization`，整段脚本从那行起停掉。
   而 `Ctl.slider` 构造时就会同步跑一次 `paint() → onChange`，正好落在那个窗口里。
   **这是教训 #0 的第三次复发**——前两次是 DOM 引用，这次是绑定初始化顺序，症状完全一样：
   页面渲染正常、交互全死、控制台看起来干净。已由 `check-ui-spec.mjs` 的
   `optional-chain-before-init` 规则机械拦截。
8. **「页面渲染正常」永远不能当作验证结论。** 上面这条是靠**真的去点了一下底色切换按钮**
   才发现的：截图完全正常，DOM 结构完全正常，`typeof someFn` 也全是 `'function'`
   （函数声明会提升，所以它证明不了执行到过那里）。可靠的探针是**只在脚本末尾才会发生的副作用**，
   或者程序化调一次控件 API 看它在不在。
9. **门禁必须自测。** 两个 check 脚本都跑过「注入违规 → 确认报出对应 rule id → 还原」。
   一个从来没被验证过能失败的门禁，和没有门禁没区别。
   `classname-rebuild-with-layout` 这条规则第一版是**逐行**匹配的，自测立刻发现它抓不到
   真实写法——因为 `+ 动态部分` 常常换行写在下一行。不自测就会上线一条永远 PASS 的死规则。
11. **逐行正则会漏掉跨行语句。** 上面那条的具体形态：`el.className = '…'`（第一行）
   `+ MAP[k];`（第二行）。凡是判定「字面量后面有没有拼接」的规则，都必须整源扫描后再算行号。
13. **稿子必须对照真实代码盘一遍「有没有丢功能」。** 走查只能发现「稿子里画错的」，
   发现不了「稿子里没画的」。这轮丢掉的四个功能（列宽拖拽、卡片重置、卡片折叠、自动循环）
   全都在真实代码里工作着，但稿子里一个都没有——**光看稿子永远看不出来**。
   办法是拿真实组件的 prop / 导出名去 grep 稿子：`ResetCardButton` 16 处 → 稿子 0 处。
14. **同一个 `<script>` 块里没有下一块才定义的助手。** 我加分隔条时在第一个内联块里写了
   `$('colSplit')`，而 `$` 是在第二个块才 `const` 定义的 → `$ is not defined`，
   那一行之后的绑定全没执行，但布局预设按钮（绑定在它前面）照旧能用，
   于是表现成「预设有效、拖拽无效」这种极容易误判为「拖拽逻辑写错了」的样子。
15. **联动必须双向。** `05` 的拦截分布筛选在**开启**时顺带改了结果筛选，**取消**时没还原，
   于是留下一个粘住的筛选、看起来像数据丢了。凡是「打开 A 时顺手改 B」，
   都要同时写「关闭 A 时把 B 还原」，并且要考虑用户中途手动改过 B 的情况。
16. **「装不下」和「能滚」要分清。** 我一度把 06 提案列表判成缺陷（「6 条里 3 条被压在操作条下」），
   实际那个容器 `min-h-0 flex-1 overflow-y-auto` 工作正常、能滚 345px、第 5 条 op 滚一下就出来。
   `getBoundingClientRect()` 只告诉你元素在视口的哪儿，**不告诉你它是否可滚达**；
   判定截断要看祖先链上的 `overflowY` 与 `scrollHeight/clientHeight`。
10. **剥注释再做静态检查。** 稿子里到处是「这里原先 `$('toastUndo')` 变成 null」这类**讲述历史缺陷**
   的注释；不剥注释的话门禁会把说明文字当成真实代码报出来。一个会喊狼来了的门禁很快会被忽略——
   第一版 `check-ui-spec.mjs` 就报了 6 条这种假阳性。

## 已定的产品决策（重构必须遵守）

1. **自动保存 + 撤销**，全站统一。删掉「保存」按钮、脏状态标记、切主题时的「保存/丢弃」对话框。`⌘Z` 有历史栈。
2. **预设先行**。每张效果卡顶部一排预设 chip，常用字段只展示 5 个，其余收进「显示全部 N 项」。
3. **颜色只有两类**：品牌暂缺（沿用 slate-950 作强调），语义四个（emerald 已启用 / rose 危险 / sky 信息 / amber 警告）。删掉 `PANEL_META` 的九色图标底，改成「深底=启用、浅灰=关闭」。`violet` / `fuchsia` / `cyan` 从代码里清除。
4. **任何操作不得只在 hover 时可达**。这条可机械检测，把 `opacity-0 …group-hover:opacity-100` 加进 `scripts/check-design-tokens.mjs`。
5. **主题库侧边栏默认展开**，折叠状态需持久化；折叠态保留搜索入口。
6. **快捷键**：`⌘Z` 撤销、`⌘K` 命令面板、`⌘1–5` 切工作区、`⌘N` 新建主题、`⌘J` AI 助手。不再需要 `⌘S`。
7. **反馈三分工**：一次性结果 → toast（带撤销）；持续状态 → `InlineStatus`；字段校验 → 紧邻输入框内联。
8. **预览面是可交互沙盒**，不是重播动画。用正在配的手势在预览里直接触发。
9. **时间轴是时间的唯一编辑面**：偏移、时长、缓动曲线、错峰都在这里；卡片只管外观。
10. **深色模式**进路线图（令牌层已在 `library/components.html` 验证）。桌面端是否默认深色待定。

---

## 顺带发现的、独立于 UI 的真实缺陷

> **状态：第 0 批已完成。** 下面每条都标了核实结果——有三条与最初的记载不符，按核实结果执行。

1. ✅ **指向点语义不一致** → 已归一化 0–1 存储，换算集中到渲染那一处。
   **比最初记载的更严重**：渲染尺寸会被 `clamp(size, 24, 96)` 夹过，`fixedBox` 模式下更是直接换成 `boxSize`，所以**即使 hotspot 本来就是 CSS px 也仍然是错的**——它没跟着实际渲染尺寸换算。128×128 的图配 `fixedBox 32` 时正确偏移是 16px，旧代码减了 64px，偏出一个半光标身位。
   实现见 `src/shared/effect-core/cursor-hotspot.ts`（唯一真值源）。**没有**升 `cursorSkin.version`：`normalizeConfig` 的既定策略是「非 v4 数据整体重置、不做字段迁移」，升版本会让所有存量配置校验失败、连主题一起重置。改用取值范围判别（归一化值必然 ≤ 1，像素值几乎必然 > 1），天然幂等。
2. ✅ **缓动过冲把字符按成全透明** → 动画级 `easing: linear`，选中的缓动挪到入场段 keyframe。
   实测数字修正：默认配置（bounce）下可见时长占比 **29.8% → 86.5%**（原记载「约 63% 不可见」偏乐观）。
3. ✅ **左/右入场时 `keyboardLayout` 映射被忽略** → `keyLayoutNormalizedX` 是横向映射，对纵轴没有语义；横向入场时回落到 center 行为 `screenH * globalOffsetY`，而不是硬编码屏幕中线，这样 `globalOffsetY` 在两个轴上都有意义。UI 侧按稿子如实禁用该映射。
4. ✅ **`Panel` 的 `enabled` 是死参数** → 现在由它驱动图标底色（深底=启用、浅灰=关闭），同时把决策 #3 的九色图标底一并落地。
   **数字修正：实际有 20 处在传 `iconTone`**（不是记载的 5 处）——7 处 `KeyboardPanel`、3 处 `DiagnosticsPanel`、8 张效果卡、`WorkbenchPreviewRail`、`AiSchemePanel`。`iconTone` prop 已删除。
5. ✅ **`trail` / `trailLength` / `splash`** → **核实时已经修好了**，`src/shared/config/key-feedback.ts:6` 已有注释、UI 无引用。补了门禁规则 `unimplemented-field` 锁住，防止将来又被暴露出来。
6. ✅ **列宽拖拽结果不持久化** → 复用已有的 `local-editor-state.ts`（`readEditorState` / `writeEditorState`），松手时落盘。
   顺带把决策 #5 一起落了：主题库侧边栏原本是 `useState(true)`（默认折叠且不持久化），现在默认展开且折叠态持久化。
   为此把编辑器状态的写入语义从「整体替换」改成 **patch 合并**——导航、列宽、折叠态是三个互不相关的写入方，替换语义会互相抹掉。

### 第 0 批顺带发现并修掉的（原清单里没有）

7. ✅ **`02-cursor-skin.html` 的交互整页是死的**（滑块、指向点输入、预设、底色切换全部不响应）。
   `syncReadouts()` 里写了 `sizeSlider?.set(...)`，而 `sizeSlider` 是**后面**才 `const` 声明的。
   **可选链只防 null/undefined，防不住「const 在初始化前被访问」的 TDZ ReferenceError**，
   而 `Ctl.slider` 在构造时就会同步跑一次 `paint() → onChange → syncReadouts()`，正好踩进那个窗口。
   这是 README 教训 #0 的**第三次复发**，换了一种机制。已加门禁规则 `optional-chain-before-init`。
8. ✅ **`controls.js` 的滑块会与消费者互相递归爆栈**：消费者在 `onChange` 里回调 `set()`（把值同步进自己的 readout）是很自然的写法，但 `set → paint → onChange → set` 会无限递归。修 7 之后这个问题才暴露出来（原先被 TDZ 异常掩盖着）。已加防重入：渲染每次都做，只有最外层那次通知。**React 版 `Slider` 会遇到同一个坑。**
9. ✅ **`TitleBar.tsx` 的更新徽标用了调色板外的 `blue`** → 改 `sky`（信息态）。

### 逐页交互走查后又修掉的（`01` / `04` / `06` / `08` 首次真正被点过）

10. ✅ **`01` 点一下底色，舞台被打回 212px 且不可逆。** 舞台的高度来自 `min-h-0 flex-1`，
    而底色切换把 `className` 重建成含 `h-[212px]` 的字面量，一次点击就把 flex 尺寸冲掉——
    **而 212px 正是时间轴改成底部抽屉要消除的那个数**。`02` 有同一个反模式（值虽然一致，
    仍是字面量重复）。两处都改成只增删底色类，并加了门禁规则 `classname-rebuild-with-layout`。
11. ✅ **`04` 的稿子里复刻了缺陷 3 的原始逻辑。** `handlePos()` 在横向入场时写
    `y = layout ? H * 0.5 : H * globalOffsetY`，与运行时修复前的 `screenH * 0.5` 一模一样。
    **稿子不同步的话，重构会照着稿子把刚修好的缺陷重新实现一遍。** 已改成回落 `globalOffsetY`。
    同时 `停留位置（键位决定横向）` 这句在横向入场时是错的（键位在那里完全不起作用），
    已按入场轴决定是否附加。
12. ✅ **`08` 第 1 步中部 179px 死白**（上一轮漏做的）。窗口高 560px 固定而各步内容高度不同，
    改成用 `m-auto` 垂直居中（**不是** `justify-center`——后者在内容高于容器时会裁掉顶部）。
    四步现在上下留白对称：99/99、42/42、75/75、84/84。

**核实后撤回的一条**：我一度判定「`06` 的 6 条提案里 3 条被压在操作条下、`开关` op 根本看不到」。
实际那个容器工作正常、可滚 345px，第 5 条 op 滚一下就出来。是我把「在滚动视口之外」
误读成「被遮住」。见教训 #12。

### 稿子丢掉了真实代码里已经在工作的功能（**这类最危险**）

按稿子重构会把这些**已经能用的功能删掉**，而且没人会注意到——稿子里看不见的东西，
重构时不会有人专门去问「它是不是本来有」。

| 功能 | 真实代码 | 稿子原状 | 现已补回 |
| --- | --- | --- | --- |
| 配置列 / 预览列自由拖宽 | `useWorkbenchColumnLayout.ts` 的 `startResizeColumns`（且已做持久化） | `#cols` 里**没有分隔条**，只有三个布局预设按钮 | 4px 分隔条，权重模型与夹取区间照 `COLUMN_BOUNDS`；拖过之后不再高亮任何预设（当前比例已不是那三档，继续亮着是谎报状态）；方向键 ±0.04、⇧ ±0.12 |
| 效果卡独立重置 | `ResetCardButton` 用在 **16 处** | **0 处** | 卡头「重置」，**只在真有改动时出现**（没改动时它是空操作）；带撤销 toast |
| 效果卡手动折叠 | `collapsible` 传入 **17 处** | 0 处（只有时间轴抽屉能折叠） | 卡头折叠箭头。**折叠 ≠ 关闭**：折叠只影响视觉密度、配置仍生效，所以是两个独立控件；折叠后摘要留在标题行 |
| 预览自动循环 | `PreviewPlaybackControls` 的 `autoPlay` + `INTERVAL_PRESETS`（2400/1200/600） | 只有 播放/暂停、重播、循环区间 | 「自动重播」+ 间隔三档。**与「循环区间」是两回事**：循环区间反复播选中那一段、段间无空隙；自动重播是整条播完后隔一段再来一次（调手感需要的是后者，效果之间要有间隔才看得出单次的样子） |

### 第 0 项 · 功能对等清点（已固化成门禁）

清点 30 项能力后又发现一个：**主题卡的 `⋯` 按钮根本没有菜单**——无 handler、无菜单项，
是个死控件。而真实代码有五个命令在工作（`duplicateTheme` / `renameTheme` / `updateThemeIcon` /
`exportTheme` / `deleteTheme`）。已在 `shell.js` 实现菜单，并把 `buildDeleteThemePlan` 的两条
约束直接编码进去（内置主题不可删、至少保留一个），否则实现时会做出一个「点了删除然后报错」的按钮。

清点结果已写进 `scripts/check-ui-spec.mjs` 的 `PARITY` 清单，**两个方向都会失败**：
- `parity-spec-missing`：代码有、稿子没有 → 按稿子重构会删掉一个在工作的功能
- `parity-code-anchor-gone`：代码侧锚点消失 → 这条清单必须被**有意识地**删掉，而不是默默失配

这条门禁自测过：把 `自动重播` 和 `id: 'duplicate'` 各改坏一次，确认都能报出对应能力名。

### 第 1 批 A · 五个共享组件（已落地）

`PageHeader` / `EmptyState` / `Segmented` / `NumberField` / `Skeleton`，全部**接进了真实调用点**
（只加组件不接调用点等于囤库存，knip 会如实报 unused）：

| 组件 | 接入点 | 顺带修掉的问题 |
| --- | --- | --- |
| `PanelSkeleton` | `ThemeWorkbenchPage` 的 `DeferredPanelFallback` | 原本是居中 spinner，懒加载时整块面板看起来像空了、出现时还跳版 |
| `EmptyState` | `AppRulesPanel` 的空态 | 三种空态语义分开（`neutral` 本来没内容 / `filtered` 被筛掉了 / `blocked` 缺权限）——它们的**下一步动作完全不同** |
| `PageHeader` | `StatesPanel` 页头 | 各页各写一遍，间距与窄屏折行行为不一致 |
| `Segmented` | `KeyboardPanel` 的「显示模式」 | 原本是 `SmallSelect` + `options={["typed","physical"]}`，**界面上真的把英文枚举值显示给用户** |
| `NumberField` | 从 `CursorSkinStudio` 里的本地实现**提升**上来 | 见下 |

`NumberField` 修掉了一个真实的输入陷阱：原本每次 `onChange` 都立刻 clamp，
于是 `min=12` 时想输「50」根本输不进去——按下「5」就被 clamp 成 12，第二键变成 122。
现在编辑期间保留草稿字符串，**失焦或 Enter 才 clamp 并提交**，Esc 放弃。
空串/非数字视为放弃编辑保持原值（不能静默变成 min）。
判定逻辑抽成纯函数 `resolveNumberCommit` 以便单测——项目里没有 DOM 测试环境
（434 个测试全是纯逻辑），**没有为了测一个组件就擅自引入 testing-library + jsdom**。

### 第 1 批 B · 撤销栈 + 快捷键（已落地）

**这是删掉保存 / 脏状态模型的硬前置**：自动保存把「保存 / 丢弃」这个后悔手段拿掉了，
撤销栈是它唯一的替代品。顺序颠倒会有一段时间既没有保存按钮也没有撤销。

- 栈的语义在 `lib/undoStack.ts`（纯函数，11 条单测）：**按主题分桶**、**撤销与重做成对**、
  **连续同目标改动合并**。
- **合并不是优化而是必需**：`ControlSlider` 用的是 Radix `onValueChange`，拖动时每帧提交一次。
  实测一次拖拽（0→3）若不合并会产生 3 条记录，按一次 ⌘Z 只退回一帧；
  合并后一步退回 0。真机验证过这条。
- 记录点只有一个：`useThemeWorkbenchState` 里的 `updateCurrentTheme`。
  所有草稿改动（字段、预设、光标皮肤、键盘、AI 补丁）都从那个 updater 走，
  在唯一漏斗上记录，将来新加改动入口也不会忘记录。
- 键位表与「什么时候不该触发」在 `lib/shortcuts.ts`（19 条单测）。两条最容易写错的：
  **输入框里 ⌘Z 必须让给浏览器原生文本撤销**，**⌘1 必须能在输入框里打出「1」**。
- **⌘K / ⌘N 刻意没有注册**：命令面板在真实代码里还不存在，⌘N 的 composer 状态还私有在
  `ThemeLibrarySidebar` 里。注册一个没实现的键位会吃掉原生行为又什么都不做，比没有更糟。
- 撤销 / 重做在**两端工具栏都有可见按钮**（带动作名，如「撤销：左键单击」）。
  只有快捷键的功能等于隐藏功能——没人会去猜一个没有按钮的快捷键存在。
- `toast` 补了撤销动作位（决策 #7）。

顺带修掉一个 a11y 缺陷：`ThemeCard` 把整张卡包成 `<button>`，里面又有「重命名」`<button>`——
**button 套 button，HTML 无效、激活行为未定义、读屏器读不清**。
把 hover-only 改成常显之后这个嵌套更要紧了（内层按钮现在一直都在）。
改成「铺满卡片的选择按钮垫在内容下面」，实测嵌套按钮数 0、选卡与重命名都仍可用。

### 光标皮肤：从 2 个槽位重新设计成完整状态体系（`02`）

原先只有 2 个槽位（主皮肤 + 拖拽中），理由写在真值源注释里：桌面运行时只识别这两种。
但那是**当前能力**的限制，不是这套皮肤体系应有的样子——一套光标皮肤本来就该覆盖
文本、手指、滚动、精确选择等形态。所以稿子按**完整体系**设计，11 个状态分 6 组：

| 分组 | 状态 |
| --- | --- |
| 基础 | 普通（主皮肤，其他状态的继承源） |
| 文本 | 文本选择 |
| 指向 | 可点击、帮助 |
| 拖拽与滚动 | 可拖拽（张开手）、拖拽中（握拳）、滚动 |
| 精确操作 | 十字准星、缩放 |
| 状态反馈 | 忙碌、不可用 |

几个设计判断：

- **分组不是为了好看。** 11 个状态平铺是一堵墙，而它们天然分成几个「同一类形态」的族——
  用户配皮肤时是按族想的（「我要一套手型」），不是按字母序想的。
- **可达性如实标在每一行**：`现在生效`（当前运行时真能产出）/ `待系统能力`
  （配置会存下来，能力就绪后自动生效）。**必须标**，否则用户配了一堆以为坏了；
  但**也不能因此不给**，否则这套皮肤永远只能做两种形态。
  同一句解释只在分组头出现一次，不在 9 行里各重复一遍——重复即噪音。
- **继承是核心动作，不是附属选项。** 11 个状态不可能让人上传 11 张图，
  所以默认全部继承主皮肤，需要时逐个「派生」成独立素材，另给「全部派生」。
  每次切换都带撤销。
- **每个状态画成能认出来的形状**（I 型光标、张开手、握拳、准星、缩放箭头…），
  列表要读起来像「一套光标」，而不是一排文字配一排相同的方块。
- **`只看现在能生效的状态`** 开关：想立刻见效的人勾上就只剩 2 行，
  想设计完整套的人保持默认。默认展开全部——用户要的就是完整体系。
- 没有主皮肤时所有派生按钮禁用（没有继承源，派生是空操作）。

**桌面端要真正生效需要新增能力**，这一条还没做、也没有偷偷假装做了：
原生 helper（`native/macos/cursor-visibility-helper.c`）只能 `CGDisplayHideCursor`
隐藏/显示光标，**读不到系统光标形状**。可行路径是用已授权的辅助功能 API
`AXUIElementCopyElementAtPosition` 取指针下元素的 `AXRole` 反推状态
（`AXTextField`→文本、`AXLink`/`AXButton`→可点击、`AXScrollArea`→滚动）。
代价：AX 是同步跨进程调用，目标应用卡住时会阻塞到超时，**绝不能按 pointermove
频率跑**，必须「指针静止 ~100ms 才查 + 按位置缓存 + 硬超时」；而且 Electron / 游戏 /
Java 应用的 AX 树很差，覆盖率一定是部分的——这也是界面上必须保留
`待系统能力` 标记而不能改成「已支持」的原因。

### `03` / `05` 走查

- `03` 基本健康：行内控件、白名单联动、应用挑选浮层、被覆盖标记都工作。
  一处覆盖缺口：**`此刻命中` 徽标在四个原型状态里都不出现**，稿子从没演示过它。
- `05` 有一个真缺陷（已修）：**拦截分布筛选不可逆**。点一条分布会顺带把结果筛选切到
  「被跳过」，但取消时不还原 → 事件流从 7 组变 1 组、再取消只剩 4 组，看起来像「事件丢了」。
  修法是记住联动前的值并在取消时还原；用户手动改过结果筛选则放弃还原点（那是他的新意图）。

---

## 建议的实施顺序

**~~第 0 批 · 正确性~~（已完成）**
上面 9 条 + 断言单测（hotspot 换算与迁移幂等、缓动可见时长占比、左右入场映射等价、editor state 归一化拒绝越界值）。
同时上线两道门禁：`npm run check:design-tokens`（新增 hover-only / 调色板 / 未实现字段三条规则）与
`npm run check:ui-spec`（稿子自检：原生控件数、内联脚本语法、残留外壳 DOM 引用、TDZ 可选链、调色板）。
两个脚本都做过「注入违规 → 确认能抓到 → 还原」的自测，不是只会喊 PASS 的门禁。

**第 1 批 · 共享层**
`PageHeader` / `WorkspacePage` 壳、`EmptyState`、`Segmented`、`NumberField`、`Skeleton`；反馈三分工落地；自动保存 + 撤销 + 快捷键。此批结束后，四个界面的"外框"已经一致。
（九色图标底与 hover-only 操作已在第 0 批清掉并加了门禁。剩余的调色收敛在 `check-design-tokens.mjs` 的
`COLOR_ALLOWLIST` 里逐条登记为 TODO——`TimelineTrackRow` / `data-pill` / `theme-card` /
`ImageFeedbackCard` / `KeyboardPanel` / `PreviewStage`，门禁锁住「不再新增」。）

**第 2 批 · 控件族**
按 `library/controls.html` 实现滑块家族（刻度吸附 / 双向 / 双拖柄 / 值+抖动）、标签 scrub、带预览的下拉（缓动曲线、形状、字体）、二维偏移板、角度盘、贝塞尔编辑器。这批是后面所有面板的地基。

**第 3 批 · 逐界面重做**
光标皮肤 → 应用规则 → 键盘动效 → 诊断面板。每个都能独立发版。

**第 4 批 · 工作台 + 时间轴**
最大的一批：效果卡预设层、可交互舞台、锚点链接时间轴、属性曲线子轨。依赖第 2 批。

**第 5 批 · 深色模式**
令牌层 + 逐组件补深色分支（已知至少 4 个共享组件需要在深色下反相：主按钮、分段控件、kbd、开关）。
