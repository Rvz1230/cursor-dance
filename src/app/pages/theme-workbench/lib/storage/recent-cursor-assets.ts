import { getWorkbenchRepository } from "./repository";
import type { RecentCursorAsset } from "./repository/types";

export function readRecentCursorAssets(): Promise<RecentCursorAsset[]> {
  return getWorkbenchRepository().readRecentCursorAssets();
}

export function writeRecentCursorAsset(assetRecord: unknown): Promise<RecentCursorAsset[]> {
  return getWorkbenchRepository().writeRecentCursorAsset(assetRecord);
}
