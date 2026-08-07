export interface DisplayRoutingTarget {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}

function squaredDistanceToBounds(
  point: { x: number; y: number },
  bounds: DisplayRoutingTarget["bounds"],
): number {
  const nearestX = Math.max(bounds.x, Math.min(point.x, bounds.x + bounds.width));
  const nearestY = Math.max(bounds.y, Math.min(point.y, bounds.y + bounds.height));
  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
}

/** Resolve the overlay that owns the current pointer, including display gaps. */
export function resolveDisplayIdAtPoint(
  displays: readonly DisplayRoutingTarget[],
  point: { x: number; y: number },
  fallbackId: number | null,
): number | null {
  if (displays.length === 0) return fallbackId;
  const containing = displays.find(({ bounds }) =>
    point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height);
  if (containing) return containing.id;

  const nearest = displays.reduce((best, candidate) =>
    squaredDistanceToBounds(point, candidate.bounds) < squaredDistanceToBounds(point, best.bounds)
      ? candidate
      : best);
  return nearest?.id ?? fallbackId;
}
