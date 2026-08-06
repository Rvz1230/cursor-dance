/**
 * 领域命名与组件边界门禁。
 *
 * 这些规则只覆盖可以稳定机械判断的约束：运行时统一使用 theme 词汇，
 * 工作台展示元数据使用 WorkbenchThemeMeta，共享 UI 与业务组件各自遵守文件命名，
 * 并禁止重新引入会隐藏真实依赖的组件 barrel / 混合聚合入口。
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(projectRoot, "src");
const workbenchRoot = resolve(sourceRoot, "app/pages/theme-workbench");
const workbenchComponentsRoot = resolve(workbenchRoot, "components");
const sharedUiRoot = resolve(sourceRoot, "components/ui");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const violations = [];

function report(filePath, line, rule, message) {
  violations.push({
    file: relative(projectRoot, filePath),
    line,
    rule,
    message,
  });
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [entryPath] : [];
  }));
  return nested.flat();
}

async function checkTextRule(files, rule) {
  await Promise.all(files.map(async (filePath) => {
    const contents = await readFile(filePath, "utf8");
    contents.split("\n").forEach((line, index) => {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) report(filePath, index + 1, rule.id, rule.message);
    });
  }));
}

const runtimeFiles = (
  await Promise.all([
    "shared/effect-runtime",
    "extension",
    "desktop/renderer/engine",
    "desktop/renderer/overlay",
  ].map((directory) => collectSourceFiles(resolve(sourceRoot, directory))))
).flat();

await checkTextRule(runtimeFiles, {
  id: "legacy-runtime-theme-name",
  pattern: /\b(?:scheme|schemeId|getActiveScheme|previewScheme|resolvedScheme|targetScheme|activeScheme)\b/g,
  message: "运行时领域统一使用 theme / themeId / getActiveTheme，不得重新引入 scheme 旧命名",
});

const workbenchFiles = await collectSourceFiles(workbenchRoot);
const sharedUiFiles = await collectSourceFiles(sharedUiRoot);
await checkTextRule(workbenchFiles, {
  id: "legacy-workbench-theme-meta",
  pattern: /\b(?:ThemeLibraryItem|buildThemeLibraryItem|themePackToThemeLibraryItem)\b/g,
  message: "工作台展示元数据统一使用 WorkbenchThemeMeta 命名",
});
await checkTextRule([...workbenchFiles, ...sharedUiFiles], {
  id: "legacy-shared-control-wrapper",
  pattern: /\b(?:SmallSelect|ControlSlider|ColorOptions)\b|\/(?:small-select|control-slider|color-options)["']/g,
  message: "共享控件统一使用 Select / Slider / ColorField，不得恢复薄包装或旧模块",
});
await checkTextRule([...workbenchFiles, ...sharedUiFiles], {
  id: "native-range-control",
  pattern: /type=["']range["']/g,
  message: "业务 UI 不得直接使用原生 range；统一使用共享 Slider 交互契约",
});

const allSourceFiles = await collectSourceFiles(sourceRoot);
await checkTextRule(
  allSourceFiles.filter((filePath) => filePath !== resolve(sourceRoot, "shared/effect-core/easing-data.ts")),
  {
    id: "duplicate-easing-data-table",
    pattern: /\b(?:export\s+)?const\s+EASINGS\b/g,
    message: "缓动数据表只允许在 effect-core/easing-data.ts 定义",
  },
);
await checkTextRule(
  allSourceFiles.filter((filePath) => filePath !== resolve(sharedUiRoot, "control-data.ts")),
  {
    id: "duplicate-control-data-table",
    pattern: /\b(?:export\s+)?const\s+(?:FONTS|CONTENT_PALETTE|SHAPE_PATH)\b/g,
    message: "字体、内容色板和形状表只允许在 components/ui/control-data.ts 定义",
  },
);
await checkTextRule(workbenchFiles, {
  id: "mixed-workbench-controls-entry",
  pattern: /\bWorkbenchControls\b/g,
  message: "禁止恢复混合 WorkbenchControls 入口；组件应从职责明确的文件直接导入",
});
await checkTextRule(workbenchFiles, {
  id: "legacy-workbench-component-name",
  pattern: /\bAiSchemePanel\b|ai-scheme/g,
  message: "AI 工作台组件统一使用 assistant / proposal 命名；scheme 仅保留在远端 API 适配边界",
});

async function checkComponentFileNames() {
  const workbenchEntries = await readdir(workbenchComponentsRoot, { withFileTypes: true });
  for (const entry of workbenchEntries) {
    if (!entry.isFile() || extname(entry.name) !== ".tsx") continue;
    if (!/^[A-Z][A-Za-z0-9]*\.tsx$/.test(entry.name)) {
      report(
        join(workbenchComponentsRoot, entry.name),
        1,
        "workbench-component-file-name",
        "工作台顶层组件文件使用 PascalCase，并与组件职责一一对应",
      );
    }
  }

  const sharedUiEntries = await readdir(sharedUiRoot, { withFileTypes: true });
  for (const entry of sharedUiEntries) {
    if (!entry.isFile() || extname(entry.name) !== ".tsx") continue;
    if (!/^[a-z][a-z0-9-]*\.tsx$/.test(entry.name)) {
      report(
        join(sharedUiRoot, entry.name),
        1,
        "shared-ui-file-name",
        "共享 UI 组件文件统一使用 kebab-case",
      );
    }
  }
}

async function checkComponentBarrels() {
  const componentFiles = await collectSourceFiles(workbenchComponentsRoot);
  for (const filePath of componentFiles) {
    if (/\/index\.tsx?$/.test(filePath)) {
      report(
        filePath,
        1,
        "workbench-component-barrel",
        "工作台组件禁止新增 index barrel；直接导入真实组件文件以保持依赖可见",
      );
    }
  }
}

await checkComponentFileNames();
await checkComponentBarrels();

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const violation of violations) {
  console.log(`FAIL ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
}

if (violations.length > 0) {
  console.log(`\nFAIL code conventions: ${violations.length} violation(s)`);
  process.exitCode = 1;
} else {
  console.log(`PASS code conventions: 0 violations across ${allSourceFiles.length} files`);
}
