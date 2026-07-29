import { protocol } from "electron";
import {
  DESKTOP_ASSET_HOST,
  DESKTOP_ASSET_SCHEME,
  assetIdFromDesktopAssetUrl,
} from "../../shared/asset-reference";
import { readAsset, sniffImageMimeType } from "./asset-repository";

let privilegesRegistered = false;
let protocolRegistered = false;

export function registerAssetSchemePrivileges(): void {
  if (privilegesRegistered) return;
  protocol.registerSchemesAsPrivileged([{
    scheme: DESKTOP_ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  }]);
  privilegesRegistered = true;
}

export function registerAssetProtocol(): void {
  if (protocolRegistered) return;
  protocol.handle(DESKTOP_ASSET_SCHEME, async (request) => {
    const assetId = assetIdFromDesktopAssetUrl(request.url);
    if (!assetId) return new Response("Invalid asset reference", { status: 400 });
    try {
      const bytes = await readAsset(assetId);
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": sniffImageMimeType(bytes),
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Security-Policy": "default-src 'none'",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return new Response(code === "ENOENT" ? "Asset not found" : "Asset read failed", {
        status: code === "ENOENT" ? 404 : 500,
      });
    }
  });
  protocolRegistered = true;
}

export function unregisterAssetProtocol(): void {
  if (!protocolRegistered) return;
  protocol.unhandle(DESKTOP_ASSET_SCHEME);
  protocolRegistered = false;
}

export const __testing__ = {
  reset(): void {
    privilegesRegistered = false;
    protocolRegistered = false;
  },
  host: DESKTOP_ASSET_HOST,
};
