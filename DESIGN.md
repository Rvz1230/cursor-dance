# CursorDance Design Language

> 动效与色彩两节在 2026-08-04 按 `docs/ui-spec/DECISIONS.md` 裁决 10 / 11 重写。
> 原因：这两节原本是为**扩展的设置表单页**写的，而现在要管一个**动效创作工具**——
> 一个只允许过渡颜色、只有一个强调色的规范，会让时间轴的五条轨长得一样、
> 让抽屉展开时的布局变化无法被读懂。

## 总体风格："克制柔软"（Soft-Minimal Linear）

灵感来源：Linear / Radix UI 原语 / Apple HIG。用大圆角 + 1px 描边 + 极浅阴影表达层级，hover 反馈克制不喧哗，单色 slate 体系配语义功能色。

**外壳克制，内容鲜明。** 这条是本设计语言的分界线：应用外壳（导航、面板、控件、状态）
保持单色克制；**用户创作的效果、以及用来区分它们的分类标识**不受"克制"约束——
它们是内容，内容需要辨识度。下面每一节都按这条分界线区分"外壳"与"内容"。

## Design Tokens

### 圆角（Border Radius）
- 浮层容器（Dialog / Popover / Select dropdown）：`rounded-2xl`（16px）
- 卡片 / 面板（Panel / ThemeCard / SettingSection）：`rounded-xl`（12px）
- 表单控件（Input / Select trigger / Button）：`rounded-xl`（12px）
- 图标按钮（icon-only button）：`rounded-xl`（12px）
- chip / badge / pill：`rounded-full` 或 `rounded-lg`（8px）
- 菜单项（dropdown item）：`rounded-lg`（8px）
- **禁止** `rounded-[...]` 任意值，优先使用 Tailwind 默认尺度

### 阴影（Shadow）
- 浮层（Popover / Dialog / Select dropdown）：`shadow-lg`
- 卡片 / 面板 / 按钮：`shadow-sm`
- 图标按钮 hover 出现时：`shadow-sm` + `ring-1 ring-slate-200`
- **禁止** `shadow-xl` / `shadow-2xl`（过重，与克制风格冲突）

### 边框（Border）
- 默认容器边框：`border border-slate-200`
- 选中 / 活跃态：`border-slate-950`
- 卡片默认：`border-slate-200/80`
- hover 强化：`hover:border-slate-300`
- 危险操作：`border-rose-200`

### 色彩（Color）

颜色分**三类**，各有各的规矩。混用三类是最常见的错误。

#### 1. 外壳色（骨架）
- **主色**：slate 全系列（`slate-50` ~ `slate-950`）
- **文字**：`text-slate-900`（标题）/ `text-slate-700`（正文）/ `text-slate-600`（辅助）/ `text-slate-500`（placeholder）
- **背景**：`bg-white`（卡片）/ `bg-slate-50`（hover ghost / 次级面板）/ `bg-slate-100`（页面底色）
- **每视图只用一个强调色** —— 这条**只约束外壳**

#### 2. 语义色（状态，不是装饰）
- `emerald`：成功 toast / 启用状态指示
- `rose`：删除操作 / 错误 toast / 危险确认按钮
- `sky`：信息 toast / AI 功能 chip
- `amber`：未应用到桌面 / 自定义主题 chip / 警告
- 语义色**只表达状态**。用它来区分"这是哪一类东西"是错的——那是第 3 类的职责

#### 3. 内容色 / 分类色（封闭集合）

**新增类别**（DECISIONS.md 裁决 11）。用途只有两个：**让用户创作的内容有辨识度**，
以及**让并列的同类对象一眼可分**。

唯一真值源：`src/components/ui/theme-identity.ts`。封闭集合，七色：

| 色 | 用在 |
| --- | --- |
| `amber` | 飘字 |
| `sky` | 粒子 |
| `teal` | 波纹 |
| `rose` | 音效 |
| `indigo` | 动画 |
| `orange` | 贴纸 |
| `slate` | 触发 / 光标反馈（骨架类通道） |

规矩：

- **一个效果类型在全应用只有一个颜色。** 时间轴的通道块、「本次输出」chip、
  诊断事件流的效果类型标记，三处**必须共用同一份映射**——否则"哪个是波纹"要在
  三个地方各学一次
- 分类色**只做标识**，不做背景大面积铺色；块体仍是白底 + 该色描边/左侧 accent
- 用户可选的效果颜色（飘字颜色、粒子调色板等）是**用户内容**，
  完全不受本调色板约束，包括 `violet` / `fuchsia` / `cyan`
- 新增分类色必须先改 `theme-identity.ts`（封闭集合的意义就在于不能就地发明）

#### 三类共同的禁令
- **禁止** 装饰性渐变（`linear-gradient` / `radial-gradient`）作为**外壳**背景
- **禁止** 用语义色承担分类职责，或用分类色承担状态职责
- **禁止** glow 作为外壳装饰（作为**用户效果**的一种是允许的）

### Hover 反馈（Hover State）
- Ghost 操作：`hover:bg-slate-50` 或 `hover:bg-slate-50/60`
- 边框强化：`hover:border-slate-300`
- 文字强化：`hover:text-slate-900`
- 危险操作：`hover:bg-rose-50` / `hover:bg-rose-700`
- **禁止** hover 时卡片位移（`-translate-y` / `scale`）

### 选中态的权重（Selected State）

`bg-slate-900` 实心是本设计语言里**最重的**视觉权重，所以它是一种稀缺资源。

- **实心深底只留给页面主操作**（ux 规格 §5：一个页面只能有一个视觉上的主操作）
- 分段控件的选中格、预设 chip 的当前项、效果卡的启用态、倍速档位——这些是
  **并列项里的当前项**，不是主操作。用低权重表达：`bg-slate-100` + `text-slate-900`
  + 左侧 2px accent，或 `ring-1 ring-slate-900/10`
- 判据：**一屏里的深底块超过 2 个，就说明权重用错了**。所有控件权重接近时，
  用户读不出哪个是主操作
- 选中态必须**同时**有非颜色的编码（accent bar / 图标 / 位置），
  不能只靠深浅——这也是 a11y 要求（不能只用颜色传达信息）

### 过渡动画（Transition）—— 三层模型

动效分三层，**各层的目的不同，所以规范不同**。把它们混成一套，就会得到现在这个结果：
全稿只会动颜色，而所有尺寸变化都是瞬跳。

#### L1 · 反馈层（这个东西响应了我）
范围：hover / active / focus / 选中态。
- 属性：只动 `color` / `background-color` / `border-color` / `box-shadow` / `opacity`
- 时长：`duration-150`（120–160ms 区间内）
- 缓动：`ease-out`
- 写法：`transition-colors` 或 `transition-[color,background-color,border-color,box-shadow]`
- `active:scale-[0.97]` / `active:scale-[0.995]` 可用于点击反馈

#### L2 · 布局因果层（是谁让谁变小了）
范围：抽屉展开/折叠、侧栏展开/折叠、卡片折叠、列宽拖拽松手、分区切换、浮层进出。
- 属性：**允许 `height` / `width` / `transform` / `grid-template-columns`**
- 时长：**180–220ms**（默认 `duration-200`）
- 缓动：`ease-out`
- 共享类：`.motion-layout`（定义在 `_src.css`，含 `prefers-reduced-motion` 分支）

**L2 的职责是表达因果，不是装饰。** 判据很具体：一次操作同时改变了两个区域的尺寸时
（展开抽屉 → 舞台变小），没有过渡的话用户读不出这两件事的关系，只会觉得
"那块东西消失了"。凡是"我动了 A，B 的尺寸也变了"，B 必须有 L2 过渡。

拖拽**过程中**不加过渡（会滞后跟手），只在松手 commit 时过渡。

#### L3 · 内容效果层（用户创作的东西）
范围：舞台/浮层里渲染的效果本身——粒子、波纹、飘字、光标反馈。
- **不受本规范约束**：时长、缓动、过冲、颜色全部由用户配置决定
- 唯一约束是性能预算（`performance.maxActiveEffects`）与「低刺激模式」上限

#### 三层共同的禁令
- **禁止** `transition-all`（改为列举属性；L2 也要列举）
- **禁止** `transform-gpu`（永久图层提升）
- **禁止** `will-change` 写在静态样式表里
- **禁止** `hover:scale-[...]` / `hover:-translate-y-*` 在列表卡片上（那是 L1 范围，L1 不动 transform）

#### `prefers-reduced-motion` —— 硬约束，不是建议
- L1：保留（颜色过渡不构成动态刺激）
- L2：**降为 0ms**
- L3：自动重播关闭、骨架脉冲关闭、AI 活动跳点关闭；**手动预览仍然可用**
  （用户主动点一下要看效果，这是他的意图，不该被剥夺）
- 分支写在 CSS 里（`@media (prefers-reduced-motion: reduce)`），**不要用 JS 判断**——
  JS 判断会漏掉运行中改系统设置的情况
- 另有产品级的「低刺激模式」（见 `07-settings.html`）：闪烁频率上限、粒子密度上限、
  连续触发上限。它与系统开关是两件事，前者是用户主动挑的强度，后者是系统偏好

### 字体（Typography）
- 标题：`text-sm font-semibold` + `text-balance`
- 正文：`text-sm` / `text-xs` + `text-pretty`
- 辅助文字：`text-xs text-slate-500`
- 密集展示：`text-2xs`（**11px**，`line-height: 1rem`）— 时间轴刻度、chip 内数值、tooltip 等 UI 密集区域
  - 2026-08-04 从 10px 提到 11px（DECISIONS.md 裁决 8）。`line-height` 与 `text-xs` 相同，
    所以**行高零变化**，代价只是宽度涨约 9%
  - **`text-2xs` 不得承载必要信息**（ux 规格 §5）。判据：这句话是**结论**还是**补充说明**？
    结论（控件名、状态徽标、行内动作、规则内容、裁决结论）一律 `text-xs`；
    只有纯补充说明（「按 Esc 可取消」「列表来源」）才用 `text-2xs`。
    目标是每个界面 ≤ 8 处，由门禁 `text-2xs-budget` 执行
- 数据展示：`tabular-nums`
- 紧凑 UI：`truncate` 或 `line-clamp`
- **禁止** `text-[9px]` / `text-[10px]` / `text-[11px]` / `text-[13px]` 等非标准字号（统一用 `text-2xs` 或 `text-xs`）
- **禁止** `tracking-*`（不改 letter-spacing）
- **禁止** `uppercase` 作为视觉风格

#### 排版层级（Typography Hierarchy）
一组弹窗 / 面板内的文本层级用「字号 × 字重 × 颜色」三元组表达，每下一级都同时降一档。这是 `AiSettingsDialog` 已落地的样板，新写面板沿用即可：

| 角色 | 类名 | 用途示例 |
| --- | --- | --- |
| L1 容器标题 | `text-base font-semibold text-slate-900` | Dialog 标题、面板主标题 |
| L2 段落 / 描述 | `text-xs leading-relaxed text-slate-500` | 标题下的解释、说明性副本 |
| L3 表单标签 | `text-xs font-medium text-slate-600` | Input / Select 的 `<label>` |
| L4 输入控件文本 | `text-sm text-slate-700`（由 `<Input>` 内置） | 用户填入的值 |
| L5 内联徽标 / 提示 | `text-2xs font-semibold` 或 `text-2xs text-slate-400` | 「已保存」、状态徽标、刻度数字 |
| L6 行动按钮 | `text-xs font-medium`（高度 `h-7` / `h-8`） | 段内可点的次级按钮 |
| 反馈条 | `rounded-xl bg-{tone}-50 px-3 py-2 text-xs leading-relaxed text-{tone}-700` | 错误 / 成功条 |

要点：
- L1→L5 字号单调递减（base → xs → 2xs），字重最多 `semibold`，不堆叠多重 `font-bold`。
- 颜色饱和度跟字号同步衰减：`slate-900` → `-600` → `-500` → `-400`，禁止反向（小字反而更深更显眼）。
- 标签（L3）始终 `font-medium`，描述（L2）始终 `font-normal`，避免「标签当正文」错位。
- 同一面板内不要出现两种 L1。需要分组时用 `SectionTitle` 或 `text-xs font-medium text-slate-600` 的 L3 当组标题。

### 间距 & 尺寸（Spacing & Sizing）
- 图标按钮：`size-9`（36px）或 `size-8`（32px）
- 图标尺寸：`size-4`（16px）
- 容器内边距：`p-3` / `px-3 py-2.5` / `p-1`（紧凑菜单）
- 卡片间距：`gap-2` / `gap-2.5`
- 图标与文字间距：`gap-2` / `gap-2.5`
- 方形元素用 `size-*`，不用 `w-*` + `h-*`

### 布局（Layout）
- 全高容器：`h-dvh`（不是 `h-screen`）
- 固定元素：尊重 `safe-area-inset`
- z-index：使用 Tailwind 固定尺度（`z-40` overlay / `z-50` 浮层），**禁止** `z-[...]` 任意值

### 可访问性（Accessibility）
- 图标按钮必须有 `aria-label`
- 危险操作使用 `AlertDialog`
- 空状态提供明确的下一步操作
- 错误信息紧邻操作区域展示
- `prefers-reduced-motion` 是**硬约束**，见「过渡动画」节（原先写「尊重」，
  而全稿实测 0 处实现——一条没有判据的建议等于没有）
- **视觉上有状态的控件必须有对应的 ARIA 状态**，缺一不可：
  | 视觉表达 | 必须携带 |
  | --- | --- |
  | 分段控件当前格、预设 chip 当前项、倍速档位 | `role="radio"` + `aria-checked`，或 `aria-pressed` |
  | 开关（`.switch-knob` 一类） | `role="switch"` + `aria-checked` |
  | 折叠/展开触发器 | `aria-expanded` |
  | 滑块 | `role="slider"` + `aria-valuenow` + **`aria-valuemin`/`aria-valuemax`** + 可及名称 |
  | 单选卡组（如「默认行为」两张卡） | `radiogroup` + `radio` + `aria-checked` + 方向键 + roving tabindex |
  判据：**只靠 class 表达的选中态，读屏器听不出来。** 由门禁 `aria-state-missing` 执行

## 组件基元

- 全部使用 Radix UI 基元（Dialog / Popover / Select / Switch / Toast / Tabs / Accordion / Slider）
- 样式合并使用 `cn()`（`clsx` + `tailwind-merge`）
- 不混用基元系统
- 不手写 keyboard/focus 行为

## 反模式（Anti-patterns）

以下是本项目中已清理或禁止的模式，新增功能时**不得使用**：

- ❌ `transition-all`（三层都禁；列举属性）
- ❌ `transform-gpu`
- ❌ `hover:-translate-y-*` 或 `hover:scale-[>1]` 在列表卡片
- ❌ 卡片标题行放 check 图标（用左侧 accent bar + 背景色表达选中）
- ❌ `tracking-*` / `letter-spacing` 修改
- ❌ `rounded-[...]` 任意圆角值
- ❌ `shadow-xl` / `shadow-2xl`
- ❌ 装饰性渐变背景（作为**外壳**；用户效果不受限）
- ❌ 用**外壳**的紫色 / 多色渐变 / glow 装饰（用户效果不受限，分类色走封闭集合）
- ❌ `z-[...]` 任意 z-index
- ❌ `h-screen`（用 `h-dvh`）
- ❌ `<button>` 嵌套在 `<button>` 内
- ❌ `will-change` 写在静态 CSS 中
- ❌ **尺寸变化不加过渡**（L2 范围内的元素必须带 `.motion-layout`）
- ❌ **只靠 class 表达选中/展开态**（必须同时有 ARIA 状态）
- ❌ **一屏出现 3 个以上 `bg-slate-900` 实心块**
- ❌ **同一个效果类型在不同界面用不同颜色**（分类色必须共用一份映射）

### 已废弃的反模式（本轮解除）

保留可追溯，不要再当规则引用：

- ~~❌ 变换过渡仅允许 `active:scale`~~ → 由 L2 布局因果层解除（DECISIONS.md 裁决 10）
- ~~❌ 时长统一 `duration-150`~~ → 分层：L1 150ms / L2 200ms
- ~~颜色只有两类~~ → 三类，新增内容色/分类色（裁决 11）
- ~~`text-2xs` = 10px~~ → 11px（裁决 8）
