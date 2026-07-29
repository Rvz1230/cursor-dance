import "./runtime-globals";
import { loadClassicScript } from "./load-classic-script";

for (const src of [
  "/config.js",
  "/content-runtime/site-matcher.js",
  "/content-runtime/diagnostics.js",
  "/content-runtime/config-store.js",
  "/content-runtime/visual-effects.js",
  "/content-runtime/audio-duck-profile.js",
  "/content-runtime/audio.js",
  "/content-runtime/cursor-overlay.js",
  "/content-runtime/trigger-handlers.js",
  "/content-runtime/atmosphere.js",
  "/content.js",
]) {
  await loadClassicScript(src);
}
