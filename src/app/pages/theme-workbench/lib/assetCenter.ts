import { CURSOR_STATES, formatActionLabel } from "../model/workbenchSchema";

function toSafeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function getConfiguredCursorAssetEntries(cursorStateAssets: Record<string, any> = {}) {
  return CURSOR_STATES.map((state) => {
    const asset = cursorStateAssets?.[state.id];
    if (!asset?.imageDataUrl) return null;

    return {
      id: state.id,
      label: state.label,
      imageDataUrl: asset.imageDataUrl,
      size: toSafeNumber(asset.size, 48),
      hotspotX: toSafeNumber(asset.hotspotX, 16),
      hotspotY: toSafeNumber(asset.hotspotY, 32),
    };
  }).filter(Boolean);
}

export function buildAssetCenterSummary({
  actionId = "leftClick",
  actionConfig = {} as Record<string, any>,
  cursorStateAssets = {} as Record<string, any>,
  recentCursorAssets = [] as any[],
}: {
  actionId?: string;
  actionConfig?: Record<string, any>;
  cursorStateAssets?: Record<string, any>;
  recentCursorAssets?: any[];
} = {}) {
  const actionImageAsset = actionConfig?.imageDataUrl
    ? {
        actionId,
        actionLabel: formatActionLabel(actionId),
        imageDataUrl: actionConfig.imageDataUrl,
        enabled: actionConfig.imageEnabled !== false,
        size: toSafeNumber(actionConfig.imageSize, 96),
        label: actionConfig.imageLabel?.trim() || "当前动作贴纸",
      }
    : null;

  const configuredCursorAssets = getConfiguredCursorAssetEntries(cursorStateAssets);
  const recentAssets = (Array.isArray(recentCursorAssets) ? recentCursorAssets : [])
    .filter((asset) => asset?.imageDataUrl)
    .slice(0, 6)
    .map((asset, index) => ({
      id: asset.id || `recent-${index + 1}`,
      imageDataUrl: asset.imageDataUrl,
      name: asset.name || "未命名素材",
      mimeType: asset.mimeType || "image/png",
      size: toSafeNumber(asset.size, 48),
      hotspotX: toSafeNumber(asset.hotspotX, 16),
      hotspotY: toSafeNumber(asset.hotspotY, 32),
    }));

  return {
    actionImageAsset,
    configuredCursorAssets,
    recentAssets,
    counts: {
      total: configuredCursorAssets.length + recentAssets.length + (actionImageAsset ? 1 : 0),
      cursor: configuredCursorAssets.length,
      recent: recentAssets.length,
      hasActionImageAsset: Boolean(actionImageAsset),
    },
  };
}
