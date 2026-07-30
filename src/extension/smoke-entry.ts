import "./runtime-globals";
import "./site-matcher";
import "./diagnostics";
import "./config-store";
import "./visual-effects";
import "./cursor-overlay";
import "./audio";
import "./atmosphere";
import "./trigger-handlers";
import { loadClassicScript } from "./load-classic-script";

for (const src of [
  "/config.js",
  "/content.js",
]) {
  await loadClassicScript(src);
}
