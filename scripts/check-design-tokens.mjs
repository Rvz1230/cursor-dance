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
];

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
  const lines = contents.split("\n");
  for (const rule of RULES) {
    lines.forEach((line, index) => {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(line)) return;
      violations.push({
        rule: rule.id,
        message: rule.message,
        file: relative(projectRoot, filePath),
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
