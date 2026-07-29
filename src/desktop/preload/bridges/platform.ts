import { resolveDesktopCapabilities } from "../../../shared/desktop-capabilities";

export function createPlatformBridge() {
  return {
    platform: process.platform,
    capabilities: resolveDesktopCapabilities(process.platform),
  };
}
