import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), "dist/manifest.json");

function toHostPermission(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    return `${url.origin}/*`;
  } catch {
    return "";
  }
}

function normalizeHostPermission(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("*") && !/^https?:\/\/[^/*]+\/\*$/.test(trimmed)) {
    throw new Error(`Refusing broad host permission: ${trimmed}`);
  }
  if (/^https?:\/\/[^/*]+\/\*$/.test(trimmed)) return trimmed;
  return toHostPermission(trimmed);
}

function getConfiguredHostPermissions(env = process.env) {
  const explicit = String(env.CURSORDANCE_EXTENSION_HOST_PERMISSIONS || "")
    .split(",")
    .map(normalizeHostPermission)
    .filter(Boolean);
  if (explicit.length) return explicit;

  const endpointPermission = normalizeHostPermission(env.VITE_CURSORDANCE_AI_API_ENDPOINT);
  return endpointPermission ? [endpointPermission] : [];
}

const raw = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(raw);
const hostPermissions = [...new Set(getConfiguredHostPermissions())];

if (hostPermissions.length) {
  manifest.host_permissions = hostPermissions;
} else {
  delete manifest.host_permissions;
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  manifestPath,
  hostPermissions,
}, null, 2));
