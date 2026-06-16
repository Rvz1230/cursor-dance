// CursorDance 桌面端「应用规则」匹配
//
// 替代扩展端的 site-matcher（host/path 匹配 URL）。桌面端 overlay 跑在所有应用之上，
// 用户的规则维度从「域名 / 路径」切换为「进程名 / 窗口标题」。
//
// 关键调整：
//   - 保留 exact / glob 两种 pattern.type，与 site-matcher 行为对齐。
//   - glob 替换：`**` → `.*`，`*` → `.*`（**与扩展端不同**：扩展端基于 host
//     的 `.` 分段语义采用 `[^.]*`；桌面 process/title 没有段概念，统一用 `.*`
//     更直观，例如 `*cursor-dance*` 能跨标点匹配 `package.json — cursor-dance`），
//     `?` → `.`，其它正则元字符转义。
//   - 新增 pattern.target 选填字段：`process` | `title`，缺省 `process`，
//     与桌面 IPC 上来的 ActiveAppInfo（app-active.ts，任务 3.2 落地）互通。
//   - resolveAppRule 行为对照 resolveSiteRule：按顺序找首个匹配，
//     `disable` / `{ enable, theme? }` 两种 action。
//
// 测试参考 extension/content-runtime/site-matcher.test.js —— 桌面版稍后会补
// app-matcher.test.ts，逻辑骨架在这里先稳定下来。

export type AppRuleTarget = "process" | "title";

export interface AppRulePattern {
  type: "exact" | "glob";
  value: string;
  /** 匹配维度：进程名（如 "Code.exe" / "code"）或窗口标题。缺省 "process"。 */
  target?: AppRuleTarget;
}

export interface AppRule {
  id?: string;
  pattern: AppRulePattern;
  action: "disable" | { enable: boolean; theme?: string };
  enabled?: boolean;
}

export interface ActiveAppInfo {
  /** 当前前台进程名（小写比较前不要预处理） */
  processName: string;
  /** 当前前台窗口标题。空串表示未知 */
  title: string;
}

/**
 * 单条规则匹配。
 * @param info  当前前台应用信息
 * @param pattern 规则 pattern
 */
export function matchPattern(info: ActiveAppInfo, pattern: AppRulePattern | null | undefined): boolean {
  if (!pattern || typeof pattern !== "object" || !pattern.type || typeof pattern.value !== "string") {
    return false;
  }

  const target: AppRuleTarget = pattern.target === "title" ? "title" : "process";
  const haystack = (target === "title" ? info?.title : info?.processName) || "";
  const h = haystack.trim().toLowerCase();
  const v = pattern.value.trim();
  if (!h || !v) return false;

  switch (pattern.type) {
    case "exact":
      return h === v.toLowerCase();

    case "glob": {
      // glob → regex（桌面口径，非扩展段语义）：
      //   **  → .*    多段通配（与单段语义同结果，保留写法兼容）
      //   *   → .*    单段通配（process/title 无段结构，统一用 .*）
      //   ?   → .     单字符
      const reStr = "^" + v.toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*+/g, ".*")
        .replace(/\?/g, ".") + "$";
      try {
        return new RegExp(reStr).test(h);
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * 顺序查找首个匹配的规则，返回其 action。
 * 与扩展端 resolveSiteRule 的返回形态一致，调用方可以共享解析路径。
 */
export function resolveAppRule(
  rules: AppRule[] | null | undefined,
  info: ActiveAppInfo,
): null | "disable" | { enable: boolean; theme?: string } {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || rule.enabled === false) continue;
    if (!matchPattern(info, rule.pattern)) continue;

    if (rule.action === "disable") return "disable";
    if (rule.action && typeof rule.action === "object" && (rule.action as { enable?: unknown }).enable) {
      const theme = (rule.action as { theme?: unknown }).theme;
      return {
        enable: true,
        theme: typeof theme === "string" ? theme : undefined,
      };
    }
  }

  return null;
}
