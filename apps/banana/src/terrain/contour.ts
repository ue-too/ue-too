/**
 * Marching-squares contour line extraction from a heightmap grid.
 *
 * Produces line segments for each contour level that can be drawn directly
 * with PixiJS Graphics.
 *
 * @group Terrain
 */

import type { TerrainData } from './terrain-data';

/** A 2D point in world space. */
export type ContourPoint = { x: number; y: number };

/** A line segment connecting two points along a contour. */
export type ContourSegment = { a: ContourPoint; b: ContourPoint };

/**
 * Extract contour line segments at a given elevation threshold.
 *
 * Iterates every cell of the heightmap, classifies the 4 corner vertices
 * as above/below the threshold, and uses the 16-case marching-squares
 * lookup to emit interpolated line segments.
 *
 * @param terrain - The heightmap data
 * @param threshold - Elevation level to extract contour at
 * @returns Array of line segments in world space
 */
export function extractContourSegments(terrain: TerrainData, threshold: number): ContourSegment[] {
  const { cellsX, cellsY, cellSize, originX, originY } = terrain.config;
  const vx = terrain.verticesX;
  const heights = terrain.heights;
  const segments: ContourSegment[] = [];

  for (let row = 0; row < cellsY; row++) {
    for (let col = 0; col < cellsX; col++) {
      const h00 = heights[row * vx + col];
      const h10 = heights[row * vx + col + 1];
      const h01 = heights[(row + 1) * vx + col];
      const h11 = heights[(row + 1) * vx + col + 1];

      // Classify corners: 1 if above threshold
      let caseIndex = 0;
      if (h00 > threshold) caseIndex |= 1;
      if (h10 > threshold) caseIndex |= 2;
      if (h11 > threshold) caseIndex |= 4;
      if (h01 > threshold) caseIndex |= 8;

      if (caseIndex === 0 || caseIndex === 15) continue;

      // World positions of the 4 corners
      const x0 = originX + col * cellSize;
      const y0 = originY + row * cellSize;
      const x1 = x0 + cellSize;
      const y1 = y0 + cellSize;

      // Interpolated edge crossing points
      const top = interp(x0, y0, h00, x1, y0, h10, threshold);
      const bottom = interp(x0, y1, h01, x1, y1, h11, threshold);
      const left = interp(x0, y0, h00, x0, y1, h01, threshold);
      const right = interp(x1, y0, h10, x1, y1, h11, threshold);

      switch (caseIndex) {
        case 1: case 14:
          segments.push({ a: top, b: left });
          break;
        case 2: case 13:
          segments.push({ a: top, b: right });
          break;
        case 3: case 12:
          segments.push({ a: left, b: right });
          break;
        case 4: case 11:
          segments.push({ a: right, b: bottom });
          break;
        case 6: case 9:
          segments.push({ a: top, b: bottom });
          break;
        case 7: case 8:
          segments.push({ a: left, b: bottom });
          break;
        case 5: {
          // Saddle: use center value to disambiguate
          const center = (h00 + h10 + h01 + h11) * 0.25;
          if (center > threshold) {
            segments.push({ a: top, b: right });
            segments.push({ a: left, b: bottom });
          } else {
            segments.push({ a: top, b: left });
            segments.push({ a: right, b: bottom });
          }
          break;
        }
        case 10: {
          const center = (h00 + h10 + h01 + h11) * 0.25;
          if (center > threshold) {
            segments.push({ a: top, b: left });
            segments.push({ a: right, b: bottom });
          } else {
            segments.push({ a: top, b: right });
            segments.push({ a: left, b: bottom });
          }
          break;
        }
      }
    }
  }

  return segments;
}

function interp(
  x1: number, y1: number, h1: number,
  x2: number, y2: number, h2: number,
  threshold: number,
): ContourPoint {
  const dh = h2 - h1;
  if (Math.abs(dh) < 1e-8) {
    return { x: x1, y: y1 };
  }
  const t = (threshold - h1) / dh;
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}
