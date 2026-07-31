import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CURSOR_STATE_IDS,
  getCursorStatesForPlatform,
  isCursorStateId,
  matchCursorStateIdFromFileName,
  pickKnownCursorStates,
} from "./cursor-states";

const projectRoot = resolve(import.meta.dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("cursor state truth source", () => {
  it("exposes only states that some platform can actually reach", () => {
    for (const stateId of CURSOR_STATE_IDS) {
      const reachableSomewhere =
        getCursorStatesForPlatform("extension").some((state) => state.id === stateId)
        || getCursorStatesForPlatform("desktop").some((state) => state.id === stateId);
      expect(reachableSomewhere, `${stateId} 不被任何平台产出，不应存在配置槽位`).toBe(true);
    }
  });

  it("keeps the extension reachable set aligned with resolveCursorStateId output", () => {
    // 运行时是唯一权威：直接从源码抓出 resolveCursorStateId 真正会赋给 stateId 的值。
    const source = readSource("src/shared/effect-runtime/runtime-config.ts");
    const body = source.slice(
      source.indexOf("function resolveCursorStateId"),
      source.indexOf("function matchesTriggerZone"),
    );
    expect(body.length).toBeGreaterThan(0);

    const produced = new Set(
      [...body.matchAll(/stateId(?:\s*:\s*CursorStateId)?\s*=\s*"([a-zA-Z]+)"/g)].map(
        (match) => match[1],
      ),
    );
    // return "default" 也算一条产出路径
    produced.add("default");

    const declared = new Set(getCursorStatesForPlatform("extension").map((state) => state.id));
    expect([...produced].sort()).toEqual([...declared].sort());
  });

  it("keeps the desktop reachable set aligned with the overlay state machine", () => {
    const source = readSource("src/desktop/renderer/overlay/index.ts");
    const produced = new Set(
      [...source.matchAll(/setActiveCursorSkinState\(\s*(?:[^)]*?\?\s*)?"([a-zA-Z]+)"/g)].map(
        (match) => match[1],
      ),
    );
    // 三元的另一分支
    for (const match of source.matchAll(/setActiveCursorSkinState\([^)]*:\s*"([a-zA-Z]+)"/g)) {
      produced.add(match[1]);
    }

    const declared = new Set(getCursorStatesForPlatform("desktop").map((state) => state.id));
    expect([...produced].sort()).toEqual([...declared].sort());
  });

  it("no longer declares the removed slots", () => {
    for (const removed of [
      "grab",
      "crosshair",
      "move",
      "resizeHorizontal",
      "resizeVertical",
      "resizeDiagonalNWSE",
      "resizeDiagonalNESW",
    ]) {
      expect(isCursorStateId(removed)).toBe(false);
    }
  });

  it("resolves busy rather than the legacy wait id", () => {
    expect(isCursorStateId("busy")).toBe(true);
    expect(isCursorStateId("wait")).toBe(false);
    const source = readSource("src/shared/effect-runtime/runtime-config.ts");
    expect(source).not.toMatch(/stateId\s*=\s*"wait"/);
  });

  it("drops orphan state keys without touching known ones", () => {
    const picked = pickKnownCursorStates({
      default: 1,
      grabbing: 2,
      resizeDiagonalNESW: 3,
      crosshair: 4,
    });
    expect(picked).toEqual({ default: 1, grabbing: 2 });
  });

  it("returns an empty object for missing state maps", () => {
    expect(pickKnownCursorStates(null)).toEqual({});
    expect(pickKnownCursorStates(undefined)).toEqual({});
  });

  it("only matches file names onto states that still exist", () => {
    expect(matchCursorStateIdFromFileName("my-pointer.png")).toBe("pointer");
    expect(matchCursorStateIdFromFileName("loading@2x.svg")).toBe("busy");
    expect(matchCursorStateIdFromFileName("dragging.webp")).toBe("grabbing");
    expect(matchCursorStateIdFromFileName("nesw-resize.png")).toBe("");
    expect(matchCursorStateIdFromFileName("unmatched.png")).toBe("");
  });
});
