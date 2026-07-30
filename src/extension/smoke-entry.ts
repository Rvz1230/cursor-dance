import "./runtime-globals";
import "./site-matcher";
import "./visual-effects";
import "./cursor-overlay";
import "./audio";
import "./atmosphere";
import { loadClassicScript } from "./load-classic-script";

for (const src of [
  "/config.js",
  "/content-runtime/diagnostics.js",
  "/content-runtime/config-store.js",
  "/content-runtime/trigger-handlers.js",
  "/content.js",
]) {
  await loadClassicScript(src);
}
