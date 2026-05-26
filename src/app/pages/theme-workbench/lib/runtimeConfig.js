const NOOP_RUNTIME = {
  getSiteRule: () => ({ mode: "inherit" }),
  getSiteMode: () => "inherit",
  getSiteThemePackId: () => undefined,
  setSiteRuleMode: (config) => config,
  setSiteRuleThemePackId: (config) => config,
  normalizeConfig: (value, fallback) => value ?? fallback,
  normalizeSiteRule: (rule) => ({ mode: typeof rule === "string" ? rule : "inherit" }),
  normalizeSiteRules: (siteRules, fallback) => siteRules ?? fallback ?? { byHost: {} },
  mergeCursorStates: (a, b) => ({ ...(a || {}), ...(b || {}) }),
  mergeThemePackWithFallback: (fallbackPack, pack) => ({ ...fallbackPack, ...pack }),
  needsMigration: () => false,
  cloneValue: (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  },
};

export function getDefaultConfig() {
  return window.CursorDanceDefaultConfig ?? {};
}

export function getRuntimeConfig() {
  const rt = window.CursorDanceConfigRuntime ?? {};
  return new Proxy(rt, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return NOOP_RUNTIME[prop];
    },
  });
}

export function normalizeStoredConfig(value) {
  const runtime = getRuntimeConfig();
  const defaultConfig = getDefaultConfig();
  return runtime.normalizeConfig(value, defaultConfig);
}
