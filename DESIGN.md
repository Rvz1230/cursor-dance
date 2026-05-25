# CursorDance Design Language

## 总体风格："克制柔软"（Soft-Minimal Linear）

灵感来源：Linear / Radix UI 原语 / Apple HIG。用大圆角 + 1px 描边 + 极浅阴影表达层级，hover 反馈克制不喧哗，单色 slate 体系配语义功能色。

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
- **主色**：slate 全系列（`slate-50` ~ `slate-950`）
- **文字**：`text-slate-900`（标题）/ `text-slate-700`（正文）/ `text-slate-600`（辅助）/ `text-slate-500`（placeholder）
- **背景**：`bg-white`（卡片）/ `bg-slate-50`（hover ghost / 次级面板）/ `bg-slate-100`（页面底色）
- **功能色（仅用于语义目的，非装饰）**：
  - `emerald`：成功 toast / Slider 滑块 / 启用状态指示
  - `rose`：删除操作 / 错误 toast / 危险确认按钮
  - `sky`：信息 toast / AI 功能 chip
  - `amber`：未保存指示 / 自定义主题 chip / 警告
  - `teal`：内置主题 chip / 选中指示点
- **禁止** 装饰性渐变（`linear-gradient` / `radial-gradient`）
- **禁止** 紫色 / 多色渐变 / glow 效果
- **每视图只用一个强调色**

### Hover 反馈（Hover State）
- Ghost 操作：`hover:bg-slate-50` 或 `hover:bg-slate-50/60`
- 边框强化：`hover:border-slate-300`
- 文字强化：`hover:text-slate-900`
- 危险操作：`hover:bg-rose-50` / `hover:bg-rose-700`
- **禁止** hover 时卡片位移（`-translate-y` / `scale`）

### 过渡动画（Transition）
- 颜色 / 背景 / 边框过渡：`transition-colors` 或 `transition-[color,background-color,border-color,box-shadow]`
- 变换过渡（仅 active scale）：`transition-[transform,color,background-color,border-color,box-shadow]`
- 透明度过渡（操作按钮出现）：`transition-opacity duration-150`
- 时长：`duration-150`（默认，干脆不拖沓）
- 缓动：`ease-out`（入场）
- **禁止** `transition-all`
- **禁止** `transform-gpu`（永久图层提升）
- **禁止** `will-change` 写在样式表里
- **禁止** `hover:scale-[...]` 或 `hover:-translate-y-*` 在列表卡片上
- `active:scale-[0.97]` 或 `active:scale-[0.995]` 可用于点击反馈

### 字体（Typography）
- 标题：`text-sm font-semibold` + `text-balance`
- 正文：`text-sm` / `text-xs` + `text-pretty`
- 辅助文字：`text-xs text-slate-500`
- 数据展示：`tabular-nums`
- 紧凑 UI：`truncate` 或 `line-clamp`
- **禁止** `tracking-*`（不改 letter-spacing）
- **禁止** `uppercase` 作为视觉风格

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
- 尊重 `prefers-reduced-motion`

## 组件基元

- 全部使用 Radix UI 基元（Dialog / Popover / Select / Switch / Toast / Tabs / Accordion / Slider）
- 样式合并使用 `cn()`（`clsx` + `tailwind-merge`）
- 不混用基元系统
- 不手写 keyboard/focus 行为

## 反模式（Anti-patterns）

以下是本项目中已清理或禁止的模式，新增功能时**不得使用**：

- ❌ `transition-all`
- ❌ `transform-gpu`
- ❌ `hover:-translate-y-*` 或 `hover:scale-[>1]` 在列表卡片
- ❌ 卡片标题行放 check 图标（用左侧 accent bar + 背景色表达选中）
- ❌ `tracking-*` / `letter-spacing` 修改
- ❌ `rounded-[...]` 任意圆角值
- ❌ `shadow-xl` / `shadow-2xl`
- ❌ 装饰性渐变背景
- ❌ 紫色 / 多色渐变 / glow 效果
- ❌ `z-[...]` 任意 z-index
- ❌ `h-screen`（用 `h-dvh`）
- ❌ `<button>` 嵌套在 `<button>` 内
- ❌ `will-change` 写在静态 CSS 中
