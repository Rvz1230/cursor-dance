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
  {
    /*
      内容色 / 分类色（DECISIONS.md 裁决 11）。

      这一类是 2026-08-04 新增的第三类颜色。它存在的理由很具体：时间轴上五条轨
      原先全是 `border-slate-300 bg-white`，**长得完全一样**，通道身份只能靠
      132px 的文字标签串行读——而时间轴的首要工作恰恰是「一眼看出谁在什么时候出现」。

      判据收得很窄，只认**唯一映射源**那张表（`CH_TONE` / `theme-identity`）：
      分类色必须是封闭集合，不能就地发明。所以豁免绑在表名上，
      而不是「凡是 teal 都放过」——后者等于把调色板规则整个作废。
    */
    // 判据是**区块**而不是单行：豁免只覆盖 `const CH_TONE = { … }` 这个对象字面量的
    // 内部（见 toneTableLines）。第一版试过按单行的键名结构认，两页的表形状不同就漏了一页——
    // 而「按形状猜」本身就是不可靠的判据。
    region: "toneTable",
    why: "内容色 / 分类色的唯一映射源（裁决 11，封闭集合）",
  },
];

/*
  分类色映射表的行号集合。

  豁免必须按**区块**判定：`const CH_TONE = { … }` 的内部整块放行，其余一律照抓。
  这样「唯一映射源」这个前提是被门禁**执行**的，而不是靠人自觉——
  散落在别处的一个 bg-teal-500 仍然会被报出来（自测过）。

  只认这一个表名：分类色是封闭集合，不能就地发明第二张表。

  **但按表名豁免有个洞，本轮踩到了**：`01` 和 `05` 各有一张 `CH_TONE`，
  两张都叫这个名字，于是两张都被放行——「唯一映射源」这个前提
  从来没有被执行过，只是写在注释里。而两张表的形状已经开始分叉
  （`01` 是 `{name,dot,bar,chip}` 对象，`05` 是裸 chip 字符串且少了 `触发` 与 `光标反馈`）。
  05 自己的注释还写着「稿子里两份表是复制关系，两个独立页面、**没有模块系统**」——
  那个前提早就不成立了，`controls.js` 被 8 个页面加载。
  所以下面补了 `category-tone-table-duplicated`：表只能存在于 `controls.js`。
*/
function toneTableLines(lines) {
  const exempt = new Set();
  let depth = 0, inside = false;
  lines.forEach((line, i) => {
    if (!inside && /\bCH_TONE\s*=\s*\{/.test(line)) { inside = true; depth = 0; }
    if (!inside) return;
    exempt.add(i);
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (depth <= 0 && /\}/.test(line)) inside = false;
  });
  return exempt;
}

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

/**
 * 加载共享外壳的页面里不允许出现 Tailwind **视口**断点。
 *
 * 这些页面的内容都装在 `#mockWindow` 这个**固定尺寸**的模拟窗口里，
 * 而 `sm:` / `lg:` / `xl:` 响应的是浏览器视口——两者毫无关系，所以断点要么恒真、要么恒假，
 * **没有一处是按设计意图生效的**。原先全稿有 22 处这样的断点。
 *
 * 最贵的两处都是「本版重新设计的核心内容看不见」：
 *   · `02` 的 `xl:grid-cols-[minmax(0,1fr)_360px]` 从未生效 →
 *     「11 个光标状态分 6 组」一直堆在 380px 舞台下面，真实默认窗口下首屏一个都看不见
 *   · `04` 的同一处 → 入场方向 / 字号 / 缩放 / 语义分层这些**主任务控件**全在折叠线以下，
 *     首屏只剩一块辅助用的屏幕预览
 * 还有几处是恒真（`sm:` ≥640px 在任何浏览器窗口里都成立），强行两列后把文字压成竖排单字。
 *
 * **断点写了却不按窗口生效，比不写更糟**：它让人以为窄窗口已经考虑过了。
 * 正确做法是用 `group-data-[w=…]/win:`，档位由 shell.js 的 widthBucket 按模拟窗口宽度写在
 * `#mockWindow[data-w]` 上。
 */
const VIEWPORT_BREAKPOINT_RE = /(?<![\w:/[-])(?:sm|md|lg|xl|2xl):(?![\w-]*\/win\b)[a-z]/;
/*
  「这一页装了外壳吗」必须按 `<script src>` 标签认，不能按「文中出现 shell.js」认。

  声明放在这里（而不是靠近第一个使用点）是**刻意的**：`checkViewportBreakpoints`
  在文件靠前处就被调用，而 `const` 不提升——写在下面会抛
  `ReferenceError: Cannot access 'SHELL_TAG' before initialization`，
  与 README 教训 #7 记的那次 TDZ 是同一族。

  两条实测理由：
    · `index.html` 的介绍文字里写着「除 07/08/09 外共用 <code>shell.js</code>」，
      按子串匹配的话目录页会被当成工作区页，然后因为没调 mountShell 而被报出来。
    · `library/components.html` 在正文里讨论 `shell.js` 的 toast 实现，于是
      `viewport-breakpoint-in-shell` 一次报了 16 条——而那一页**根本不套外壳**，
      它的容器就是浏览器视口，`md:` / `lg:` 在那里完全正常。
      一条按提到谁来判断的规则，会在稿子越写越详细时越吵。
*/
const SHELL_TAG = /<script[^>]+src=["'][^"']*shell\.js/;

function checkViewportBreakpoints(file, source) {
  if (!SHELL_TAG.test(source)) return;   // 07/08/09 与两个库页不套外壳，尺寸由自己决定
  const stripped = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  stripped.split("\n").forEach((text, index) => {
    for (const attr of text.matchAll(/class=["']([^"']*)["']/g)) {
      for (const cls of attr[1].split(/\s+/)) {
        if (!VIEWPORT_BREAKPOINT_RE.test(cls)) continue;
        report(file, index + 1, "viewport-breakpoint-in-shell",
          `\`${cls}\` 是 Tailwind 视口断点，而本页内容装在固定尺寸的 #mockWindow 里——`
          + "它响应浏览器视口，不响应模拟窗口，所以恒真或恒假。改用 group-data-[w=sm|md|lg]/win:");
      }
    }
  });
}

/**
 * 共享 .js 的语法自检。
 *
 * 门禁原先只对页面里的内联 `<script>` 跑 `new Function()`（教训 #2），
 * **共享层的 shell.js / controls.js 从来没被检查过**——而它们是五个页面共用的，
 * 一处语法错误就是五页同时白屏。
 *
 * 真实踩到的形态：在 `shellMarkup()` 返回的**模板字符串内部**加了一段 HTML 注释，
 * 注释正文里写了带反引号的类名（`grid-cols-[...]`）——反引号当场终止模板字符串，
 * 整个文件语法错误。浏览器控制台在这种情况下也没留下可读记录，
 * 表现纯粹是「五个页面全空白」，而 check:ui-spec 照旧 PASS。
 */
function checkSharedJsSyntax(file, source) {
  try {
    new Function(source);
  } catch (error) {
    const line = Number(/<anonymous>:(\d+)/.exec(error.stack || "")?.[1]) || 1;
    report(file, line, "shared-js-syntax",
      `共享脚本语法错误：${error.message}——它被多个页面加载，一处坏掉就是多页同时白屏`);
  }
}

/**
 * 容器标签配平检查。
 *
 * 为什么值得单独一条规则：`01-workbench.html` 里有过**一个多余的 `</div>`**，
 * 它按 HTML5 的解析算法会**同时弹掉 `<section>` 和外面的预览列 `<div>`**，
 * 于是传输控件行与「本次输出」行掉出 section、变成 `#cols` 的额外 grid 子元素——
 * 实测 `#cols` 有 5 个子元素而不是 3 个，输出行被压到 32px 宽、三个标签被整个裁掉。
 *
 * 这类错误的可怕之处是**浏览器不报错、只是静默重排 DOM**：页面看着有点怪，
 * 但既不是空白也不是报错，截图上只表现为「控件位置有点奇怪」，
 * 而根因在结构层。逐页看图找不出来，只有把父级链打出来才会发现 section 不在链上。
 *
 * 只检查块级容器（div / section / main / aside / header / nav），
 * 不碰自闭合与 void 元素，也不试图做完整的 HTML 解析——
 * 配平是个计数问题，计数就够抓这一类。注释要先剥掉（教训 #10）。
 */
function checkTagBalance(file, source) {
  const stripped = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const stack = [];
  const tagRe = /<(\/?)(div|section|main|aside|header|nav|template)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(stripped)) !== null) {
    const [, slash, rawName, attrs] = m;
    const name = rawName.toLowerCase();
    if (attrs.trimEnd().endsWith("/")) continue;   // 自闭合写法，不入栈
    const line = stripped.slice(0, m.index).split("\n").length;
    if (!slash) {
      stack.push({ name, line });
      continue;
    }
    const top = stack[stack.length - 1];
    if (!top) {
      report(file, line, "tag-balance", `多出一个 </${name}>：此处没有未闭合的容器标签`);
      continue;
    }
    if (top.name !== name) {
      // 交叉闭合：浏览器会弹掉中间的元素，把后续兄弟节点重新挂到更外层
      report(file, line, "tag-balance",
        `</${name}> 与第 ${top.line} 行的 <${top.name}> 交叉——浏览器会连带弹掉 <${top.name}>，`
        + "其后的兄弟节点会被静默重挂到更外层（不会报错，只是布局变形）");
      stack.pop();
      continue;
    }
    stack.pop();
  }
  for (const open of stack) {
    report(file, open.line, "tag-balance", `<${open.name}> 没有闭合`);
  }
}

/** 共享外壳拥有的 DOM id。页面自己再引用就是教训 #0/#1 的那个坑。 */
function collectShellOwnedIds(shellSource) {
  const ids = new Set();
  for (const match of shellSource.matchAll(/id=["']([A-Za-z][\w-]*)["']/g)) ids.add(match[1]);
  return ids;
}

const files = await collectFiles(specRoot);
const htmlFiles = files.filter((file) => extname(file) === ".html");

// 共享 .js 先过语法自检：它们被多个页面加载，坏一个就是多页白屏（见 checkSharedJsSyntax）
for (const jsFile of files.filter((file) => extname(file) === ".js")) {
  checkSharedJsSyntax(jsFile, await readFile(jsFile, "utf8"));
}
const shellSource = await readFile(join(specRoot, "shell.js"), "utf8");
const shellIds = collectShellOwnedIds(shellSource);

for (const file of files) {
  const lines = stripComments(await readFile(file, "utf8")).split("\n");
  const toneLines = toneTableLines(lines);

  for (const rule of RULES) {
    lines.forEach((line, index) => {
      const matches = line.match(rule.pattern);
      if (!matches) return;
      const offending = rule.allow ? matches.filter((match) => !rule.allow(match)) : matches;
      if (offending.length === 0) return;
      if (COLOR_ALLOWANCES.some((allowance) => (
        allowance.region === "toneTable" ? toneLines.has(index) : allowance.test && allowance.test(line)
      ))) return;
      report(file, index + 1, rule.id, `${rule.message} —— ${[...new Set(offending)].join(", ")}`);
    });
  }
}

/*
  ── category-tone-table-duplicated：分类色的映射表只能有一张 ──────────
  裁决 11 要求「一个效果类型在全应用只有一个颜色」，三处共用同一份映射：
  时间轴通道块、01 的「本次输出」chip、05 的事件流。

  上面那道 `off-palette-color` 的豁免按表**名**放行区块，所以第二张同名表
  照旧通过——实测 `01` 与 `05` 各有一张，而两张的形状已经不同。
  「共用一份」这件事因此从来只是注释，不是判据。

  判据：`CH_TONE = {` 只允许出现在 `controls.js`（共享层，8 个页面都加载它）。
  别处要用就 `Ctl.CH_TONE` / `Ctl.toneOf()` / `Ctl.toneByName()`。
  引用式写法（`const CH_TONE = Ctl.CH_TONE;`）不匹配 `= {`，所以不会误报。
*/
{
  const TABLE_LITERAL = /\bCH_TONE\s*=\s*\{/;
  for (const file of files) {
    if (file.endsWith("controls.js")) continue;
    const source = stripComments(await readFile(file, "utf8"));
    if (!TABLE_LITERAL.test(source)) continue;
    const line = source.split("\n").findIndex((l) => TABLE_LITERAL.test(l)) + 1;
    report(file, line || 1, "category-tone-table-duplicated",
      "又出现了一张 `CH_TONE = { … }` 字面量。分类色是封闭集合、唯一映射源在 controls.js——"
      + "第二张表一定会有一天与第一张不一致（实测 05 那份就已经少了 `触发` 与 `光标反馈` 两条，"
      + "而 off-palette-color 的豁免按表名放行，两张都通过了）。"
      + "改成 `Ctl.CH_TONE` / `Ctl.toneOf(key)` / `Ctl.toneByName(name)`");
  }
}

// ── 内联脚本语法自检（教训 #2）+ 残留外壳 DOM 引用（教训 #0/#1）──
for (const file of htmlFiles) {
  const raw = await readFile(file, "utf8");
  // 语法自检要用原文（注释在脚本里是合法的）；找 DOM 引用要用剥了注释的版本。
  const source = stripComments(raw);
  const usesShell = /shell\.js/.test(source);

  checkTagBalance(file, raw);
  checkViewportBreakpoints(file, raw);

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

// ── setInterval 的清理不能被早退跳过 ──
//
// 09 的 startPause 把 clearInterval(timer) 写在了「直到重启」那条早退 return 之后：
//   if (!minutes) { $('countdown').textContent = '直到重启'; return; }
//   clearInterval(timer);
//   timer = setInterval(…)
// 于是「先暂停 20 分钟、再改成直到重启」会留下一个还在跑的旧倒计时。实测 1.3 秒后
// 文案就从「直到重启」被覆写成 19:59，到点还会把 paused 置回 false 并弹「暂停结束，已恢复」
// ——「直到重启」自己解除了。这类缺陷不会报错、不会有视觉痕迹，只在等待之后才发作。
//
// 规则：同一个函数体里既有 setInterval 又有 clearInterval 时，
// clearInterval 必须出现在该函数第一个 return 之前。
// 收窄成「两者同时出现」是为了不误伤只 set 不 clear 的一次性 setInterval，
// 也不误伤纯清理函数（只有 clearInterval 的 resumeBtn 回调）。
for (const file of files) {
  const source = stripComments(await readFile(file, "utf8"));
  for (const match of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let cursor = bodyStart;
    while (cursor < source.length && depth > 0) {
      const ch = source[cursor];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      cursor += 1;
    }
    const body = source.slice(bodyStart, cursor - 1);
    const setAt = body.search(/\bsetInterval\s*\(/);
    const clearAt = body.search(/\bclearInterval\s*\(/);
    if (setAt < 0 || clearAt < 0) continue;
    const returnAt = body.search(/\breturn\b/);
    if (returnAt < 0 || clearAt < returnAt) continue;
    const line = source.slice(0, bodyStart + clearAt).split("\n").length;
    report(
      file,
      line,
      "interval-cleanup-after-early-return",
      `${match[1]} 里的 clearInterval 排在第一个 return 之后——走那条早退分支时旧 interval 会继续跑，`
      + "覆写 UI 并在到期后擅自改回状态（09 的「直到重启」就是这样自己解除的）。把清理提到所有 return 之前",
    );
  }
}

/**
 * 浮层必须走 placePopover / Ctl.select，不能自己 absolute 定位。
 *
 * **这是全稿复发次数最多的一个 landmine（到目前为止五次）。** 祖先只要有
 * `overflow: hidden`（圆角裁切、列表内滚都会用到），`absolute` 的浮层就会被裁掉，
 * 而 `z-index` 完全解决不了——问题不在层叠顺序。历史上坏过的五处：
 *   · `Ctl.select` 的弹层（被 `.cfg-card` 的 overflow-hidden 裁掉 89/98px）
 *   · 主题卡 ⋯ 菜单、换图标浮层、主题库 ⋯ 菜单（都被 `#themeList` 的 overflow-y-auto 裁掉）
 *   · `03` 的添加应用浮层——它是 placePopover 收出来**之后**才写的，
 *     却又一次自己写了 `absolute right-0 top-10`。注释里明明写着「以后新增浮层
 *     只要走这里就不会再踩」，但注释拦不住任何人。
 *
 * 所以判据取三个浮层 role（menu / dialog / listbox）+ `absolute`：这三个 role
 * 就是浮动层的定义，静态列表不会用它们，误报面很窄（教训 #10：会喊狼来了的门禁会被忽略）。
 */
{
  const FLOATING_ROLES = /role=["'](menu|dialog|listbox)["']/;
  for (const file of htmlFiles) {
    const source = stripComments(await readFile(file, "utf8"));
    source.split("\n").forEach((text, index) => {
      for (const tag of text.matchAll(/<[a-z][^>]*>/gi)) {
        const html = tag[0];
        if (!FLOATING_ROLES.test(html)) continue;
        const cls = /class=["']([^"']*)["']/.exec(html)?.[1] || "";
        if (!/(^|\s)absolute(\s|$)/.test(cls)) continue;
        /*
          `data-native-menu` 是一个**窄口径**豁免：标了它的元素是「操作系统原生菜单的
          示意图」，不是应用内浮层。原生菜单由 AppKit 渲染，根本不在我们的 DOM 里，
          所以 portal / 翻转 / 限高这一整套都不适用——它只是一张画在演示台上的图
          （`09` 的托盘菜单，DECISIONS.md 裁决 9）。

          之所以不整文件豁免：`09` 将来可能真的加应用内浮层，那时这条规则还得管它。
          标记打在元素上，作用范围就只有这一个元素。
        */
        if (/data-native-menu/.test(html)) continue;
        report(file, index + 1, "popover-not-portaled",
          `role="${FLOATING_ROLES.exec(html)[1]}" 的浮层用了 absolute 定位——祖先只要有 overflow 就会把它裁掉，`
          + "而 z-index 解决不了祖先的 overflow。改用 shell.js 的 placePopover（挂 body + fixed + 翻转 + 限高 + 夹进 #mockWindow）"
          + "或 Ctl.select。这个坑到目前为止复发过五次");
      }
    });
  }
}

/*
  ── 可交互元素必须有可访问名 ────────────────────────────────────

  上一轮只给滑块补了名字（`Ctl.slider` 推导 + `data-noname` 留痕），
  按钮没有对应的门禁。而稿子里有大量**纯图标按钮**：折叠箭头、⋯ 菜单、
  播放控制、色板格、窗口红绿灯……它们没有可见文字，读屏器只能报「按钮」。

  判据：`<button>` / `<a>` 的内容里除了 `<svg>` 之外没有任何文字节点时，
  必须有 `aria-label` / `aria-labelledby` / `title` 之一。
  文字与图标混排的按钮不在内（它们的可访问名就是那段文字）。

  刻意不查动态生成的（模板字符串里 `${...}` 拼出来的内容）：那类要靠运行时探针，
  静态判据在这里会大面积误报——而一条会喊狼来了的规则很快就会被忽略（教训 #10）。
*/
{
  const NAMED = /\b(?:aria-label=|aria-labelledby=|title=)/;
  for (const file of htmlFiles) {
    const source = stripComments(await readFile(file, "utf8"));
    // 只看单行内闭合的、内容里不含模板占位符的按钮/链接
    for (const m of source.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const [, tag, attrs, inner] = m;
      if (inner.includes("${") || attrs.includes("${")) continue;
      if (NAMED.test(attrs)) continue;
      // 去掉所有 svg 之后还剩文字 → 有可访问名
      const text = inner.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").trim();
      if (text) continue;
      if (!/<svg/.test(inner)) continue;   // 既没文字也没图标：空按钮不是这条规则的事
      const line = source.slice(0, m.index).split("\n").length;
      report(file, line, "icon-button-unnamed",
        `<${tag}> 里只有图标、没有文字，也没有 aria-label / title——读屏器只能报「按钮」。`
        + "纯图标控件的名字是它唯一的说明");
    }
  }
}

/*
  ── `role="tab"` 必须有同文档的 `role="tabpanel"` ────────────────────

  ARIA 的 tab 模式是「一组页签控制同文档里的一组面板」。用在**跨文档导航**上时，
  读屏器会报「标签页 1/5」并等着面板在当前页出现，而激活它会把整个文档卸载掉。
  实测踩到的形态：外壳的五个工作区 chip 是 5 个 role=tab、**0 个 tabpanel**，
  其中四个是 `<a href>`。正确形态是 `<nav>` + `aria-current="page"`。

  判据：同一文件里出现 `role="tab"` 就必须出现 `role="tabpanel"`。
  收窄成同文件是因为稿子里真正的多页签容器（`07` 的六个分区）两者就在同一份源码里。
*/
{
  for (const file of files) {
    const source = stripComments(await readFile(file, "utf8"));
    if (!/role=\\?["']tab["']/.test(source)) continue;
    if (/role=\\?["']tabpanel["']/.test(source)) continue;
    const line = source.split("\n").findIndex((l) => /role=\\?["']tab["']/.test(l)) + 1;
    report(file, line || 1, "tab-without-tabpanel",
      'role="tab" 出现了，但同一文件里没有任何 role="tabpanel"——'
      + "ARIA 的 tab 模式要求页签控制同文档的面板。如果这其实是**跨文档导航**"
      + "（点了会跳到另一个 .html），那就用 <nav> + aria-current=\"page\"："
      + "读屏器会报「标签页 1/5」然后文档直接卸载，是最糟的一种错配");
  }
}

/*
  ── 跨脚本的顶层 const/let/class 重名 ──────────────────────────────

  经典脚本（非 module）的顶层 `const` / `let` / `class` 进的是**共享的全局词法环境**。
  所以页面内联脚本里的 `const THEME_SEEDS` 会和 `shell.js` 里同名的那个直接冲突，
  抛 `SyntaxError: Identifier 'THEME_SEEDS' has already been declared`，
  而且是**整段脚本一行都不执行**。

  实测表现（就是这样踩到的）：页面照旧渲染出来（标记是静态的），
  但配置列与时间轴全空、控制台没有可读记录、`check:ui-spec` 照旧 PASS——
  因为上面那道 `inline-script-syntax` 对每段脚本**单独**跑 `new Function()`，
  单独看两段都完全合法。这是「分别检查都通过、合起来是坏的」的典型形态，
  和 README 记的 `shared-js-syntax` 那次（五页同时白屏）是同一族。

  只查共享层（shell.js / controls.js）与页面之间的冲突：那是唯一会同时加载的组合。
  `var` 和 `function` 不查——它们是可覆盖的属性声明，不抛错（虽然覆盖本身也不好，
  但那是另一类问题，抓它会误报一大片）。
*/
{
  const topLevelLexical = (source) => {
    const names = new Set();
    let depth = 0;
    for (const line of stripComments(source).split("\n")) {
      // 只认深度 0 的声明：函数体里的同名 const 各自作用域，不冲突
      if (depth === 0) {
        for (const m of line.matchAll(/^\s*(?:const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
      }
      depth += (line.match(/[{([]/g) || []).length - (line.match(/[})\]]/g) || []).length;
      if (depth < 0) depth = 0;
    }
    return names;
  };
  const sharedNames = new Map();
  for (const name of ["shell.js", "controls.js"]) {
    for (const id of topLevelLexical(await readFile(join(specRoot, name), "utf8"))) {
      if (!sharedNames.has(id)) sharedNames.set(id, name);
    }
  }
  for (const file of htmlFiles) {
    const raw = await readFile(file, "utf8");
    const loaded = ["shell.js", "controls.js"].filter((n) => raw.includes(n));
    if (!loaded.length) continue;
    for (const match of raw.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      for (const id of topLevelLexical(match[1])) {
        const owner = sharedNames.get(id);
        if (!owner || !loaded.includes(owner)) continue;
        const line = raw.slice(0, match.index).split("\n").length;
        report(file, line, "cross-script-lexical-collision",
          `顶层 \`${id}\` 与 ${owner} 里同名的顶层 const/let/class 冲突——`
          + "经典脚本的顶层词法声明进的是**共享的全局词法环境**，"
          + `会抛 SyntaxError: Identifier '${id}' has already been declared，`
          + "而且是**整段页面脚本一行都不执行**（页面看着渲染正常，交互全空，控制台无可读记录）。"
          + "改个名字，或直接用共享层那个绑定");
      }
    }
  }
}

/*
  ── 按实测几何定位的页面必须听 `viewportchange`，不能只听 `resize` ──

  **切换窗口尺寸档不会触发 `resize`**：变的是 `#mockWindow` 的尺寸，浏览器视口没动。
  所以一个只听 `resize` 的页面，在切档之后所有 JS 算出来的几何都是上一档的数。

  实测代价（补齐三条时间轴通道、6 条轨、切到 720×480）：
  `01` 的舞台被分到 47px 而最小需求 240px，`deficit = 193`，
  而 A1 那条兜底的「预览列纵滚」**根本没被执行**——手动调一次
  `enforceStageInvariant()` 立刻从 hidden 变 auto。也就是说那条不变量
  在切档路径上从来没生效过，只是 3 条轨时 deficit 一直没转正，所以没人看见。
  `02` 是同型：校准图钉停在上一档的像素位，而旁边的坐标读数仍然是对的——
  **位置错、数字对**，比两者都错更难发现。

  判据：页面里出现 `getBoundingClientRect` / `clientWidth` / `clientHeight`
  （= 有实测几何）且装了共享外壳（= 有尺寸档可切）时，必须出现 `'viewportchange'`。
  `04` 早就写对了，它的注释「凡是按实测几何定位的东西都必须重算」就是这条规则的原文。
*/
{
  const MEASURED = /\b(?:getBoundingClientRect|clientWidth|clientHeight)\b/;
  for (const file of htmlFiles) {
    const raw = await readFile(file, "utf8");
    if (!/shell\.js/.test(raw)) continue;          // 07/08/09 不套外壳，没有尺寸档
    const source = stripComments(raw);
    if (!MEASURED.test(source)) continue;
    if (/["']viewportchange["']/.test(source)) continue;
    const line = source.split("\n").findIndex((l) => MEASURED.test(l)) + 1;
    report(file, line || 1, "measured-geometry-without-viewportchange",
      "这一页按实测几何定位（getBoundingClientRect / clientWidth / clientHeight），"
      + "却没有监听 `viewportchange`——切换窗口尺寸档**不触发 resize**（变的是 #mockWindow，不是视口），"
      + "所以切档之后这些数全是上一档的。写法照 04："
      + "`['resize','viewportchange'].forEach((ev) => window.addEventListener(ev, recompute))`");
  }
}

// ── 共享控件的默认路径必须真的被某一页走通 ──
//
// controls.js 的 mountSliders 原先把 data-out 当成写在**滑块**上的 CSS 选择器，
// 而全稿三处 markup（01 / 07 / library）用的都是「读数 span 上写 data-out="<滑块 id>"」。
// 结果只有 07 信任共享层，也只有 07 的读数是死的——01 / 04 / 02 / library 各自手写了
// 一遍 onChange，反而把 bug 藏在了唯一的正确用法里。
// **共享层最没人验证的路径，就是它自己的默认路径。**
//
// 这条锁住解析器认得 markup 的约定。它防不住所有分叉，但能防住「有人把它改回纯选择器」。
{
  const controls = await readFile(join(specRoot, "controls.js"), "utf8");
  const mountBody = controls.slice(controls.indexOf("function mountSliders"));
  const resolvesByDataOutKey = /\[data-out="\$\{/.test(controls);
  const stillSelectorOnly = /dataset\.out\s*\?\s*document\.querySelector\(\s*el\.dataset\.out\s*\)/.test(mountBody);
  if (!resolvesByDataOutKey || stillSelectorOnly) {
    report(
      join(specRoot, "controls.js"), 1, "readout-convention-drift",
      "mountSliders 必须按稿子的 markup 约定解析读数（读数 span 上的 data-out=\"<滑块 id>\"）。"
      + "只把 data-out 当滑块上的选择器会让全稿没有一个读数能解析到——07 的两个读数就是这样死的",
    );
  }
}

// ── 效果卡的 total 不能谎报 ──
//
// 卡头写「其余 N 项」「共 N 项设置」，而 N 只是个手写常量。曾经有 4 张卡
// `fields: []` 且没有任何分组，total 却写着 9 / 5 / 7 / 7——**点开什么都没有**。
// 稿子是重构依据，一个凭空的计数会让实现者以为那些字段已经设计过了。
// 规则：total 必须等于「主区可见字段 + 分组内字段」，且同一字段不能两边都出现。
/*
  ── 卡片数据的读取口，两条规则共用（card-total-* 与 preview-fidelity）──

  这个函数存在的原因本身就是一条教训：它原先是就地写的
  `indexOf("const CARDS = [") … indexOf("const ACTIONS = [")`，
  而第 1 批 A2 把卡片挪进了**每主题状态桶**（`baseCards()` → `themeState`）之后，
  `const CARDS = [` 这个锚点在稿子里再也不存在了——于是
  **card-total-mismatch 从那一刻起一直在空跑**，而门禁照旧打印 PASS。

  「缺席没有视觉痕迹」这条教训对门禁自己同样成立。所以：
    · 锚点改成 `function baseCards() { return [ … ] }`（真正的唯一数据源）
    · 找不到锚点时**报违规**，不再静默跳过——一条查不到东西的规则必须自己喊出来
*/
async function readBaseCards() {
  const file = join(specRoot, "surfaces/01-workbench.html");
  const workbench = await readFile(file, "utf8");
  const head = workbench.indexOf("function baseCards() { return [");
  if (head < 0) {
    report(file, 1, "card-data-anchor-gone",
      "找不到 `function baseCards() { return [` —— 效果卡的数据源被挪走或改名了，"
      + "card-total-mismatch / card-field-duplicated / preview-fidelity 三条规则会全部空跑。"
      + "（这不是假设：A2 把卡片挪进每主题状态桶之后，旧锚点 `const CARDS = [` 就失效了，"
      + "而门禁照旧打印 PASS。）修锚点，别删规则");
    return { file, workbench, cards: null };
  }
  const open = workbench.indexOf("[", head);
  let depth = 0, i = open;
  for (; i < workbench.length; i += 1) {
    if (workbench[i] === "[") depth += 1;
    else if (workbench[i] === "]") { depth -= 1; if (depth === 0) break; }
  }
  try {
    // 纯数据字面量，直接求值比正则可靠——用正则数过三次，三次都数错
    // （切段切在 groups 而不是 fields 上、分组正则只匹配到最后一组）。
    return { file, workbench, cards: new Function(`return ${workbench.slice(open, i + 1)}`)() };
  } catch (error) {
    report(file, 1, "card-total-unparsable",
      `baseCards() 的数组无法求值，卡片相关的三条规则被跳过：${error.message}`);
    return { file, workbench, cards: null };
  }
}
const CARD_DATA = await readBaseCards();

{
  {
    const cards = CARD_DATA.cards;
    for (const card of cards ?? []) {
      const visible = (card.fields ?? []).map((field) => field.label);
      const grouped = (card.groups ?? []).flatMap(([, items]) => items);
      const sum = visible.length + grouped.length;
      if (card.total !== sum) {
        report(join(specRoot, "surfaces/01-workbench.html"), 1, "card-total-mismatch",
          `「${card.name}」的 total=${card.total}，但可见 ${visible.length} + 分组内 ${grouped.length} = ${sum}`
          + "——凭空的计数会让实现者以为那些字段已经设计过了");
      }
      const both = visible.filter((label) => grouped.includes(label));
      if (both.length) {
        report(join(specRoot, "surfaces/01-workbench.html"), 1, "card-field-duplicated",
          `「${card.name}」的字段同时出现在主区和分组里：${both.join(", ")}`);
      }
    }
  }
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
  { cap: "规则：排序", code: ["src/app/pages/theme-workbench/hooks/state/workbenchRulesReducer.ts", /rules\/reorder/], spec: [/排序|⌥↑/] },
  // 第 1 批 A 的五个共享组件：稿子是它们的形态依据，两边都不能单方面消失
  { cap: "共享组件 PageHeader", code: ["src/components/ui/page-header.tsx", /export function PageHeader/], spec: [/PageHeader/] },
  { cap: "共享组件 EmptyState", code: ["src/components/ui/empty-state.tsx", /export function EmptyState/], spec: [/EmptyState/] },
  { cap: "共享组件 Segmented", code: ["src/components/ui/segmented.tsx", /export function Segmented/], spec: [/Segmented/] },
  { cap: "共享组件 NumberField", code: ["src/components/ui/number-field.tsx", /export function NumberField/], spec: [/NumberField/] },
  { cap: "共享组件 Skeleton", code: ["src/components/ui/skeleton.tsx", /export function PanelSkeleton/], spec: [/Skeleton/] },
];

// ── 决策 #9 的自洽：时间轴声称拥有的东西，必须真的能在时间轴里编辑 ──────────
//
// 决策 #9 说「时间轴是时间的**唯一**编辑面：偏移、时长、缓动曲线、错峰都在这里；
// 卡片只管外观」。上一轮按这条把卡片上的 9 个时间字段删掉了，但时间轴并没有同步
// 长出对应的编辑入口，于是实测出现三个**哪儿都改不了**的值：
//   · 错峰间隔  —— stagger 写死 10，只在渲染里用
//   · 节流间隔  —— 触发轨上的只读文本，整条轨 interactive 数为 0
//   · 连击窗口  —— 同上；而它在真实代码里是个 120–3000ms 的滑块
// 这比「两个面互相说谎」更难发现：**缺席没有视觉痕迹**，走查点不到一个不存在的控件。
//
// 所以这条规则要求每一样都留一个**可交互元素**的锚点，而不是「文案里提到了」。
// 光有文字说明恰恰是坏掉的那个状态。
const TIMELINE_OWNED = [
  { what: "偏移（拖块体）", anchor: /data-bar="/ },
  { what: "时长（拖块边缘）", anchor: /data-edge="/ },
  { what: "缓动曲线（贝塞尔控制点）", anchor: /data-ch-h="/ },
  { what: "错峰间隔", anchor: /id="staggerSl"|data-out="staggerSl"/ },
  { what: "触发：节流间隔", anchor: /data-trigwin="throttle"/ },
  { what: "触发：连击窗口", anchor: /data-trigwin="comboWindow"/ },
];
const workbenchFile = htmlFiles.find((f) => f.endsWith("01-workbench.html"));
if (!workbenchFile) {
  violations.push({
    file: "docs/ui-spec/surfaces/01-workbench.html", line: 1, rule: "timeline-owned-not-editable",
    message: "找不到 01-workbench.html，无法校验决策 #9 的编辑入口",
  });
} else {
  const wbSource = await readFile(workbenchFile, "utf8");
  for (const entry of TIMELINE_OWNED) {
    if (!entry.anchor.test(wbSource)) {
      violations.push({
        file: relative(projectRoot, workbenchFile), line: 1, rule: "timeline-owned-not-editable",
        message: `决策 #9 把「${entry.what}」判给时间轴，但稿子里找不到它的可交互锚点 ${entry.anchor}——`
          + "这个值会变成哪儿都改不了（只读文本不算编辑入口）",
      });
    }
  }
}

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

/*
  ══════════════════════════════════════════════════════════════════════════
  第 4 批新增的七条（DECISIONS.md「本轮新增的硬约束」）

  每条都做过「注入违规 → 确认报出 rule id → 还原」自测（教训 #9）。
  共同的设计原则来自教训 #10：**判据要窄**。一个会喊狼来了的门禁很快就会被
  加上 `// eslint-disable` 式的绕过，然后就再也拦不住任何东西了。
  所以每条规则都尽量绑在**已经存在的唯一真值源**上（`_src.css` 的 `-on` 变体、
  `CARDS` 数据、`PREVIEW_EXEMPT` 表），而不是靠一张手写的模式清单。
  ══════════════════════════════════════════════════════════════════════════
*/

const srcCss = await readFile(join(specRoot, "_src.css"), "utf8");
// 注释要先剥掉：目录页里那段「第 10 页已按裁决 7 并入 06」的历史说明本身就写着
// 一个不存在的页号，不剥注释的话 dead-link 会把**解释这件事的文字**当成违规报出来（教训 #10）。
const indexHtml = stripComments(await readFile(join(specRoot, "index.html"), "utf8"));
const readmePath = join(specRoot, "README.md");
const readmeText = stripComments(await readFile(readmePath, "utf8"));
const surfaceFiles = (await readdir(join(specRoot, "surfaces"))).filter((f) => f.endsWith(".html"));
const libraryFiles = (await readdir(join(specRoot, "library"))).filter((f) => f.endsWith(".html"));
const archiveFiles = (await readdir(join(specRoot, "archive"))).filter((f) => f.endsWith(".html"));

// ── 1. dead-link：目录页与 README 指向的稿子必须真的在那里 ───────────────
//
// `index.html:135` 曾链到已经被移进 archive/ 的 `surfaces/10-agent.html`。
// Vite 的 SPA fallback 对不存在的路径返回 **200 + 首页**，所以点下去既不是 404
// 也不是空白——它跳回目录页自己。表现是「这个卡片点了没反应」，
// 而「点了没反应」在一份满是原型控件的稿子里是最容易被当成正常的症状。
// 页面计数一并锁住：页头写「10 页」而 surfaces/ 只有 9 个文件时，
// 读稿子的人会去找那个不存在的第 10 页。
{
  const linkRe = /(?:href="|\]\()(surfaces|library|archive)\/([\w.-]+\.html)/g;
  for (const [file, text] of [[join(specRoot, "index.html"), indexHtml], [readmePath, readmeText]]) {
    for (const match of text.matchAll(linkRe)) {
      const [, dir, name] = match;
      const pool = dir === "surfaces" ? surfaceFiles : dir === "library" ? libraryFiles : archiveFiles;
      const line = text.slice(0, match.index).split("\n").length;
      if (pool.includes(name)) continue;
      const movedToArchive = archiveFiles.includes(name);
      report(file, line, "dead-link",
        movedToArchive
          ? `${dir}/${name} 已经被移进 archive/，这个链接指向的路径不存在了——`
            + "Vite 的 SPA fallback 会返回 200 + 首页，所以它的表现是「点了跳回目录」而不是 404。"
            + "改成指向 archive/ 或删掉这一项"
          : `${dir}/${name} 不存在。稿子是重构依据，一个指不到东西的链接等于一页凭空的规格`);
    }
  }
  const claimed = [...indexHtml.matchAll(/(\d+)\s*页/g)];
  for (const match of claimed) {
    const n = Number(match[1]);
    if (n === surfaceFiles.length) continue;
    const line = indexHtml.slice(0, match.index).split("\n").length;
    report(join(specRoot, "index.html"), line, "dead-link",
      `页头写「${n} 页」，而 surfaces/ 实际有 ${surfaceFiles.length} 个文件——`
      + "对不上的那几页会被人当成「还没画」去找");
  }
}

// ── 2. preview-fidelity：卡片上的字段必须真的进舞台，或者显式登记豁免 ──────
//
// 实测过的最坏情形：卡片写「文案 ZZZZ / 字号 34px / 颜色 #F43F5E」，
// 舞台画「Nice! / 24px / #f59e0b」——三个最显眼的字段全是硬编码常量。
// 这一族缺陷把决策 #8（预览是可交互沙盒、调参靠看预览）整个抽空，
// 而且**看不出来**：舞台照样动、照样好看，只是它画的不是你配的那套。
//
// 规则：`CARDS` 里每个字段要么在 01 的源码里有 `cardVal('key','label'` /
// `cardStr('key','label'` 绑定，要么登记在 `PREVIEW_EXEMPT` 里并写明理由。
// 判据绑在 CARDS 这份数据上，所以**新增一个字段就自动进入检查范围**——
// 这正是「缺席没有视觉痕迹」唯一可靠的兜底。
{
  const wb = CARD_DATA.workbench;
  const exemptStart = wb.indexOf("const PREVIEW_EXEMPT = {");
  const exemptEnd = exemptStart >= 0 ? wb.indexOf("};", exemptStart) : -1;
  const exempt = new Set();
  if (exemptStart >= 0 && exemptEnd > exemptStart) {
    for (const m of wb.slice(exemptStart, exemptEnd).matchAll(/['"]([^'"|]+\|[^'"]+)['"]\s*:/g)) exempt.add(m[1]);
  } else {
    report(join(specRoot, "surfaces/01-workbench.html"), 1, "preview-fidelity",
      "找不到 PREVIEW_EXEMPT 表，忠实度检查无从执行——不体现在舞台上的字段必须有登记处");
  }
  {
    for (const card of CARD_DATA.cards ?? []) {
      const labels = [...(card.fields ?? []).map((f) => f.label), ...(card.groups ?? []).flatMap(([, items]) => items)];
      for (const label of labels) {
        const key = `${card.key}|${label}`;
        if (exempt.has(key)) continue;
        // 三个读取口都算绑定：cardVal（数值）/ cardStr（文本·下拉·颜色）/ cardBool（开关）。
        // 漏掉 cardBool 的话「渐变开关」这类字段接上了却仍被报出来——一条会误报的规则会被绕过。
        const bound = ['cardVal', 'cardStr', 'cardBool']
          .some((fn) => wb.includes(`${fn}('${card.key}', '${label}'`));
        if (bound) continue;
        report(join(specRoot, "surfaces/01-workbench.html"), 1, "preview-fidelity",
          `「${card.name}」的字段「${label}」既没有 cardVal/cardStr 绑定，也没有登记进 PREVIEW_EXEMPT——`
          + "改这个字段时舞台不会变，而重构的人会照着这份不忠实的预览去实现");
      }
    }
  }
}

// ── 3. aria-state-missing：有视觉选中/展开态的按钮必须把状态说出来 ─────────
//
// 全稿的选中态是一套 `-on` 后缀类（`seg-item-on` / `cfg-card-on` / `switch-on` …），
// 而它们原先只改颜色：读屏器在这些按钮上报的是一个普通按钮，
// **「当前选的是哪一个」这个信息只存在于像素里**。
//
// 判据不写手工清单，而是从 `_src.css` 里**推导**：凡是定义了 `.X-on` / `.X-active`
// 变体的组件类 X，它的 `<button>` 就必须带一个 aria 状态属性。
// 这样新增一个带选中态的组件时，规则自动跟上——手写清单一定会漏，
// 而漏掉的那个恰好就是新加的那个。
{
  const bases = new Set();
  for (const m of srcCss.matchAll(/\.([a-z][\w-]*?)-(?:on|active)\b/g)) bases.add(m[1]);
  // switch 的基类叫 switch-row / switch-knob，变体叫 switch-on——名字对不上，显式补
  if (bases.delete("switch")) { bases.add("switch-row"); bases.add("switch-knob"); }
  // 原型状态条的类写在 _src.css 里，但它是脚手架，同样要能被读屏用（走查也要能用键盘）
  bases.add("proto-btn");
  /*
    `aria-current` 也算「把状态说出来了」。

    跨文档导航的当前项就该用它，而不是 `aria-selected`——上一版判据不认它，
    于是把外壳那五个工作区 chip 逼成了 `role="tab" + aria-selected`，
    而它们里有四个是 `<a href>`、点了整页跳走。**门禁把一个错的模式固化住了**：
    判据只问「有没有状态属性」，没问「这个 role 用对了没有」。
    下面的 tab-without-tabpanel 补的就是后半个问题。
  */
  const ARIA_STATE = /\baria-(?:pressed|checked|selected|expanded|current)=/;
  /*
    右边界必须把 `${` 也算成边界。

    稿子里最常见的写法是 `class="action-tab${on ? ' action-tab-on' : ''}"`——
    基类紧接着一个模板占位符，后面**没有空格**。第一版只认 `\s|$`，
    于是这一族全部漏检：实测浏览器里 5 个动作页签一个 aria 状态都没有，
    而门禁打印 PASS。（发现它靠的是运行时探针，不是读代码——静态判据
    与运行时判据必须两边都跑，这正是教训 #8「页面渲染正常不是结论」的门禁版。）
  */
  const baseRe = new RegExp(`(?:^|\\s)(${[...bases].join("|")})(?=$|\\s|\\$\\{)`);
  /*
    不能只查 `<button>`。

    第一版只扫 `<button>`，而稿子里带状态的可交互元素还有另外两族：
      · `<a role="tab" aria-selected>`（外壳的工作区页签，非当前页那几个是链接）
      · `<div role="option" aria-selected tabindex>`（主题列表行，roving tabindex）
    这两处现在是**手工补对**的，门禁看不见它们——也就是说它们的回归不会被拦下。
    判据扩到「带状态类 **且** 是可交互的元素」：有 role / tabindex / href 之一。
    纯装饰的 `<span class="switch-knob">` 不在内（它在按钮里面，状态属于按钮），
    这一点靠 `INTERACTIVE` 判据排除，而不是靠标签名。
  */
  const INTERACTIVE = /\b(?:role=|tabindex=|href=)/;
  for (const file of files) {
    const source = stripComments(await readFile(file, "utf8"));
    // 哪些类名family 是用 aria-current 表达当前项的（见下面那段判据说明）
    const currentBased = new Set();
    for (const m of source.matchAll(/<[a-z][^>]*?>/g)) {
      if (!/\baria-current=/.test(m[0])) continue;
      const c = /class=\\?["']([^"']*)\\?["']/.exec(m[0])?.[1] || "";
      const h = baseRe.exec(c);
      if (h) currentBased.add(h[1]);
    }
    /*
      **整源扫描，不能逐行。** 开标签经常跨行，例如主题列表那一行：

          <div data-theme="${t.id}" role="option" aria-selected="…" tabindex="…"
            class="side-theme${…} focus-visible:…">

      逐行匹配时第一行没有 `>`、第二行没有 `<div`，于是这一族**整个漏检**
      （自测时就是这样发现的：删掉 aria-selected 之后规则一声不响）。
      这与本轮修过的 `${` 边界是同一类错误：判据的形状要按稿子的真实写法定，
      不能按「一个标签总是写在一行里」这种想当然的前提定。
    */
    for (const tag of source.matchAll(/<(button|a|div|summary|li)\b[^>]*?>/g)) {
      const html = tag[0];
      const index = source.slice(0, tag.index).split("\n").length - 1;
      const cls = /class=\\?["']([^"']*)\\?["']/.exec(html)?.[1] || "";
      const hit = baseRe.exec(cls);
      if (!hit) continue;
      if (ARIA_STATE.test(html)) continue;
      // 非 button 只有在**可交互**时才要求状态属性
      if (tag[1] !== "button" && !INTERACTIVE.test(html)) continue;
      /*
        `aria-current` 与 `aria-selected` 的作用域不一样，判据必须跟着变。

        `aria-selected` / `aria-checked` 要**每一项都写**（读屏器要报「5 项里第 2 项被选中」）；
        而 `aria-current` **只写在当前项上**，缺席本身就表示「不是当前项」——
        这是 ARIA 规范的写法，不是偷懒。所以当这一族类名在本文件里是用 aria-current
        表达当前项时，只对**带 on 变体类**的那个元素要求属性。

        不加这一条的话，外壳那四个非当前工作区链接会被逐个报出来，
        而给它们补 `aria-current="false"` 恰恰是错的（规范里没有这个值的这种用法）。
      */
      if (currentBased.has(hit[1]) && !new RegExp(`(?:^|\\s)${hit[1]}-(?:on|active)(?:$|\\s|\\$\\{)`).test(cls)) continue;
      // 模板里状态由 JS 现场拼的写法（`aria-checked="${on}"`）也算，上面的正则已经覆盖
      report(file, index + 1, "aria-state-missing",
        `带 .${hit[1]} 的 <${tag[1]}> 有视觉选中/展开态，但没有 aria-pressed|aria-checked|aria-selected|aria-expanded——`
        + "选中态只存在于颜色里，读屏器报的是一个普通元素。真实代码的形态见 src/components/ui/segmented.tsx"
        + "（role=radiogroup + role=radio + aria-checked）和 switch.tsx（role=switch + aria-checked）");
    }
  }
  /*
    第二道判据：**自己手写的**选中态。

    上面那道绑在 `_src.css` 的组件类上，所以它有一个结构性盲区——绕过组件库
    自己写一串 Tailwind 的按钮，它一个都看不见。而这正是实际发生的事：
      · `02` 的「试用 / 校准」用 `.seg` 自己写了第四套分段控件
        （`b.className = 'seg h-7 … ' + (on ? 'bg-slate-950 text-white shadow-sm' : …)`）
      · `06` 的「逐项接受」勾选框同样是手写的三元
    两处都是**视觉上明明有选中态**，而第一道判据全程沉默。

    所以补一条按**形态**认的：`<button>` 的 class 里出现「三元选 bg-slate-9xx / 实心深底」
    就是在表达选中，必须带 aria 状态。`bg-slate-900` 实心本来就只留给页面主操作
    （DESIGN.md 反模式），所以这个形态出现在按钮上时，几乎总是「手写的选中态」。
  */
  /*
    手写选中态的形态判据也扩了一次。

    第一版只认 `bg-slate-900/950` 实心，因为 DESIGN.md 把实心深底留给页面主操作，
    所以它出现在按钮上几乎总是「手写的选中态」。但那不是唯一画法——
    `ring-2` 环、`border-slate-950` 描边、语义四色底同样在表达选中，
    换一种画法就绕过了这条规则。判据改成「三元里选中分支带任一**选中类**」。
  */
  const ON_LOOK = "(?:bg-slate-9(?:00|50)|border-slate-9(?:00|50)|ring-2|bg-(?:emerald|sky|amber|rose)-(?:50|100))";
  const HANDROLLED_ON = new RegExp(`\\?\\s*['"][^'"]*\\b${ON_LOOK}\\b`);
  for (const file of files) {
    const source = stripComments(await readFile(file, "utf8"));
    source.split("\n").forEach((text, index) => {
      for (const tag of text.matchAll(/<button\b[^>]*>/g)) {
        const html = tag[0];
        if (!HANDROLLED_ON.test(html)) continue;
        if (ARIA_STATE.test(html)) continue;
        report(file, index + 1, "aria-state-missing",
          "这个 <button> 用一个三元表达式自己画选中态（bg-slate-900/950 实心），却没有 aria 状态属性——"
          + "手写的选中态绕过了组件库，也绕过了上面那道按 _src.css 组件类推导的判据。"
          + "优先改用共享的 seg-item / switch-row / mode-card；确实需要自己写的，至少把状态说出来");
      }
    });
    // 同一形态的 className 整串重建（`b.className = '… ' + (on ? 'bg-slate-950 …' : …)`）
    /*
      className 重建这一支要用**更窄**的形态集。

      标记里的 `<button>` 我们知道它是可交互的，所以任何"选中样"都算；
      而一句裸 `x.className = '…' + (cond ? … : …)` 看不出 x 是什么。
      实测误报两处，都是**状态徽标**而不是开关：
        · `02` 的 `aimResult`（准星测试结果，emerald/rose 底）
        · `05` 的 `verdict`（裁决结论，emerald/amber 底）
      语义四色底表达的是"结果是什么"，不是"我被选中了"——徽标本来就该按状态换色。
      所以这里只认强信号：slate-950 实心 / slate-950 描边 / ring-2。
    */
    const ON_LOOK_STRONG = "(?:bg-slate-9(?:00|50)|border-slate-9(?:00|50)|ring-2)";
    for (const m of source.matchAll(new RegExp(`\\.className\\s*=\\s*['"][^'"]*['"]\\s*\\+\\s*\\([^)]*\\?\\s*['"][^'"]*\\b${ON_LOOK_STRONG}\\b`, "g"))) {
      const line = source.slice(0, m.index).split("\n").length;
      report(file, line, "aria-state-missing",
        "按状态整串重建 className 来画选中态（bg-slate-900/950 实心）——"
        + "这种写法既绕过组件类、又必然漏掉 aria 同步（09 已经踩过一次「只改一个」）。"
        + "改成 classList.toggle('<组件类>-on', on) + setAttribute('aria-checked'|'aria-pressed', String(on))");
    }
  }
}

// ── 4. layout-transition-missing：尺寸被 JS 改的元素必须带 L2 过渡 ─────────
//
// 裁决 10 把动效拆成三层，L2「布局因果层」的职责是**表达谁挤了谁**。
// 反例是实测出来的：抽屉一展开，舞台从 279px 瞬跳到 240px、播放控制条被整条盖住——
// 瞬跳之下用户读不出是抽屉把舞台压小了，只看到「按钮不见了」。
//
// 判据：JS 里给 `style.height/width/maxHeight` 赋值的元素（按 id 认），
// 必须在标记里带 `.motion-layout`；或者登记在 LAYOUT_EXEMPT 里并写明理由。
// 只认 id 是刻意的收窄——局部变量指向的元素追不到标记，硬追会开始误报。
{
  const LAYOUT_EXEMPT = {
    mockWindow: "切换窗口尺寸档等于「换了一台机器」，不是同一台机器里的布局因果",
    viewportBar: "稿子脚手架（窗口尺寸条），宽度跟着模拟窗口走",
    proto: "稿子脚手架（原型状态条），同上",
  };
  for (const file of files) {
    const source = stripComments(await readFile(file, "utf8"));
    const marked = new Set();
    // 标记侧：带 motion-layout 的 id（跨文件收集，因为外壳的 id 在 shell.js 里）
    for (const m of specBlob.matchAll(/id=\\?["']([\w-]+)\\?["'][^>]*class=\\?["']([^"']*)\\?["']/g)) {
      if (/\bmotion-layout\b/.test(m[2])) marked.add(m[1]);
    }
    for (const m of specBlob.matchAll(/class=\\?["']([^"']*)\\?["'][^>]*id=\\?["']([\w-]+)\\?["']/g)) {
      if (/\bmotion-layout\b/.test(m[1])) marked.add(m[2]);
    }
    for (const m of source.matchAll(/(?:\$|getElementById)\(\s*['"]([\w-]+)['"]\s*\)\s*\.style\.(height|width|maxHeight)\s*=/g)) {
      const id = m[1];
      if (marked.has(id) || LAYOUT_EXEMPT[id]) continue;
      const line = source.slice(0, m.index).split("\n").length;
      report(file, line, "layout-transition-missing",
        `#${id} 的 ${m[2]} 由 JS 改，但它的标记上没有 .motion-layout——尺寸会瞬跳，`
        + "用户读不出是谁挤了谁（裁决 10 的 L2 布局因果层）。要么加 .motion-layout，"
        + "要么在 LAYOUT_EXEMPT 里写明为什么这次跳变是对的");
    }
    // 两个任意值宽/高类之间来回切：侧栏 60↔248 就是这个形态
    for (const m of source.matchAll(/classList\.toggle\(\s*['"]([wh]-\[[^\]]+\])['"]/g)) {
      const owner = /(\w+)\.classList\.toggle/.exec(source.slice(Math.max(0, m.index - 40), m.index + 20));
      const line = source.slice(0, m.index).split("\n").length;
      if (!owner) continue;
      /*
        该变量在同文件里被赋成 $('id') / getElementById('id') 时才追得到标记。
        必须取**最靠前一次**赋值（`lastIndex` 往前扫），不能取全文第一次命中：
        第一版就是那么写的，于是 shell.js 里叫 `el` 的局部变量把侧栏那次 toggle
        报到了 `#themeSearch` 头上——一条指着错元素的门禁比没有门禁更浪费时间。
      */
      const bindRe = new RegExp(`${owner[1]}\\s*=\\s*(?:\\$|document\\.getElementById)\\(\\s*['"]([\\w-]+)['"]`, "g");
      let bind = null;
      for (const cand of source.slice(0, m.index).matchAll(bindRe)) bind = cand;
      if (!bind) continue;
      if (marked.has(bind[1]) || LAYOUT_EXEMPT[bind[1]]) continue;
      report(file, line, "layout-transition-missing",
        `#${bind[1]} 在两个尺寸类之间切换（${m[1]}），但标记上没有 .motion-layout——同上`);
    }
  }
}

// ── 5. scope-slot-missing：每个工作区页都必须说出自己在编辑什么 ────────────
//
// 裁决 3：ux §2 要求每页显示「正在编辑：主题名」或「全局设置」，而全稿
// `正在编辑` **0 处**。这不是洁癖——它是 03 那一族缺陷的根因：一个全局作用域的
// 页面上摆着一条选中的主题轨，于是每行的「跟随全局」从不说全局是哪一个
// （实测「在侧栏把主题从几何切到流光，03 整页纹丝不动」）。
//
// 槽位由共享外壳提供，所以这条查两件事：外壳里那个槽还在，
// 并且每个装外壳的页面真的把外壳装起来了（`mountShell(`）——
// 只 `<script src="shell.js">` 而不调用的话，页面上不会有页头，也就没有作用域。
//
// 标记用 `data-scope-slot` 而不是裁决 3 原文写的 `data-scope`：
// `05` 的「域筛选」按钮（`data-scope="audio"` …）已经占用了后者，
// 按 `data-scope` 查会让 05 靠一排筛选按钮**假装通过**。已在 DECISIONS.md 同步。
{
  if (!/data-scope-slot/.test(shellSource)) {
    report(join(specRoot, "shell.js"), 1, "scope-slot-missing",
      "外壳页头里的作用域槽（data-scope-slot）不见了——裁决 3 要求每个工作区页都说出「正在编辑什么」");
  }
  for (const file of htmlFiles) {
    const source = stripComments(await readFile(file, "utf8"));
    if (!SHELL_TAG.test(source)) continue;   // 07/08/09 不套外壳，自己就是独立窗口
    if (/mountShell\s*\(/.test(source)) continue;
    report(file, 1, "scope-slot-missing",
      "这一页加载了 shell.js 却没有调用 mountShell()——页头不会出现，作用域槽也就不存在");
  }
}

// ── 6. shell-shortcut-in-copy：教用户按的键，必须先让外壳让位 ──────────────
//
// `04` 的提示语写「试试 ⌘K、⇧、⏎ 看语义分层」，而 ⌘K 是**外壳的命令面板**：
// 按下去弹出面板并抢走焦点，04 的整个前提（在预览里直接打字）当场落空。
// 冲突面是 10 个键（⌘Z/⌘⇧Z/⌘K/⌘1–5/⌘N/⌘J）。
//
// 判据刻意窄：只抓**教用户去按**的句式（试试 / 按下 / 直接打 / 敲一下），
// 不抓「按 ⌘K 可直接搜字段」这类**介绍外壳自己那个控件**的说明——后者按下去
// 的行为正是它描述的行为，没有任何冲突。抓宽了这条规则会在 01 上天天喊狼来了。
{
  const SHELL_KEYS = /⌘Z|⌘⇧Z|⌘K|⌘1–5|⌘N|⌘J/;
  const TEACHES_PRESS = /试试|按下|直接打|敲一下|敲几下/;
  for (const file of htmlFiles) {
    const raw = await readFile(file, "utf8");
    const source = stripComments(raw);
    if (!SHELL_TAG.test(source)) continue;
    if (/setCaptureMode\s*\??\.?\s*\(/.test(source)) continue;   // `window.setCaptureMode?.(` 也算
    source.split("\n").forEach((text, index) => {
      if (!SHELL_KEYS.test(text) || !TEACHES_PRESS.test(text)) return;
      report(file, index + 1, "shell-shortcut-in-copy",
        "这一行在教用户按一个**外壳占用**的快捷键，而本页没有调用 setCaptureMode——"
        + "按下去会弹出外壳的面板并抢走焦点，页面许诺的那件事不会发生。"
        + "让预览获得焦点时进入捕获模式（shell.js 的 setCaptureMode，单一漏斗）");
    });
  }
}

// ── 7. text-2xs-budget：11px 不得承载必要信息 ──────────────────────────────
//
// ux §5 的硬约束是「普通流程不使用 text-2xs 承载**必要信息**」，
// 而「必要信息」没法机械判定，所以退一步用**每页用量**当代理指标：
// 合法用途只剩三种形态（标签下那行解释 / 卡片底那段说明 / 行内补充），
// 它们已经收进 `_src.css` 的 `.hint-*`，页面里因此不再需要写 `text-2xs`。
// 于是每一个残留的 `text-2xs` 都是「值得单独看一眼」的用法，计数才有意义。
//
// 预算不是拍的：它等于收敛后**实测**剩下的数量。所以这个数字是一道棘轮——
// 只能往下改，往上改必须连理由一起写在这里。
{
  const DEFAULT_BUDGET = 8;
  const BUDGET_NOTES = {
    // 收敛后实测：01=6 02=5 03=3 04=7 05=5 06=5 07=2 08=1 09=4 index=1 shell=5
    // library/components=6 library/controls=1 controls.js=2。全部在默认预算内，
    // 所以这里目前没有一条豁免——**空表本身就是结论**：
    // 上一轮的 04=66 / 02=50 / 01=44 不是「这几页信息密度高」，是缺一个判据。
  };
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const rel = relative(specRoot, file);
    const count = (stripComments(source).match(/\btext-2xs\b/g) || []).length;
    const entry = BUDGET_NOTES[rel];
    const budget = entry ? entry.max : DEFAULT_BUDGET;
    if (count <= budget) continue;
    report(file, 1, "text-2xs-budget",
      `text-2xs 用了 ${count} 处，超过预算 ${budget}——ux §5 的硬约束是 11px 不承载必要信息。`
      + "结论（按钮标签、读数、状态徽标、表格里的值）提到 text-xs；"
      + "纯补充说明改用 _src.css 的 .hint-sub / .hint-note / .hint-inline；"
      + "确有例外就在 BUDGET_NOTES 里连理由一起登记");
  }

  /*
    ── 同一条判据必须覆盖 `_src.css`，否则它有一个**出口** ──

    上面那道按页计数的预算只扫 `.html` / `.js`（`collectFiles` 的白名单就这两种），
    于是「把 11px 收进一个组件类」这个动作会让它**永久脱离预算**。
    实测代价：`library/controls` 那个漂亮的「31 → 1」里，1 是页面里剩的那一处，
    而 9 个滑块读数的 11px 全在 `.ctl-value` 这一行——**一次都没被数到**。
    同族的还有 `.sl-bubble`（拖拽时唯一能看的读数）和 `.count-badge`（动作页签上的效果数）。

    这与 `card-data-anchor-gone` 是同一形态：一个静默失效的门禁比没有门禁更糟，
    因为它每轮都打印 PASS。

    这里的判据是**棘轮**（和按页预算同一机制）：数字等于收敛后的实测值，
    只能往下改；往上改必须连理由一起写在这里。
  */
  // 31 = 收敛后的实测值，不是拍的。全部是 .hint-* / 脚手架（.proto-* / .vp-* / .stage-*）
  // 与几何约束类（.glyph-badge / .app-icon-sm / .kbd）那三族。
  const CSS_BUDGET = 31;
  const cssCount = (stripComments(srcCss).match(/\btext-2xs\b/g) || []).length;
  if (cssCount > CSS_BUDGET) {
    report(join(specRoot, "_src.css"), 1, "text-2xs-budget",
      `_src.css 里 text-2xs 用了 ${cssCount} 处，超过棘轮值 ${CSS_BUDGET}。`
      + "新增一处 11px 的组件类之前先问它承载的是结论还是补充说明——"
      + "结论提到 text-xs；补充说明复用已有的 .hint-sub / .hint-note / .hint-inline / .hint-warn，"
      + "而不是再造一个 11px 的类。确有必要就把棘轮值和理由一起改在这里");
  }

  /*
    ── text-2xs-value-class：名字里带「值」的组件类不得是 11px ──

    上面那条棘轮只管**总量**，管不住「拿一个合法名额换掉一个读数」。
    裁决 8 第 1 步点名的那一类（读数值）在这里按**命名**锁死：
    类名里出现 value / readout / bubble / count / num / metric / out 中任一个词，
    就说明它承载的是一个值，而值是结论。

    判据绑在命名约定上而不是一张手写清单：清单会漏掉下一个新类，
    而新类只要按现有约定命名就会被这条抓住。
  */
  {
    const VALUE_WORD = /(?:^|-)(?:value|readout|bubble|count|num|metric|out)(?:-|$)/;
    const withoutComments = stripComments(srcCss);
    for (const match of withoutComments.matchAll(/(^|\n)\s*(\.[-\w]+(?:\s*,\s*\.[-\w]+)*)\s*\{([^{}]*)\}/g)) {
      const selectors = match[2].split(",").map((s) => s.trim().replace(/^\./, ""));
      if (!/\btext-2xs\b/.test(match[3])) continue;
      const offender = selectors.find((name) => VALUE_WORD.test(name));
      if (!offender) continue;
      const line = withoutComments.slice(0, match.index).split("\n").length;
      report(join(specRoot, "_src.css"), line, "text-2xs-value-class",
        `.${offender} 的名字说明它承载一个值，而值是结论——裁决 8 第 1 步要求读数一律 text-xs，不是 text-2xs。`
        + "行高在两档之间相同（都是 1rem），所以提上去行不变高，只是宽约 9%");
    }
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
