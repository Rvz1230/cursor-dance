import { afterEach, describe, expect, it, vi } from "vitest";
import { EDITOR_STATE_STORAGE_KEY } from "../chrome-api";
import {
  mergeEditorState,
  normalizeEditorState,
  readLocalEditorState,
  writeLocalEditorState,
} from "./local-editor-state";

function installLocalStorage(seed?: string) {
  const values = new Map<string, string>();
  if (seed !== undefined) values.set(EDITOR_STATE_STORAGE_KEY, seed);
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
        removeItem: vi.fn((key: string) => { values.delete(key); }),
      },
    },
  });
  return values;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("normalizeEditorState", () => {
  it("keeps navigation strings and the UI preferences", () => {
    expect(normalizeEditorState({
      workspaceId: "workbench",
      themeId: "mono-geo",
      columnWeights: { config: 1.2, preview: 1, ai: 0.9 },
      libraryCollapsed: true,
    })).toEqual({
      workspaceId: "workbench",
      themeId: "mono-geo",
      columnWeights: { config: 1.2, preview: 1, ai: 0.9 },
      libraryCollapsed: true,
    });
  });

  it("drops malformed column weights instead of storing them", () => {
    for (const bad of [{ config: 1, preview: 1 }, { config: "1", preview: 1, ai: 1 }, [], "x", null]) {
      expect(normalizeEditorState({ columnWeights: bad })).toEqual({});
    }
  });

  it("drops a non-boolean libraryCollapsed", () => {
    expect(normalizeEditorState({ libraryCollapsed: "yes" })).toEqual({});
  });

  it("rejects non-object input outright", () => {
    expect(normalizeEditorState(null)).toBeNull();
    expect(normalizeEditorState([])).toBeNull();
  });
});

describe("editor state writes are patches, not replacements", () => {
  it("mergeEditorState layers a patch over the current value", () => {
    expect(mergeEditorState({ themeId: "a", libraryCollapsed: true }, { themeId: "b" }))
      .toEqual({ themeId: "b", libraryCollapsed: true });
    expect(mergeEditorState(null, { themeId: "b" })).toEqual({ themeId: "b" });
  });

  // 回归护栏：导航写入曾经是整体替换，会把列宽和折叠态一起抹掉。
  it("a navigation write preserves independently written UI preferences", async () => {
    installLocalStorage();

    await writeLocalEditorState({ columnWeights: { config: 1.4, preview: 0.9, ai: 1.1 } });
    await writeLocalEditorState({ libraryCollapsed: true });
    await writeLocalEditorState({ workspaceId: "diagnostics", themeId: "drift" });

    expect(await readLocalEditorState()).toEqual({
      workspaceId: "diagnostics",
      themeId: "drift",
      columnWeights: { config: 1.4, preview: 0.9, ai: 1.1 },
      libraryCollapsed: true,
    });
  });

  it("returns null and stays silent when localStorage holds junk", async () => {
    installLocalStorage("not json");
    expect(await readLocalEditorState()).toBeNull();
  });
});
