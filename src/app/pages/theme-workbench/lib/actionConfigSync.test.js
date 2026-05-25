import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getDefaultActionConfigs } from "../model/actionConfigPresets.js";

const CONFIG_STORE_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../public/content-runtime/config-store.js"
);

function extractBaseActionConfigs() {
  const source = fs.readFileSync(CONFIG_STORE_PATH, "utf-8");
  const lines = source.split("\n");

  let fnStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function getBaseActionConfigs()")) {
      fnStart = i;
      break;
    }
  }
  if (fnStart < 0) throw new Error("Could not find getBaseActionConfigs in config-store.js");

  // Find the return statement line
  let returnLine = -1;
  for (let i = fnStart + 1; i < lines.length; i++) {
    if (lines[i].includes("return {")) {
      returnLine = i;
      break;
    }
  }
  if (returnLine < 0) throw new Error("Could not find return statement in getBaseActionConfigs");

  // Count brace depth from the return statement to find the closing brace
  let depth = 0;
  let endLine = returnLine;
  for (let i = returnLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    if (depth === 0 && i > returnLine) {
      endLine = i;
      break;
    }
  }

  const returnBlock = lines.slice(returnLine, endLine + 1).join("\n");
  const fn = new Function(`${returnBlock}`);
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
  "comboWindowMs",
  "particle", "particleCount", "particleSpread", "particleStyle",
  "particleDirection", "particleColorMode", "particleDuration",
  "particleSize", "particleOpacity", "particlePalette",
  "particleGravity", "particleWind", "particleBounce", "particleTrail",
  "ripple", "rippleSize", "rippleDuration", "rippleStyle",
  "rippleEasing", "rippleLineWidth", "rippleOpacity", "rippleColor",
  "sound", "volume", "playbackRate", "soundDelay",
  "soundFadeOut", "soundTriggerMode", "soundBlendMode", "soundFile",
  "animationEnabled", "animationStyle", "animationDuration",
  "animationScale", "animationOpacity",
  "animationOffsetX", "animationOffsetY", "animationColor", "animationGlow",
  "imageEnabled", "imageDataUrl", "imageDuration",
  "imageSize", "imageOpacity", "imageOffsetX", "imageOffsetY",
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
