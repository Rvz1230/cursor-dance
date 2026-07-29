(function registerSiteMatcher(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  function matchHostPattern(host, pattern) {
    if (!pattern || typeof pattern.host !== "string") return false;
    const candidate = typeof host === "string" ? host.trim().toLowerCase() : "";
    const expected = pattern.host.trim().toLowerCase();
    if (!candidate || !expected) return false;
    if (pattern.type === "exact") return candidate === expected;
    if (pattern.type !== "glob") return false;
    const expression = "^" + expected
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "<<<GLOB_STAR_STAR>>>")
      .replace(/\*/g, "[^.]*")
      .replace(/<<<GLOB_STAR_STAR>>>/g, ".*")
      .replace(/\?/g, ".") + "$";
    try {
      return new RegExp(expression).test(candidate);
    } catch {
      return false;
    }
  }

  function resolveWebContextRule(rules, host, path) {
    if (!Array.isArray(rules)) return null;
    const pathname = typeof path === "string" && path.startsWith("/") ? path : `/${path || ""}`;
    for (const rule of rules) {
      if (rule?.context !== "web" || !rule.enabled) continue;
      if (!matchHostPattern(host, rule.match)) continue;
      if (rule.match.path && !pathname.startsWith(rule.match.path)) continue;
      return rule.action;
    }
    return null;
  }

  modules.matchHostPattern = matchHostPattern;
  modules.resolveWebContextRule = resolveWebContextRule;
})(window);
