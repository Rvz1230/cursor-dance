import {
  AI_SCHEME_PATCH_FIELDS,
  ARRAY_FIELDS,
  BOOLEAN_FIELDS,
  ENUM_OPTIONS,
  NUMERIC_LIMITS,
  STRING_FIELDS,
} from "./field-defs.js";

export function clampNumber(fieldName, value) {
  const limits = NUMERIC_LIMITS[fieldName];
  if (!limits) return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return limits[0];
  return Math.min(limits[1], Math.max(limits[0], Math.round(numericValue)));
}

export function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
}

export function sanitizePatchValue(fieldName, value) {
  if (Object.prototype.hasOwnProperty.call(NUMERIC_LIMITS, fieldName)) {
    return clampNumber(fieldName, value);
  }
  if (Object.prototype.hasOwnProperty.call(ENUM_OPTIONS, fieldName)) {
    return ENUM_OPTIONS[fieldName].includes(value) ? value : undefined;
  }
  if (BOOLEAN_FIELDS.has(fieldName)) {
    return typeof value === "boolean" ? value : undefined;
  }
  if (fieldName === "textColor") {
    return normalizeHexColor(value) ?? undefined;
  }
  if (STRING_FIELDS.has(fieldName)) {
    return typeof value === "string" ? value.slice(0, 500) : undefined;
  }
  if (ARRAY_FIELDS.has(fieldName)) {
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return undefined;
}

export function sanitizeAiSchemePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([fieldName]) => AI_SCHEME_PATCH_FIELDS.has(fieldName))
      .map(([fieldName, value]) => [fieldName, sanitizePatchValue(fieldName, value)])
      .filter(([, value]) => value !== undefined)
  );
}

export function getAiPatchSanitizeMeta(rawPatch, sanitizedPatch = sanitizeAiSchemePatch(rawPatch)) {
  const rawKeys = rawPatch && typeof rawPatch === "object" && !Array.isArray(rawPatch) ? Object.keys(rawPatch) : [];
  const sanitizedKeys = Object.keys(sanitizedPatch || {});
  return {
    rawFieldCount: rawKeys.length,
    acceptedFieldCount: sanitizedKeys.length,
    droppedFieldCount: Math.max(0, rawKeys.length - sanitizedKeys.length),
    droppedFields: rawKeys.filter((fieldName) => !sanitizedKeys.includes(fieldName)),
  };
}

export function mergeActionConfig(baseConfig = {}, ...overlays) {
  return overlays.reduce(
    (mergedConfig, overlay) => ({
      ...mergedConfig,
      ...(overlay || {}),
      textTags: Array.isArray(overlay?.textTags)
        ? [...overlay.textTags]
        : mergedConfig.textTags,
    }),
    {
      ...baseConfig,
      textTags: Array.isArray(baseConfig?.textTags) ? [...baseConfig.textTags] : [],
    }
  );
}
