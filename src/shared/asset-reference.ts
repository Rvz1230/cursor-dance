export const DESKTOP_ASSET_SCHEME = "cursordance-asset";
export const DESKTOP_ASSET_HOST = "asset";

const SHA256_ASSET_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function isDesktopAssetId(value: unknown): value is string {
  return typeof value === "string" && SHA256_ASSET_ID_PATTERN.test(value);
}

export function toDesktopAssetUrl(assetId: string): string {
  if (!isDesktopAssetId(assetId)) return "";
  return `${DESKTOP_ASSET_SCHEME}://${DESKTOP_ASSET_HOST}/${encodeURIComponent(assetId)}`;
}

export function assetIdFromDesktopAssetUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(`${DESKTOP_ASSET_SCHEME}:`)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== `${DESKTOP_ASSET_SCHEME}:` || url.hostname !== DESKTOP_ASSET_HOST) return null;
    const assetId = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return isDesktopAssetId(assetId) ? assetId : null;
  } catch {
    return null;
  }
}

export function resolveDesktopImageSource(image: unknown): string {
  if (!image || typeof image !== "object") return "";
  const candidate = image as { kind?: unknown; dataUrl?: unknown; assetId?: unknown };
  if (candidate.kind === "dataUrl" && typeof candidate.dataUrl === "string") {
    return candidate.dataUrl;
  }
  if (candidate.kind === "asset" && typeof candidate.assetId === "string") {
    return toDesktopAssetUrl(candidate.assetId);
  }
  return "";
}
