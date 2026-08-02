/**
 * `docs/ui-spec/` 稿子的自检门禁。
 *
 * 这个脚本存在的理由全部写在 docs/ui-spec/README.md 的「实现级教训」里——
 * 那几条都是走查时**反复**踩到的，靠人眼复查不可靠：
 *
 * 教训 #0/#1：迁到共享外壳后，页面里残留的自有 DOM 引用会让 `$('x')` 返回 null，
 *   `.addEventListener` 抛错 → 从那一行起整段页面脚本不再执行。页面**看起来是正常的**，
 *   但所有交互都死了。同一个坑踩了两次，因为第一次只修了当前页没有全稿排查。
 * 教训 #2：批量文本替换打在不存在的模式上、静默什么都没改；还有一次正则删除切错边界，
 *   留下已删除标识符的引用 → 整段脚本语法错误。
 * 决策 #3/#4：调色板与「不得只在 hover 时可达」也在这里机械化。
 *
 * 用法：node scripts/check-ui-spec.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const specRoot = resolve(projectRoot, "docs/ui-spec");

/** archive/ 是留档的已否决稿，不进实施范围，也不该被门禁约束。 */
const SKIPPED_DIRECTORIES = new Set(["archive"]);

/**
 * 主题身份色（amber / teal / sky / rose / slate）在这里**不需要**豁免条目：
 * 稿子把它写成十六进制数据（`{ id: 'drift', color: '#0d9488' }`），本来就不是
 * Tailwind 颜色类，下面基于类名的规则看不见它。这与代码侧的形态一致——
 * 身份色的唯一真值源是 src/components/ui/theme-identity.ts，
 * 在 check-design-tokens.mjs 里以文件级白名单登记。
 */

/**
 * 允许保留调色板外颜色的行。每一条都必须说明理由——
 * 这个清单只该因为「这确实是内容色」而增长，不该因为「懒得改」而增长。
 */
const COLOR_ALLOWANCES = [
  {
    // 应用头像：真实实现取系统图标，稿子里的底色只是占位，不表达任何语义。
    test: (line) => line.includes("app-icon"),
    why: "应用头像占位色（真实实现取系统图标）",
  },
  {
    // 故意的反模式对照组：components.html 的「改前」要展示九色底有多糟。
    test: (line) => line.includes("data-antipattern"),
    why: "标注过的反模式对照组",
  },
];

const RULES = [
  {
    id: "native-range",
    pattern: /<input[^>]*type="range"/g,
    message: '禁止原生 <input type="range">，用 controls.js 的 Ctl.slider（README 控件统一）',
  },
  {
    id: "native-select",
    pattern: /<select[\s>]/g,
    message: "禁止原生 <select>，用 controls.js 的 Ctl.select（选项要长成结果的样子）",
  },
  {
    id: "third-select",
    pattern: /mini-select/g,
    message: "第三套下拉。只保留 Ctl.select 一套实现（README 控件统一）",
  },
  {
    id: "hover-only-action",
    // 带 group-focus-within:opacity-100 的不算违规：那种能 Tab 到，键盘用户够得着。
    pattern: /opacity-0(?=[^"]*group-hover:opacity-100)(?![^"]*group-focus-within:opacity-100)/g,
    message: "操作不得只在 hover 时可达，改成常显或补 group-focus-within（决策 #4）",
  },
  {
    id: "off-palette-color",
    pattern: /\b(?:bg|text|ring|border|from|to|via|shadow)-(?:violet|fuchsia|cyan|red|indigo|purple|lime|orange|emerald|teal|sky|rose|amber)-\d{2,3}\b/g,
    message: "颜色只有两类：slate 骨架 + 语义四色 emerald/rose/sky/amber（决策 #3）",
    // emerald/rose/sky/amber 是合法语义色，先匹配再在这里筛掉，
    // 这样正则只需要维护「所有带色相的类」一处。
    allow: (match) => /-(?:emerald|rose|sky|amber)-/.test(match),
  },
];

/**
 * 把注释替换成等长空白（保留行号）。
 *
 * 必须做这一步：稿子里到处是「这里原先自带一套页内 toast，$('toastUndo') 变成 null」
 * 这类**讲述历史缺陷**的注释。不剥注释的话，门禁会把说明文字当成真实代码报出来——
 * 一个会喊狼来了的门禁很快就会被忽略。
 */
function blankOut(source, pattern) {
  return source.replace(pattern, (match) => match.replace(/[^\n]/g, " "));
}

function stripComments(source) {
  let out = blankOut(source, /<!--[\s\S]*?-->/g);
  out = blankOut(out, /\/\*[\s\S]*?\*\//g);
  // 行注释：排除 URL 里的 `://`
  out = blankOut(out, /(?<!:)\/\/[^\n]*/g);
  return out;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : collectFiles(join(directory, entry.name));
    }
    return [".html", ".js"].includes(extname(entry.name)) ? [join(directory, entry.name)] : [];
  }));
  return nested.flat();
}

const violations = [];
function report(file, line, rule, message) {
  violations.push({ file: relative(projectRoot, file), line, rule, message });
}

/** 共享外壳拥有的 DOM id。页面自己再引用就是教训 #0/#1 的那个坑。 */
function collectShellOwnedIds(shellSource) {
  const ids = new Set();
  for (const match of shellSource.matchAll(/id=["']([A-Za-z][\w-]*)["']/g)) ids.add(match[1]);
  return ids;
}

const files = await collectFiles(specRoot);
const htmlFiles = files.filter((file) => extname(file) === ".html");
const shellSource = await readFile(join(specRoot, "shell.js"), "utf8");
const shellIds = collectShellOwnedIds(shellSource);

for (const file of files) {
  const lines = stripComments(await readFile(file, "utf8")).split("\n");

  for (const rule of RULES) {
    lines.forEach((line, index) => {
      const matches = line.match(rule.pattern);
      if (!matches) return;
      const offending = rule.allow ? matches.filter((match) => !rule.allow(match)) : matches;
      if (offending.length === 0) return;
      if (COLOR_ALLOWANCES.some((allowance) => allowance.test(line))) return;
      report(file, index + 1, rule.id, `${rule.message} —— ${[...new Set(offending)].join(", ")}`);
    });
  }
}

// ── 内联脚本语法自检（教训 #2）+ 残留外壳 DOM 引用（教训 #0/#1）──
for (const file of htmlFiles) {
  const raw = await readFile(file, "utf8");
  // 语法自检要用原文（注释在脚本里是合法的）；找 DOM 引用要用剥了注释的版本。
  const source = stripComments(raw);
  const usesShell = /shell\.js/.test(source);

  const inlineScripts = [...raw.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  inlineScripts.forEach((match, index) => {
    try {
      new Function(match[1]);
    } catch (error) {
      const line = raw.slice(0, match.index).split("\n").length;
      report(file, line, "inline-script-syntax", `第 ${index + 1} 段内联脚本语法错误：${error.message}`);
    }
  });

  // 页面自己没有声明、却拿 $('x') / getElementById('x') 去取的 id：
  // 如果那个 id 属于共享外壳，就是「被移走的 DOM 还在被引用」——整段脚本会从那行开始死掉。
  const declaredIds = new Set();
  // 同时覆盖静态标记与模板字符串里转义过的 id=\"x\"（innerHTML 动态插入）
  for (const match of source.matchAll(/id=\\?["']([A-Za-z][\w-]*)\\?["']/g)) declaredIds.add(match[1]);

  const referenced = new Map();
  for (const match of source.matchAll(/(?:\$|getElementById)\(\s*["']([A-Za-z][\w-]*)["']\s*\)/g)) {
    const line = source.slice(0, match.index).split("\n").length;
    if (!referenced.has(match[1])) referenced.set(match[1], line);
  }

  for (const [id, line] of referenced) {
    if (declaredIds.has(id)) continue;
    if (usesShell && shellIds.has(id)) continue; // 外壳提供的，正常引用
    report(
      file,
      line,
      "stale-dom-reference",
      `引用了本页未声明、外壳也不提供的 #${id}——运行时会取到 null 并让整段脚本从这里停掉`,
    );
  }
}

// ── 重建 className 时把布局类一起写死 ──
//
// `stage.className = 'relative h-[212px] … ' + BG[k]` 这种写法为了换个底色，
// 顺手把布局类整串重写了。一旦标记里的布局改过（舞台从固定高度改成 min-h-0 flex-1），
// 这串字面量就成了一颗定时炸弹：点一下底色，舞台被打回 212px 且不可逆——
// 而 212px 正是时间轴改成底部抽屉要消除的那个数。
// 正确写法是只增删「要变的那个类」（classList.remove/add）。
// 判定条件刻意收窄成两条同时成立，避免误伤合理写法：
//   1. 字面量里含**实测出来的**尺寸（任意值类 h-[…] / w-[…] / min-h-[…] / max-h-[…]）——
//      这类值编码了一个具体的布局决定，最容易与标记里的实际布局脱钩；
//      而 flex-1 / absolute / h-4 这些固定 token 不算。
//   2. 该字面量后面还拼接了动态部分（`+`），说明它是在**按状态切换**，
//      而不是在给一个 JS 新建元素下定义。
// 这样既能抓到 01 那个 `'… h-[212px] …' + BG[k]`，也不会误报
// shell.js 里一次性初始化的 protoHost，或组件自己设完整基础类的 seg-item / switch。
const MEASURED_SIZE_CLASS = /\b(?:min-h|max-h|min-w|max-w|h|w)-\[/;

for (const file of files) {
  // 必须整源扫描而不是逐行：真实写法常常把 `+ 动态部分` 换行放到下一行，
  // 逐行匹配会漏掉——这一点是靠门禁自测（注入原始写法后确认能报出来）才发现的。
  const source = stripComments(await readFile(file, "utf8"));
  const pattern = /\.className\s*=\s*(['"`])([^'"`]*)\1\s*(\+)?/g;
  for (const match of source.matchAll(pattern)) {
    if (!MEASURED_SIZE_CLASS.test(match[2]) || !match[3]) continue;
    const line = source.slice(0, match.index).split("\n").length;
    report(
      file,
      line,
      "classname-rebuild-with-layout",
      "按状态重建 className 时写死了实测尺寸类。标记里的布局一改，这串字面量就会静默失配"
      + "（01 的舞台就是这样被打回 212px 的）——改用 classList.remove/add 只切换真正要变的那个类",
    );
  }
}

// ── 可选链守不住的 TDZ（README 教训 #0 的第三种复发形态）──
//
// `sizeSlider?.set(v)` 看着像是防了「还没初始化」，但可选链只防 null/undefined。
// 如果 sizeSlider 是**后面**才用 const/let 声明的，在它之前访问会抛
// ReferenceError: Cannot access 'X' before initialization ——
// 而 Ctl.slider 在构造时就会同步跑一次 onChange，正好踩进这个窗口。
// 后果是整段页面脚本从那行起不执行，页面看着正常、交互全死。
for (const file of files) {
  const source = stripComments(await readFile(file, "utf8"));
  const lines = source.split("\n");

  const declaredAt = new Map();
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
      if (!declaredAt.has(match[1])) declaredAt.set(match[1], index + 1);
    }
  });

  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\b([A-Za-z_$][\w$]*)\?\./g)) {
      const declarationLine = declaredAt.get(match[1]);
      if (declarationLine === undefined || declarationLine <= index + 1) continue;
      report(
        file,
        index + 1,
        "optional-chain-before-init",
        `${match[1]}?. 出现在它的 const/let 声明（第 ${declarationLine} 行）之前——`
        + "可选链防不住 TDZ ReferenceError，会让整段脚本从这里停掉。改成前置 let 声明再赋值",
      );
    }
  });
}

// ── 功能对等：稿子有没有丢掉真实代码里已经在工作的能力 ──
//
// 这是本轮实测到的**最危险**失效模式，而且走查查不出来：
// 走查只能发现「稿子里画错的」，发现不了「稿子里没画的」。
// 已经因此丢过五个在工作的功能——列宽拖拽、卡片重置、卡片折叠、预览自动循环、
// 主题卡 ⋯ 菜单（复制/重命名/换图标/导出/删除）。光看稿子永远看不出来，
// 因为「缺席」没有任何视觉痕迹。
//
// 做法：一条能力两边各留一个锚点。code 侧锚点消失 → 该能力可能真的被删了，
// 这条清单该被**有意识地**删掉而不是默默失配；spec 侧锚点消失 → 稿子把它丢了。
const PARITY = [
  { cap: "列宽自由拖拽", code: ["src/app/pages/theme-workbench/hooks/useWorkbenchColumnLayout.ts", /startResizeColumns/], spec: [/colSplit/] },
  { cap: "效果卡独立重置", code: ["src/app/pages/theme-workbench/components/panels/ResetCardButton.tsx", /export function ResetCardButton/], spec: [/data-cardreset/] },
  { cap: "效果卡手动折叠", code: ["src/components/ui/panel.tsx", /collapsible/], spec: [/data-cardfold/] },
  { cap: "预览自动循环", code: ["src/app/pages/theme-workbench/components/preview-rail/PreviewPlaybackControls.tsx", /autoPlay/], spec: [/自动重播/] },
  { cap: "主题：复制", code: ["src/app/pages/theme-workbench/hooks/workbenchThemeCommands.ts", /duplicateTheme/], spec: [/id: 'duplicate'/] },
  { cap: "主题：删除", code: ["src/app/pages/theme-workbench/hooks/workbenchThemeCommands.ts", /deleteTheme/], spec: [/id: 'delete'/] },
  { cap: "主题：重命名", code: ["src/app/pages/theme-workbench/hooks/workbenchThemeCommands.ts", /renameTheme/], spec: [/id: 'rename'/] },
  { cap: "主题：换图标", code: ["src/app/pages/theme-workbench/hooks/workbenchThemeCommands.ts", /updateThemeIcon/], spec: [/id: 'icon'/] },
  { cap: "主题：导出", code: ["src/app/pages/theme-workbench/hooks/workbenchThemeCommands.ts", /exportTheme/], spec: [/id: 'export'/] },
  { cap: "内置主题不可删的约束", code: ["src/app/pages/theme-workbench/lib/themeWorkbenchThemeLifecycle.ts", /内置主题不能删除/], spec: [/内置主题不能删除/] },
  { cap: "光标：从主皮肤复制", code: ["src/app/pages/theme-workbench/hooks/workbenchCursorCommands.ts", /copyDefaultCursorSkinState/], spec: [/继承|从主皮肤/] },
  { cap: "光标：清除该状态", code: ["src/app/pages/theme-workbench/hooks/workbenchCursorCommands.ts", /clearCursorSkinState/], spec: [/清除|移除皮肤/] },
  { cap: "规则：排序", code: ["src/app/pages/theme-workbench/hooks/themeWorkbenchStateStore.ts", /rules\/reorder/], spec: [/排序|⌥↑/] },
  // 第 1 批 A 的五个共享组件：稿子是它们的形态依据，两边都不能单方面消失
  { cap: "共享组件 PageHeader", code: ["src/components/ui/page-header.tsx", /export function PageHeader/], spec: [/PageHeader/] },
  { cap: "共享组件 EmptyState", code: ["src/components/ui/empty-state.tsx", /export function EmptyState/], spec: [/EmptyState/] },
  { cap: "共享组件 Segmented", code: ["src/components/ui/segmented.tsx", /export function Segmented/], spec: [/Segmented/] },
  { cap: "共享组件 NumberField", code: ["src/components/ui/number-field.tsx", /export function NumberField/], spec: [/NumberField/] },
  { cap: "共享组件 Skeleton", code: ["src/components/ui/skeleton.tsx", /export function PanelSkeleton/], spec: [/Skeleton/] },
];

const specBlob = (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("\n");
for (const entry of PARITY) {
  const [codePath, codeRe] = entry.code;
  let codeSource = null;
  try {
    codeSource = await readFile(resolve(projectRoot, codePath), "utf8");
  } catch {
    violations.push({
      file: codePath, line: 1, rule: "parity-code-anchor-gone",
      message: `「${entry.cap}」的代码锚点文件不存在了。若功能确实删了，请同时删掉这条对等清单；否则修锚点`,
    });
    continue;
  }
  if (!codeRe.test(codeSource)) {
    violations.push({
      file: codePath, line: 1, rule: "parity-code-anchor-gone",
      message: `「${entry.cap}」在代码里找不到锚点 ${codeRe}。若功能确实删了，请同时删掉这条对等清单`,
    });
    continue;
  }
  if (!entry.spec.some((re) => re.test(specBlob))) {
    violations.push({
      file: "docs/ui-spec", line: 1, rule: "parity-spec-missing",
      message: `真实代码有「${entry.cap}」，稿子里找不到对应形态——按稿子重构会把这个已工作的功能删掉`,
    });
  }
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const violation of violations) {
  console.log(`FAIL ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
}

const scanned = `${files.length} files (${htmlFiles.length} html)`;
if (violations.length > 0) {
  console.log(`\nFAIL ui-spec: ${violations.length} violation(s) across ${scanned}`);
  process.exitCode = 1;
} else {
  console.log(`PASS ui-spec: 0 violations across ${scanned}`);
}
