import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distRoot = resolve(process.cwd(), "dist");
const manifest = JSON.parse(await readFile(resolve(distRoot, "manifest.json"), "utf8"));
const scripts = manifest.content_scripts?.[0]?.js || [];
const contentBundle = "content-runtime/content.js";
const removedRuntimeFiles = [
  "config-runtime/text-semantics.js",
  "config-runtime/action-config.js",
  "config-runtime/compute-specs.js",
  "content.js",
  "content-runtime/trigger-handlers.js",
  "content-runtime/visual-effects.js",
  "content-runtime/cursor-overlay.js",
  "content-runtime/audio.js",
  "content-runtime/audio-duck-profile.js",
];

if (scripts.length !== 1 || scripts[0] !== contentBundle) {
  throw new Error(`Expected ${contentBundle} to be the only content script.`);
}

for (const file of scripts) await access(resolve(distRoot, file));
for (const file of removedRuntimeFiles) {
  try {
    await access(resolve(distRoot, file));
    throw new Error(`Unbundled runtime file remains in dist: ${file}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(JSON.stringify({
  manifest: "dist/manifest.json",
  contentScriptCount: scripts.length,
  contentBundle,
}, null, 2));
