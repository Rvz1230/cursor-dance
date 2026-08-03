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
function checkViewportBreakpoints(file, source) {
  if (!/shell\.js/.test(source)) return;   // 07/08/09 不套外壳，尺寸由自己决定
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
const BALANCED_TAGS = ["div", "section", "main", "aside", "header", "nav", "template"];
function checkTagBalance(file, source) {
  const stripped = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const stack = [];
  const tagRe = /<(\/?)(div|section|main|aside|header|nav|template)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(stripped)) !== null) {
    const [full, slash, rawName, attrs] = m;
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
{
  const workbench = await readFile(join(specRoot, "surfaces/01-workbench.html"), "utf8");
  const start = workbench.indexOf("const CARDS = [");
  const end = workbench.indexOf("const ACTIONS = [");
  if (start >= 0 && end > start) {
    const source = workbench.slice(start, end).replace(/^const CARDS = /, "").replace(/;\s*$/, "").trim();
    let cards = null;
    try {
      // CARDS 是纯数据字面量，直接求值比正则可靠——
      // 我用正则数过三次，三次都数错（切段切在 groups 而不是 fields 上、
      // 分组正则只匹配到最后一组）。
      cards = new Function(`return ${source}`)();
    } catch (error) {
      report(join(specRoot, "surfaces/01-workbench.html"), 1, "card-total-unparsable",
        `CARDS 无法求值，total 一致性检查被跳过：${error.message}`);
    }
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
  { cap: "规则：排序", code: ["src/app/pages/theme-workbench/hooks/themeWorkbenchStateStore.ts", /rules\/reorder/], spec: [/排序|⌥↑/] },
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
