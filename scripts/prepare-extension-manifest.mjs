import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

// ── 加载 .env 文件到 process.env ──────────────────────────────
// Vite 的 loadEnv 只对 Vite 内部生效。本脚本独立运行时需要自己加载。
function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const projectRoot = resolve(process.cwd());
loadDotEnv(resolve(projectRoot, ".env.production"));
loadDotEnv(resolve(projectRoot, ".env.local"));

// ── 域名 → host_permission 转换 ───────────────────────────────

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

// ── 主流程 ───────────────────────────────────────────────────

const raw = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(raw);
const originalHostPermissions = manifest.host_permissions
  ? [...manifest.host_permissions]
  : [];
const hostPermissions = [...new Set(getConfiguredHostPermissions())];

if (hostPermissions.length) {
  manifest.host_permissions = hostPermissions;
} else if (originalHostPermissions.length) {
  // 无法从环境变量推断 host_permissions 时，保留 manifest 原始值
  console.log("Warning: Could not determine host_permissions from env, keeping original values.");
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  manifestPath,
  hostPermissions: manifest.host_permissions || [],
  fallbackUsed: hostPermissions.length === 0 && originalHostPermissions.length > 0,
}, null, 2));
