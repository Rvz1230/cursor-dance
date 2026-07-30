import {
  cloneValue,
  defaultConfig,
  normalizeConfig,
} from "@/shared/config/default-config";

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

function resolveSiteRule(rules, host, path = "/") {
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

const runtimeConfig = {
  normalizeConfig,
  matchPattern,
  resolveSiteRule,
  cloneValue,
};

export function getDefaultConfig() {
  return defaultConfig;
}

export function getRuntimeConfig() {
  return runtimeConfig;
}

export function normalizeStoredConfig(value: unknown) {
  return normalizeConfig(value, defaultConfig);
}
