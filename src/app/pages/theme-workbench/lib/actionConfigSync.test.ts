import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDefaultActionConfigs } from "../model/actionConfigPresets";

const CONFIG_STORE_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../public/content-runtime/config-store.js"
);

function extractBaseActionConfigs() {
  const source = fs.readFileSync(CONFIG_STORE_PATH, "utf-8");
  const lines = source.split("\n");

  let varStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("var BASE_ACTION_CONFIGS = {")) {
      varStart = i;
      break;
    }
  }
  if (varStart < 0) throw new Error("Could not find BASE_ACTION_CONFIGS in config-store");

  // Count brace depth from the opening brace to find the closing }; of the object literal
  let depth = 0;
  let started = false;
  let endLine = varStart;
  for (let i = varStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") { depth++; started = true; }
      if (ch === "}") depth--;
    }
    if (started && depth === 0) {
      endLine = i;
      break;
    }
  }

  // Extract from "{" to the closing "}" (the value part of the assignment)
  const block = lines.slice(varStart, endLine + 1).join("\n");
  const objStart = block.indexOf("{");
  const objEnd = block.lastIndexOf("}") + 1;
  const objLiteral = block.slice(objStart, objEnd);
  const fn = new Function(`return ${objLiteral}`);
  return fn();
}

const FIELDS_TO_COMPARE = [
  "textKind", "textStyle", "textMode", "textTemplate",
  "textEnabled", "textContent", "textTags",
  "textTagPlayMode", "textColor", "textDuration", "textEasing",
  "textOpacity", "textFontFamily", "textWeight",
  "textOutlineWidth", "textShadow", "comboEnabled",
  "textOffsetX", "textOffsetY", "fontSize",
  "textGradient", "textGradientStart", "textGradientEnd",
  "comboWindowMs", "textDelay",
  "particle", "particleCount", "particleSpread", "particleStyle",
  "particleDirection", "particleColorMode", "particleDuration",
  "particleSize", "particleOpacity", "particlePalette",
  "particleGravity", "particleWind", "particleBounce", "particleTrail",
  "particleDelay",
  "ripple", "rippleSize", "rippleDuration", "rippleStyle",
  "rippleEasing", "rippleLineWidth", "rippleOpacity", "rippleColor",
  "rippleDelay",
  "sound", "volume", "playbackRate", "soundDelay",
  "soundFadeOut", "soundTriggerMode", "soundBlendMode", "soundFile",
  "animationEnabled", "animationStyle", "animationDuration",
  "animationScale", "animationOpacity",
  "animationOffsetX", "animationOffsetY", "animationColor", "animationGlow",
  "animationDelay",
  "imageEnabled", "imageDataUrl", "imageDuration",
  "imageSize", "imageOpacity", "imageOffsetX", "imageOffsetY",
  "imageDelay",
  "shake", "cursorOverride", "cursorSize",
  "cursorTrailEnabled", "cursorTrailCount", "cursorTrailOpacity", "cursorGlowColor",
  "triggerTiming", "triggerZone", "holdMs",
];

const ACTION_IDS = ["leftClick", "rightClick", "doubleClick", "longPress", "wheel", "hover"];

describe("action config defaults sync", () => {
  it("content script getBaseActionConfigs matches workbench getDefaultActionConfigs for woodfish", () => {
    const baseConfigs = extractBaseActionConfigs();
    const workbenchConfigs = getDefaultActionConfigs("woodfish");

    const mismatches = [];

    for (const actionId of ACTION_IDS) {
      const base = baseConfigs[actionId];
      const wb = workbenchConfigs[actionId];

      if (!base) {
        mismatches.push(`${actionId}: missing in base configs`);
        continue;
      }
      if (!wb) {
        mismatches.push(`${actionId}: missing in workbench configs`);
        continue;
      }

      for (const field of FIELDS_TO_COMPARE) {
        const baseVal = base[field];
        const wbVal = wb[field];
        if (JSON.stringify(baseVal) !== JSON.stringify(wbVal)) {
          mismatches.push(
            `${actionId}.${field}: base="${baseVal}" vs workbench="${wbVal}"`
          );
        }
      }
    }

    if (mismatches.length > 0) {
      throw new Error(
        `Action config defaults out of sync (${mismatches.length} mismatch(es)):\n` +
        mismatches.map((m) => `  - ${m}`).join("\n") +
        "\n\nUpdate either config-store.js getBaseActionConfigs() or actionConfigPresets.js ACTION_CONFIG_PRESETS to match."
      );
    }

    expect(mismatches).toHaveLength(0);
  });
});
