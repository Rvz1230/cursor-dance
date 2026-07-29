import { validateCursorDanceConfigV4 } from "@/shared/config-schema-v4";

function matchPattern(host, path, pattern) {
  if (!pattern || typeof pattern !== "object" || !pattern.type || typeof pattern.value !== "string") {
    return false;
  }

  const h = typeof host === "string" ? host.trim().toLowerCase() : "";
  const v = pattern.value.trim();
  if (!h || !v) return false;

  switch (pattern.type) {
    case "exact":
      return h === v.toLowerCase();

    case "glob": {
      const reStr = "^" + v.toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "<<<GLOB_STAR_STAR>>>")
        .replace(/\*/g, "[^.]*")
        .replace(/<<<GLOB_STAR_STAR>>>/g, ".*")
        .replace(/\?/g, ".") + "$";
      try {
        return new RegExp(reStr).test(h);
      } catch (_) {
        return false;
      }
    }

    case "path": {
      const parts = v.split("/");
      const patternHost = (parts[0] || "").toLowerCase();
      const patternPath = "/" + parts.slice(1).join("/");
      const hostMatches = pattern.hostType === "glob"
        ? matchPattern(h, path, { type: "glob", value: patternHost })
        : h === patternHost || h.replace(/^www\./, "") === patternHost.replace(/^www\./, "");
      if (!hostMatches) {
        return false;
      }
      if (typeof path === "string") {
        let p = path.trim();
        if (p && !p.startsWith("/")) p = "/" + p;
        return p.startsWith(patternPath) || p === patternPath;
      }
      return true;
    }

    default:
      return false;
  }
}

function resolveSiteRule(rules, host, path) {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || rule.enabled === false) continue;
    if (!matchPattern(host, path, rule.pattern)) continue;

    if (rule.action === "disable") return "disable";
    if (rule.action && typeof rule.action === "object" && rule.action.enable) {
      return {
        enable: true,
        theme: typeof rule.action.theme === "string" ? rule.action.theme : undefined,
      };
    }
  }

  return null;
}

const NOOP_RUNTIME = {
  normalizeConfig: (value, fallback) => {
    const candidate = validateCursorDanceConfigV4(value);
    if (candidate.ok) return candidate.value;
    const fallbackResult = validateCursorDanceConfigV4(fallback);
    return fallbackResult.ok ? fallbackResult.value : {};
  },
  matchPattern,
  resolveSiteRule,
  cloneValue: (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  },
};

export function getDefaultConfig(): CursorDanceConfigRecord {
  return window.CursorDanceDefaultConfig ?? {};
}

export function getRuntimeConfig(): CursorDanceConfigRuntime {
  const rt = window.CursorDanceConfigRuntime ?? {};
  return new Proxy(rt, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop in target) return target[prop];
      return NOOP_RUNTIME[prop];
    },
  });
}

export function normalizeStoredConfig(value): CursorDanceConfigRecord {
  const runtime = getRuntimeConfig();
  const defaultConfig = getDefaultConfig();
  return runtime.normalizeConfig(value, defaultConfig);
}
