import { useCallback, useRef, useState, type PointerEvent } from "react";

interface PointerPosition {
  x: number;
  y: number;
  inside: boolean;
}

export function getLocalPointerPosition(
  bounds: Pick<DOMRect, "left" | "top">,
  clientX: number,
  clientY: number,
): PointerPosition {
  return {
    x: clientX - bounds.left,
    y: clientY - bounds.top,
    inside: true,
  };
}

export function usePreviewPointer() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [pointer, setPointer] = useState<PointerPosition>({ x: 0, y: 0, inside: false });

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (bounds) setPointer(getLocalPointerPosition(bounds, event.clientX, event.clientY));
  }, []);

  const onPointerLeave = useCallback(() => {
    setPointer((current) => ({ ...current, inside: false }));
  }, []);

  return {
    stageRef,
    pointer,
    onPointerMove,
    onPointerLeave,
  };
}
