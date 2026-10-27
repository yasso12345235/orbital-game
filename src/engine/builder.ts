/**
 * Builder grid — pure placement math for the 7x5 payload bay.
 * Parts occupy w x h cells; rotation swaps axes; canPlace validates bounds + overlap.
 */
export interface GridCell {
  x: number;
  y: number;
}

export interface PlacedPart {
  componentId: string;
  x: number; // top-left cell
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export const BUILDER_GRID_W = 7;
export const BUILDER_GRID_H = 5;

export function rotatedFootprint(w: number, h: number, rotated: boolean): { w: number; h: number } {
  return rotated ? { w: h, h: w } : { w, h };
}

/** True if rect (x,y,w,h) fits in the grid and overlaps no existing part (ignoring ignoreId). */
export function canPlace(
  parts: PlacedPart[],
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreId?: string,
): boolean {
  if (x < 0 || y < 0 || x + w > BUILDER_GRID_W || y + h > BUILDER_GRID_H) return false;
  for (const p of parts) {
    if (ignoreId && p.componentId === ignoreId) continue;
    const overlap = x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y;
    if (overlap) return false;
  }
  return true;
}

/** First free position that fits w x h, or null. Deterministic scan top-left. */
export function firstFit(parts: PlacedPart[], w: number, h: number): GridCell | null {
  for (let y = 0; y <= BUILDER_GRID_H - h; y++) {
    for (let x = 0; x <= BUILDER_GRID_W - w; x++) {
      if (canPlace(parts, x, y, w, h)) return { x, y };
    }
  }
  return null;
}
