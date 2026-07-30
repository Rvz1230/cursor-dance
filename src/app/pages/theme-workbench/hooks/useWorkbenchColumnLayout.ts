import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface WorkbenchColumnWeights {
  config: number;
  preview: number;
  ai: number;
}

export type WorkbenchResizeColumn = "config" | "ai";

export const DEFAULT_WORKBENCH_COLUMN_WEIGHTS: WorkbenchColumnWeights = {
  config: 1.05,
  preview: 1.25,
  ai: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resizeWorkbenchColumns(
  startWeights: WorkbenchColumnWeights,
  column: WorkbenchResizeColumn,
  deltaX: number,
): WorkbenchColumnWeights {
  const deltaWeight = deltaX / 180;
  if (column === "config") {
    const config = clamp(startWeights.config + deltaWeight, 0.78, 1.8);
    const preview = clamp(startWeights.preview - (config - startWeights.config), 0.78, 1.9);
    return { ...startWeights, config, preview };
  }

  const ai = clamp(startWeights.ai - deltaWeight, 0.8, 1.9);
  const preview = clamp(startWeights.preview - (ai - startWeights.ai), 0.78, 1.9);
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

export function useWorkbenchColumnLayout(aiPanelOpen: boolean) {
  const [columnWeights, setColumnWeights] = useState(DEFAULT_WORKBENCH_COLUMN_WEIGHTS);
  const stopResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopResizeRef.current?.(), []);

  function startResizeColumns(
    event: ReactPointerEvent,
    column: WorkbenchResizeColumn,
  ): void {
    event.preventDefault();
    stopResizeRef.current?.();
    const startX = event.clientX;
    const startWeights = columnWeights;

    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      if (stopResizeRef.current === stopResize) stopResizeRef.current = null;
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      setColumnWeights(resizeWorkbenchColumns(startWeights, column, moveEvent.clientX - startX));
    };

    stopResizeRef.current = stopResize;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  return {
    columnWeights,
    gridTemplateColumns: getWorkbenchGridTemplate(columnWeights, aiPanelOpen),
    startResizeColumns,
  };
}
