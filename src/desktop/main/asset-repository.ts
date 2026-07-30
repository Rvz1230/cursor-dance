import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { CursorDanceConfigV4, CursorDanceThemeV4 } from "../../shared/config-schema-v4";
import {
  DESKTOP_ASSET_SCHEME,
  assetIdFromDesktopAssetUrl,
  isDesktopAssetId,
} from "../../shared/asset-reference";

const MAX_DESKTOP_ASSET_BYTES = 6 * 1024 * 1024;
export const DESKTOP_ASSET_GC_GRACE_MS = 24 * 60 * 60 * 1_000;

type JsonRecord = Record<string, unknown>;

let assetsDirectoryOverride: string | null = null;

function getAssetsDirectory(): string {
  return assetsDirectoryOverride ?? path.join(app.getPath("userData"), "assets");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function parseDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } {
  const match = /^data:([^;,]+)?((?:;[^,]*)*?),(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("asset must be a valid data URL");
  const mimeType = (match[1] || "application/octet-stream").trim().toLowerCase();
  if (!mimeType.startsWith("image/")) throw new Error("desktop asset must be an image");
  const parameters = match[2] || "";
  let bytes: Buffer;
  try {
    if (parameters.split(";").includes("base64")) {
      const encoded = match[3].replace(/\s/g, "");
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
        throw new Error("invalid base64");
      }
      bytes = Buffer.from(encoded, "base64");
    } else {
      bytes = Buffer.from(decodeURIComponent(match[3]), "utf8");
    }
  } catch {
    throw new Error("asset data URL payload is invalid");
  }
  if (bytes.byteLength === 0) throw new Error("desktop asset is empty");
  if (bytes.byteLength > MAX_DESKTOP_ASSET_BYTES) {
    throw new Error(`desktop asset exceeds ${MAX_DESKTOP_ASSET_BYTES} bytes`);
  }
  return { bytes, mimeType };
}

function assetPath(assetId: string): string {
  if (!isDesktopAssetId(assetId)) throw new Error("desktop asset id is invalid");
  return path.join(getAssetsDirectory(), assetId.slice("sha256:".length));
}

export async function storeDataUrlAsset(dataUrl: string): Promise<string> {
  const { bytes } = parseDataUrl(dataUrl);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const assetId = `sha256:${digest}`;
  const directory = getAssetsDirectory();
  const destination = assetPath(assetId);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.access(destination);
    return assetId;
  } catch {}

  const temporary = path.join(directory, `.${digest}.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, bytes, { flag: "wx" });
  try {
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    try {
      await fs.access(destination);
    } catch {
      throw error;
    }
  }
  return assetId;
}

export async function readAsset(assetId: string): Promise<Buffer> {
  const bytes = await fs.readFile(assetPath(assetId));
  if (bytes.byteLength > MAX_DESKTOP_ASSET_BYTES) {
    throw new Error(`desktop asset exceeds ${MAX_DESKTOP_ASSET_BYTES} bytes`);
  }
  return bytes;
}

export function sniffImageMimeType(bytes: Buffer): string {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) {
    return "image/gif";
  }
  const prefix = bytes.subarray(0, Math.min(bytes.length, 512)).toString("utf8").trimStart();
  if (prefix.startsWith("<svg") || prefix.startsWith("<?xml")) return "image/svg+xml";
  return "application/octet-stream";
}

async function readAssetDataUrl(assetId: string, mimeType?: string): Promise<string> {
  const bytes = await readAsset(assetId);
  const resolvedMimeType = mimeType?.startsWith("image/") ? mimeType : sniffImageMimeType(bytes);
  return `data:${resolvedMimeType};base64,${bytes.toString("base64")}`;
}

async function materializeThemeAssets(themeValue: unknown): Promise<void> {
  const theme = asRecord(themeValue);
  if (!theme) return;

  const cursorSkin = asRecord(theme.cursorSkin);
  const cursorStates = asRecord(cursorSkin?.states);
  for (const stateValue of Object.values(cursorStates || {})) {
    const state = asRecord(stateValue);
    const image = asRecord(state?.image);
    if (!image) continue;
    if (image.kind === "dataUrl" && typeof image.dataUrl === "string") {
      const assetId = await storeDataUrlAsset(image.dataUrl);
      state!.image = {
        kind: "asset",
        assetId,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
      };
    } else if (image.kind === "asset" && !isDesktopAssetId(image.assetId)) {
      throw new Error("desktop cursor asset id is invalid");
    }
  }

  const actionConfigs = asRecord(theme.actionConfigs);
  for (const actionValue of Object.values(actionConfigs || {})) {
    const action = asRecord(actionValue);
    if (!action) continue;
    const hasImageDataUrl = typeof action.imageDataUrl === "string";
    const imageDataUrl = hasImageDataUrl ? action.imageDataUrl as string : "";
    let assetId = typeof action.imageAssetId === "string" ? action.imageAssetId : null;
    if (imageDataUrl.startsWith("data:")) {
      assetId = await storeDataUrlAsset(imageDataUrl);
    } else {
      const referencedAssetId = assetIdFromDesktopAssetUrl(imageDataUrl);
      if (imageDataUrl.startsWith(`${DESKTOP_ASSET_SCHEME}:`) && !referencedAssetId) {
        throw new Error("desktop action image URL is invalid");
      }
      if (hasImageDataUrl && imageDataUrl && !referencedAssetId) {
        throw new Error("desktop action image must use a data URL or asset id");
      }
      assetId = referencedAssetId ?? assetId;
    }
    if (hasImageDataUrl && imageDataUrl === "") assetId = null;
    if (assetId) {
      if (!isDesktopAssetId(assetId)) throw new Error("desktop action image asset id is invalid");
      action.imageAssetId = assetId;
      delete action.imageDataUrl;
    } else {
      delete action.imageAssetId;
    }
  }
}

export async function materializeConfigAssets(config: CursorDanceConfigV4): Promise<CursorDanceConfigV4> {
  const next = cloneJson(config) as unknown as JsonRecord;
  const themes = Array.isArray(next.themes) ? next.themes : [];
  for (const theme of themes) await materializeThemeAssets(theme);
  return next as unknown as CursorDanceConfigV4;
}

async function hydrateThemeAssetsInPlace(themeValue: unknown): Promise<void> {
  const theme = asRecord(themeValue);
  if (!theme) return;

  const cursorSkin = asRecord(theme.cursorSkin);
  const cursorStates = asRecord(cursorSkin?.states);
  for (const stateValue of Object.values(cursorStates || {})) {
    const state = asRecord(stateValue);
    const image = asRecord(state?.image);
    if (image?.kind !== "asset" || !isDesktopAssetId(image.assetId)) continue;
    state!.image = {
      kind: "dataUrl",
      dataUrl: await readAssetDataUrl(image.assetId, typeof image.mimeType === "string" ? image.mimeType : undefined),
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
    };
  }

  const actionConfigs = asRecord(theme.actionConfigs);
  for (const actionValue of Object.values(actionConfigs || {})) {
    const action = asRecord(actionValue);
    if (!action || !isDesktopAssetId(action.imageAssetId)) continue;
    action.imageDataUrl = await readAssetDataUrl(action.imageAssetId);
    delete action.imageAssetId;
  }
}

export async function hydrateThemeAssets(theme: CursorDanceThemeV4): Promise<CursorDanceThemeV4> {
  const next = cloneJson(theme) as unknown as JsonRecord;
  await hydrateThemeAssetsInPlace(next);
  return next as unknown as CursorDanceThemeV4;
}

export async function hydrateThemeExportContents(contents: string): Promise<string> {
  const payload = JSON.parse(contents) as JsonRecord;
  const theme = payload.theme as CursorDanceThemeV4;
  return `${JSON.stringify({ ...payload, theme: await hydrateThemeAssets(theme) }, null, 2)}\n`;
}

export function collectReferencedAssetIds(...values: unknown[]): Set<string> {
  const assetIds = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    if (isDesktopAssetId(record.assetId)) assetIds.add(record.assetId);
    if (isDesktopAssetId(record.imageAssetId)) assetIds.add(record.imageAssetId);
    Object.values(record).forEach(visit);
  };
  values.forEach(visit);
  return assetIds;
}

export async function sweepUnreferencedAssets(referencedAssetIds: ReadonlySet<string>): Promise<number> {
  const directory = getAssetsDirectory();
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let removed = 0;
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || !/^[a-f0-9]{64}$/.test(entry.name)) return;
    const assetId = `sha256:${entry.name}`;
    if (referencedAssetIds.has(assetId)) return;
    const candidatePath = path.join(directory, entry.name);
    const stats = await fs.stat(candidatePath);
    if (Date.now() - stats.mtimeMs < DESKTOP_ASSET_GC_GRACE_MS) return;
    await fs.unlink(candidatePath);
    removed += 1;
  }));
  return removed;
}

export const __testing__ = {
  setAssetsDirectory(directory: string | null): void {
    assetsDirectoryOverride = directory;
  },
};
