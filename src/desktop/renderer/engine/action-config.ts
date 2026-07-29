import { isDesktopAssetId, toDesktopAssetUrl } from "../../../shared/asset-reference";
import { getActionImageConfig as getSharedActionImageConfig } from "../../../shared/effect-core/action-config";

export * from "../../../shared/effect-core/action-config";

export function getActionImageConfig(config: Record<string, unknown> | undefined): Record<string, unknown> {
  const imageConfig = getSharedActionImageConfig(config);
  if (!imageConfig.imageDataUrl && isDesktopAssetId(imageConfig.imageAssetId)) {
    imageConfig.imageDataUrl = toDesktopAssetUrl(imageConfig.imageAssetId);
  }
  return imageConfig;
}
