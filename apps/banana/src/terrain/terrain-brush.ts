/**
 * Terrain brush tools for painting elevation and water changes.
 *
 * @group Terrain
 */

import type { TerrainData } from './terrain-data';

/** Available brush modes. */
export type BrushMode = 'raise' | 'lower' | 'flatten' | 'water-paint' | 'water-erase';

/** Parameters controlling a brush stroke. */
export type BrushParams = {
  mode: BrushMode;
  /** Brush radius in world units (meters). */
  radius: number;
  /** Brush strength [0, 1]. Scales the per-frame effect. */
  strength: number;
  /** Target height for the flatten brush (sampled on pointer-down). */
  flattenTarget?: number;
  /** Depth of water painted by the water brush in world units (default 3). */
  waterDepth?: number;
};

/**
 * Smooth hermite falloff: 1 at center, 0 at edge.
 *
 * @param d - Distance from brush center
 * @param r - Brush radius
 */
function falloff(d: number, r: number): number {
  if (d >= r) return 0;
  const t = d / r;
  // Smooth: 1 - 3t² + 2t³
  return 1 - t * t * (3 - 2 * t);
}

/** Axis-aligned bounding box of affected grid vertices. */
export type DirtyRegion = {
  colMin: number;
  colMax: number;
  rowMin: number;
  rowMax: number;
};

/**
 * Apply a single brush stamp at the given world position.
 *
 * @param terrain - Terrain data to modify
 * @param worldX - Brush center X in world space
 * @param worldY - Brush center Y in world space
 * @param params - Brush parameters
 * @param dt - Delta time in seconds (normalizes strength across frame rates)
 * @returns The bounding box of affected grid vertices
 */
export function applyBrush(
  terrain: TerrainData,
  worldX: number,
  worldY: number,
  params: BrushParams,
  dt: number,
): DirtyRegion {
  const { originX, originY, cellSize } = terrain.config;
  const vx = terrain.verticesX;
  const vy = terrain.verticesY;
  const heights = terrain.heights;
  const water = terrain.waterSurface;

  const { mode, radius, strength } = params;
  const waterDepth = params.waterDepth ?? 3;

  // Brush center in grid-float coordinates
  const gcx = (worldX - originX) / cellSize;
  const gcy = (worldY - originY) / cellSize;

  // Bounding box of affected vertices
  const radiusCells = radius / cellSize;
  const colMin = Math.max(0, Math.floor(gcx - radiusCells));
  const colMax = Math.min(vx - 1, Math.ceil(gcx + radiusCells));
  const rowMin = Math.max(0, Math.floor(gcy - radiusCells));
  const rowMax = Math.min(vy - 1, Math.ceil(gcy + radiusCells));

  const maxDelta = strength * 20 * dt; // 20 m/s at full strength

  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      // World-space distance from brush center
      const wx = originX + col * cellSize;
      const wy = originY + row * cellSize;
      const dx = wx - worldX;
      const dy = wy - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const f = falloff(dist, radius);
      if (f <= 0) continue;

      const idx = row * vx + col;

      switch (mode) {
        case 'raise':
          heights[idx] += maxDelta * f;
          break;

        case 'lower':
          heights[idx] -= maxDelta * f;
          break;

        case 'flatten': {
          const target = params.flattenTarget ?? 0;
          const diff = target - heights[idx];
          heights[idx] += diff * strength * f * Math.min(dt * 5, 1);
          break;
        }

        case 'water-paint':
          // Set water surface at terrain height + waterDepth
          water[idx] = heights[idx] + waterDepth;
          break;

        case 'water-erase':
          water[idx] = NaN;
          break;
      }
    }
  }

  // Expand by 1 cell for normal computation (normals sample neighbours)
  return {
    colMin: Math.max(0, colMin - 1),
    colMax: Math.min(vx - 1, colMax + 1),
    rowMin: Math.max(0, rowMin - 1),
    rowMax: Math.min(vy - 1, rowMax + 1),
  };
}
