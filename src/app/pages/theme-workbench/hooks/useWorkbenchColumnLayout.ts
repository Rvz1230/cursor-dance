import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { readEditorState, writeEditorState } from "../lib/workbenchConfig";

export interface WorkbenchColumnWeights {
  config: number;
  preview: number;
  ai: number;
}

export type WorkbenchResizeColumn = "config" | "ai";
export type WorkbenchLayoutPreset = "config" | "split" | "preview" | "custom";

export const DEFAULT_WORKBENCH_COLUMN_WEIGHTS: WorkbenchColumnWeights = {
  config: 1,
  preview: 1,
  ai: 1,
};

export const WORKBENCH_LAYOUT_PRESETS: Readonly<Record<Exclude<WorkbenchLayoutPreset, "custom">, WorkbenchColumnWeights>> = {
  config: { config: 1.6, preview: 1, ai: 1 },
  split: DEFAULT_WORKBENCH_COLUMN_WEIGHTS,
  preview: { config: 0.8, preview: 1.7, ai: 1 },
};

/** 各列权重的夹取区间。这里是布局区间的唯一真值源，存储层不复制这些常量。 */
const COLUMN_BOUNDS: Readonly<Record<keyof WorkbenchColumnWeights, readonly [number, number]>> = {
  config: [0.78, 1.8],
  preview: [0.78, 1.9],
  ai: [0.8, 1.9],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 把外部来源（持久化的偏好）夹回合法区间；任何一项不是有限数就整体回落默认值。 */
export function normalizeWorkbenchColumnWeights(value: unknown): WorkbenchColumnWeights {
  if (!value || typeof value !== "object") return DEFAULT_WORKBENCH_COLUMN_WEIGHTS;
  const record = value as Partial<Record<keyof WorkbenchColumnWeights, unknown>>;

  function read(key: keyof WorkbenchColumnWeights): number | null {
    const raw = record[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    return clamp(raw, ...COLUMN_BOUNDS[key]);
  }

  const config = read("config");
  const preview = read("preview");
  const ai = read("ai");
  // 部分有效就整体回落：三列权重是一套布局，混搭默认值会得到用户没见过的比例。
  if (config === null || preview === null || ai === null) return DEFAULT_WORKBENCH_COLUMN_WEIGHTS;
  // 第 7 批以前的“对半布局”实际是 1.05 : 1.25。原型已经把默认值裁定为
  // 真正的 1 : 1；只迁移这组旧默认值，用户手动拖出的自定义比例仍然保留。
  if (Math.abs(config - 1.05) < 0.001 && Math.abs(preview - 1.25) < 0.001) {
    return DEFAULT_WORKBENCH_COLUMN_WEIGHTS;
  }
  return { config, preview, ai };
}

export function resizeWorkbenchColumns(
  startWeights: WorkbenchColumnWeights,
  column: WorkbenchResizeColumn,
  deltaX: number,
): WorkbenchColumnWeights {
  const deltaWeight = deltaX / 180;
  if (column === "config") {
    const config = clamp(startWeights.config + deltaWeight, ...COLUMN_BOUNDS.config);
    const preview = clamp(startWeights.preview - (config - startWeights.config), ...COLUMN_BOUNDS.preview);
    return { ...startWeights, config, preview };
  }

  const ai = clamp(startWeights.ai - deltaWeight, ...COLUMN_BOUNDS.ai);
  const preview = clamp(startWeights.preview - (ai - startWeights.ai), ...COLUMN_BOUNDS.preview);
  return { ...startWeights, preview, ai };
}

export function getWorkbenchGridTemplate(
  weights: WorkbenchColumnWeights,
  aiPanelOpen: boolean,
): string {
  return aiPanelOpen
    ? `minmax(0,${weights.config}fr) 4px minmax(0,${weights.preview}fr) 4px minmax(0,${weights.ai}fr)`
    : `minmax(0,${weights.config}fr) 4px minmax(0,${weights.preview}fr)`;
}

export function getWorkbenchLayoutPreset(weights: WorkbenchColumnWeights): WorkbenchLayoutPreset {
  const match = Object.entries(WORKBENCH_LAYOUT_PRESETS).find(([, preset]) =>
    (Object.keys(preset) as Array<keyof WorkbenchColumnWeights>).every(
      (key) => Math.abs(weights[key] - preset[key]) < 0.001,
    ),
  );
  return (match?.[0] as WorkbenchLayoutPreset | undefined) ?? "custom";
}

export function useWorkbenchColumnLayout(aiPanelOpen: boolean) {
  const [columnWeights, setColumnWeights] = useState(DEFAULT_WORKBENCH_COLUMN_WEIGHTS);
  const [isResizing, setIsResizing] = useState(false);
  const stopResizeRef = useRef<(() => void) | null>(null);

  // 水合已保存的列宽。拖出来的布局不该每次打开工作台都被重置。
  useEffect(() => {
    let cancelled = false;
    void readEditorState().then((editorState) => {
      if (cancelled || !editorState?.columnWeights) return;
      setColumnWeights(normalizeWorkbenchColumnWeights(editorState.columnWeights));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => stopResizeRef.current?.(), []);

  function startResizeColumns(
    event: ReactPointerEvent,
    column: WorkbenchResizeColumn,
  ): void {
    event.preventDefault();
    stopResizeRef.current?.();
    setIsResizing(true);
    const startX = event.clientX;
    const startWeights = columnWeights;
    let latestWeights = startWeights;

    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      if (stopResizeRef.current === stopResize) stopResizeRef.current = null;
      setIsResizing(false);
      // 只在松手时落盘，拖动过程中不写——否则一次拖拽会产生几十次写入。
      if (latestWeights !== startWeights) {
        void writeEditorState({ columnWeights: latestWeights });
      }
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestWeights = resizeWorkbenchColumns(startWeights, column, moveEvent.clientX - startX);
      setColumnWeights(latestWeights);
    };

    stopResizeRef.current = stopResize;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  function setLayoutPreset(preset: Exclude<WorkbenchLayoutPreset, "custom">): void {
    const nextWeights = WORKBENCH_LAYOUT_PRESETS[preset];
    setColumnWeights(nextWeights);
    void writeEditorState({ columnWeights: nextWeights });
  }

  return {
    columnWeights,
    isResizing,
    layoutPreset: getWorkbenchLayoutPreset(columnWeights),
    gridTemplateColumns: getWorkbenchGridTemplate(columnWeights, aiPanelOpen),
    startResizeColumns,
    setLayoutPreset,
  };
}
