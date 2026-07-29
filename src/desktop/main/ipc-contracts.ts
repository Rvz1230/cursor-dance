export const MAX_CONFIG_PAYLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_THEME_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_EXTERNAL_URL_LENGTH = 4_096;

const MAX_THEME_PACKS = 256;
const MAX_RULES = 1_000;
const MAX_AI_SECRET_LENGTH = 16_384;
const MAX_AI_URL_LENGTH = 2_048;
const MAX_AI_MODEL_LENGTH = 256;
const MAX_AI_MODE_LENGTH = 64;
export const MAX_AI_TRANSPORT_BYTES = 50 * 1024;
const MAX_AI_REQUEST_ID_LENGTH = 128;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializedByteLength(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("payload is not JSON serializable");
    return Buffer.byteLength(serialized, "utf8");
  } catch (error) {
    throw new Error(`Invalid IPC payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertMaxBytes(value: unknown, maxBytes: number, label: string): void {
  const bytes = serializedByteLength(value);
  if (bytes > maxBytes) {
    throw new Error(`${label} exceeds ${maxBytes} bytes`);
  }
}

function assertOptionalArrayLimit(
  value: Record<string, unknown>,
  key: string,
  maxItems: number,
): void {
  const field = value[key];
  if (field === undefined) return;
  if (!Array.isArray(field)) throw new Error(`${key} must be an array`);
  if (field.length > maxItems) throw new Error(`${key} exceeds ${maxItems} items`);
}

export function validateConfigPayload(payload: unknown): Record<string, unknown> {
  if (!isPlainRecord(payload)) throw new Error("config payload must be an object");
  if (payload.schemaVersion !== 3) {
    throw new Error("config schemaVersion must be 3");
  }
  if (typeof payload.enabled !== "boolean") throw new Error("config enabled must be a boolean");
  assertMaxBytes(payload, MAX_CONFIG_PAYLOAD_BYTES, "config payload");
  assertOptionalArrayLimit(payload, "themePacks", MAX_THEME_PACKS);
  assertOptionalArrayLimit(payload, "schemes", MAX_THEME_PACKS);
  assertOptionalArrayLimit(payload, "siteRules", MAX_RULES);
  assertOptionalArrayLimit(payload, "appRules", MAX_RULES);
  if (!Array.isArray(payload.themePacks)) throw new Error("config themePacks must be an array");
  const themePacks = payload.themePacks;
  if (themePacks.length === 0) throw new Error("config themePacks must not be empty");
  const themeIds = new Set(themePacks.map((pack) => {
    if (!isPlainRecord(pack) || typeof pack.id !== "string" || !pack.id) {
      throw new Error("every theme pack must have a non-empty id");
    }
    return pack.id;
  }));
  if (typeof payload.activeThemePackId !== "string" || !themeIds.has(payload.activeThemePackId)) {
    throw new Error("config activeThemePackId must reference a theme pack");
  }
  return { ...payload };
}

export type ValidatedSaveThemeFileRequest = {
  defaultFileName: string;
  contents: string;
};

export function validateSaveThemeFileRequest(payload: unknown): ValidatedSaveThemeFileRequest {
  if (!isPlainRecord(payload)) throw new Error("theme export request must be an object");
  const { defaultFileName, contents } = payload;
  if (typeof defaultFileName !== "string" || !defaultFileName || defaultFileName.length > 255) {
    throw new Error("theme export file name is invalid");
  }
  if (/[\\/\0]/.test(defaultFileName)) {
    throw new Error("theme export file name must not contain a path");
  }
  if (typeof contents !== "string") throw new Error("theme export contents must be a string");
  if (Buffer.byteLength(contents, "utf8") > MAX_THEME_FILE_BYTES) {
    throw new Error(`theme export exceeds ${MAX_THEME_FILE_BYTES} bytes`);
  }
  validateThemeFileContents(contents);
  return { defaultFileName, contents };
}

export function validateThemeFileContents(contents: string): void {
  if (Buffer.byteLength(contents, "utf8") > MAX_THEME_FILE_BYTES) {
    throw new Error(`theme file exceeds ${MAX_THEME_FILE_BYTES} bytes`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("theme file is not valid JSON");
  }
  if (!isPlainRecord(parsed)) throw new Error("theme file root must be an object");
  const candidate = parsed.themePack ?? parsed.theme ?? parsed.pack ?? parsed.cursordanceTheme ?? parsed;
  if (!isPlainRecord(candidate)) throw new Error("theme file does not contain a theme pack");
  if (!candidate.workbenchDraft && !candidate.behavior && !candidate.cursorStates) {
    throw new Error("theme pack does not contain behavior settings");
  }
}

export type ValidatedAiSettingsPatch = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  apiMode?: string;
};

const AI_PATCH_LIMITS: Record<keyof ValidatedAiSettingsPatch, number> = {
  apiKey: MAX_AI_SECRET_LENGTH,
  baseUrl: MAX_AI_URL_LENGTH,
  model: MAX_AI_MODEL_LENGTH,
  apiMode: MAX_AI_MODE_LENGTH,
};

export function validateAiSettingsPatch(payload: unknown): ValidatedAiSettingsPatch {
  if (!isPlainRecord(payload)) throw new Error("AI settings patch must be an object");
  const patch: ValidatedAiSettingsPatch = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!(key in AI_PATCH_LIMITS)) throw new Error(`unknown AI settings field: ${key}`);
    if (typeof value !== "string") throw new Error(`${key} must be a string`);
    if (value.length > AI_PATCH_LIMITS[key as keyof ValidatedAiSettingsPatch]) {
      throw new Error(`${key} is too long`);
    }
    patch[key as keyof ValidatedAiSettingsPatch] = value;
  }
  if (patch.baseUrl) {
    let url: URL;
    try {
      url = new URL(patch.baseUrl);
    } catch {
      throw new Error("baseUrl must be a valid URL");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("baseUrl protocol must be http or https");
    }
  }
  if (patch.apiMode && !["chat_completions", "responses"].includes(patch.apiMode)) {
    throw new Error("apiMode is not supported");
  }
  return patch;
}

export function validateAiTransportPayload(payload: unknown): Record<string, unknown> {
  if (!isPlainRecord(payload)) throw new Error("AI request payload must be an object");
  assertMaxBytes(payload, MAX_AI_TRANSPORT_BYTES, "AI request payload");
  return payload;
}

export type ValidatedAiStreamRequest = {
  requestId: string;
  payload: Record<string, unknown>;
};

function validateAiRequestId(requestId: unknown): string {
  if (
    typeof requestId !== "string"
    || requestId.length === 0
    || requestId.length > MAX_AI_REQUEST_ID_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(requestId)
  ) {
    throw new Error("AI request id is invalid");
  }
  return requestId;
}

export function validateAiStreamRequest(payload: unknown): ValidatedAiStreamRequest {
  if (!isPlainRecord(payload)) throw new Error("AI stream request must be an object");
  return {
    requestId: validateAiRequestId(payload.requestId),
    payload: validateAiTransportPayload(payload.payload),
  };
}

export function validateAiCancelRequest(payload: unknown): { requestId: string } {
  if (!isPlainRecord(payload)) throw new Error("AI cancel request must be an object");
  return { requestId: validateAiRequestId(payload.requestId) };
}

export function validateExternalTarget(target: unknown): string {
  if (typeof target !== "string" || target.length === 0 || target.length > MAX_EXTERNAL_URL_LENGTH) {
    throw new Error("external target must be a non-empty bounded string");
  }
  return target;
}
