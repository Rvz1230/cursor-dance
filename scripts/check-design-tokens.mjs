/**
 * DESIGN.md 反模式门禁。
 *
 * 为什么是脚本而不是 ESLint 规则：Tailwind 类名不只出现在 JSX 的 className 上，
 * 也出现在普通对象字面量里（例如各处的 tone map），`no-restricted-syntax` 的
 * JSXAttribute 选择器覆盖不到那些位置。
 *
 * 只收录**可机械判定**的反模式。故意不收录的两类：
 * - `will-change` —— DESIGN.md 只禁止「写在静态 CSS 中」。现有 5 处全部位于
 *   运行时动效渲染（粒子 / 键盘反馈 / 氛围），属于被许可的动态用法。
 * - 内联 style 里的 `radial-gradient` / `linear-gradient` —— 效果预览和粒子
 *   渲染本身就在画渐变（AnimatedPreview、PreviewStage），无法与装饰性渐变
 *   自动区分。装饰性渐变的实际写法是 Tailwind 任意值背景类，已由 `bg-[` 覆盖。
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const scanRoot = resolve(projectRoot, "src");
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx"]);

const RULES = [
  {
    id: "arbitrary-radius",
    pattern: /rounded-\[/g,
    message: "禁止任意圆角值，使用 rounded-lg / rounded-xl / rounded-2xl（DESIGN.md 圆角）",
  },
  {
    id: "heavy-shadow",
    pattern: /shadow-(?:xl|2xl)\b/g,
    message: "禁止 shadow-xl / shadow-2xl，卡片用 shadow-sm、浮层用 shadow-lg（DESIGN.md 阴影）",
  },
  {
    id: "decorative-glow",
    pattern: /blur-(?:2xl|3xl)\b/g,
    message: "禁止装饰性 glow 光斑（DESIGN.md 反模式）",
  },
  {
    id: "arbitrary-background",
    pattern: /bg-\[/g,
    message: "禁止任意值背景类（装饰性渐变多以此形式出现），改用 slate 体系底色（DESIGN.md 色彩）",
  },
  {
    id: "arbitrary-z-index",
    pattern: /\bz-\[/g,
    message: "禁止任意 z-index，使用 z-40 / z-50（DESIGN.md 布局）",
  },
  {
    id: "letter-spacing",
    pattern: /\btracking-(?:\[|tighter|tight|wide|wider|widest)/g,
    message: "禁止修改 letter-spacing（DESIGN.md 字体）",
  },
  {
    id: "nonstandard-font-size",
    pattern: /text-\[[0-9]/g,
    message: "禁止非标准字号，统一用 text-2xs / text-xs / text-sm（DESIGN.md 字体）",
  },
  {
    id: "transition-all",
    pattern: /\btransition-all\b/g,
    message: "禁止 transition-all，显式列出过渡属性（DESIGN.md 过渡动画）",
  },
  {
    id: "transform-gpu",
    pattern: /\btransform-gpu\b/g,
    message: "禁止 transform-gpu（永久图层提升）（DESIGN.md 反模式）",
  },
  {
    id: "card-hover-translate",
    pattern: /hover:-translate-y-/g,
    message: "禁止 hover 时卡片位移（DESIGN.md Hover 反馈）",
  },
  {
    id: "h-screen",
    pattern: /\bh-screen\b/g,
    message: "使用 h-dvh 而不是 h-screen（DESIGN.md 布局）",
  },
  {
    id: "hover-only-action",
    // 带 group-focus-within:opacity-100 的能 Tab 到，不算「只在 hover 时可达」。
    pattern: /opacity-0(?=[^"]*group-hover:opacity-100)(?![^"]*group-focus-within:opacity-100)/g,
    message: "操作不得只在 hover 时可达（DESIGN.md 可访问性）——键盘与触控板用户发现不了，改成常显",
  },
  {
    id: "off-palette-color",
    // 先匹配所有带色相的类，再在 allow 里筛掉合法的四个语义色：
    // 这样「哪些色相存在」只需要维护一处。
    pattern: /\b(?:bg|text|ring|border|from|to|via|shadow|decoration|outline|divide|accent|caret)-(?:violet|fuchsia|cyan|red|indigo|purple|lime|orange|yellow|green|blue|pink|emerald|teal|sky|rose|amber)-\d{2,3}\b/g,
    allow: (match) => /-(?:emerald|rose|sky|amber)-/.test(match),
    message: "颜色只有两类：slate 骨架 + 语义四色 emerald/rose/sky/amber（DESIGN.md 色彩）",
  },
  {
    id: "unimplemented-field",
    // trail / trailLength / splash 在 schema 里保留做前向兼容，但运行时没实现。
    // UI 不该暴露它们——摆一个拨了没反应的开关比没有这个开关更糟。
    pattern: /\b(?:trail|trailLength|splash)\b/g,
    message: "trail / trailLength / splash 运行时未实现，UI 不得暴露（schema 仅作前向兼容保留）",
    // 只约束 UI 层：schema、默认值与运行时读写本来就要认这些字段。
    appliesTo: (relativePath) => relativePath.includes("/components/") || relativePath.includes("/pages/"),
  },
];

/**
 * 调色板的显式豁免清单。
 *
 * 每一条都要写清「为什么这是内容色而不是语义色」。这个清单只该因为
 * 「确实是内容色」而增长，不该因为「懒得改」而增长。TODO 项是本轮范围外的存量，
 * 收敛计划见 docs/ui-spec/README.md 的实施顺序。
 */
const COLOR_ALLOWLIST = [
  {
    file: "src/components/ui/theme-identity.ts",
    why: "主题身份色板：主题要能一眼分辨，属内容色。这里是身份色的唯一真值源（封闭集合 amber/teal/sky/rose/slate）",
  },
  {
    file: "src/app/pages/theme-workbench/components/preview-rail/TimelineTrackRow.tsx",
    why: "TODO 时间轴轨道色（第 4 批 · 工作台 + 时间轴一并收敛）",
  },
  {
    file: "src/components/ui/data-pill.tsx",
    why: "TODO tone=\"teal\" 待并入身份色板或改语义色（第 1 批 · 共享层）",
  },
  {
    file: "src/components/ui/theme-card.tsx",
    why: "TODO 选中点的 teal 待改 slate-950（第 1 批 · 共享层）",
  },
  {
    file: "src/app/pages/theme-workbench/components/panels/ImageFeedbackCard.tsx",
    why: "TODO fuchsia 上传区待改 slate（第 3 批 · 逐界面重做）",
  },
  {
    file: "src/app/pages/theme-workbench/components/KeyboardPanel.tsx",
    why: "TODO violet 连击指示待改语义色（第 3 批 · 键盘动效）",
  },
  {
    file: "src/app/pages/theme-workbench/components/preview-rail/PreviewStage.tsx",
    why: "TODO teal 播放指示待改 emerald（第 4 批 · 工作台 + 时间轴）",
  },
];

const COLOR_ALLOWED_FILES = new Set(COLOR_ALLOWLIST.map((entry) => entry.file));

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SCANNED_EXTENSIONS.has(extname(entry.name)) ? [entryPath] : [];
  }));
  return files.flat();
}

const sourceFiles = await collectSourceFiles(scanRoot);
const violations = [];

await Promise.all(sourceFiles.map(async (filePath) => {
  const contents = await readFile(filePath, "utf8");
  const relativePath = relative(projectRoot, filePath);
  const lines = contents.split("\n");
  for (const rule of RULES) {
    if (rule.appliesTo && !rule.appliesTo(relativePath)) continue;
    if (rule.id === "off-palette-color" && COLOR_ALLOWED_FILES.has(relativePath)) continue;
    lines.forEach((line, index) => {
      rule.pattern.lastIndex = 0;
      const matches = line.match(rule.pattern);
      if (!matches) return;
      const offending = rule.allow ? matches.filter((match) => !rule.allow(match)) : matches;
      if (offending.length === 0) return;
      violations.push({
        rule: rule.id,
        message: `${rule.message} —— ${[...new Set(offending)].join(", ")}`,
        file: relativePath,
        line: index + 1,
      });
    });
  }
}));

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

for (const violation of violations) {
  console.log(`FAIL ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
}

const scannedLabel = `${sourceFiles.length} files`;
if (violations.length > 0) {
  console.log(`\nFAIL design tokens: ${violations.length} violation(s) across ${scannedLabel}`);
  process.exitCode = 1;
} else {
  console.log(`PASS design tokens: 0 violations across ${scannedLabel}`);
}
