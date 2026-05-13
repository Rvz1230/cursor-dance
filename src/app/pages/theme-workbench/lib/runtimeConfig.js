export function getDefaultConfig() {
  return window.CursorDanceDefaultConfig ?? {};
}

export function getRuntimeConfig() {
  return window.CursorDanceConfigRuntime ?? {};
}

export function normalizeStoredConfig(value) {
  const runtime = getRuntimeConfig();
  const defaultConfig = getDefaultConfig();
  if (typeof runtime.normalizeConfig === "function") {
    return runtime.normalizeConfig(value, defaultConfig);
  }
  return value ?? defaultConfig;
}
