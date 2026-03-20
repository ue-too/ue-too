/**
 * Utilities for populating water bodies on a {@link TerrainData} grid.
 *
 * These functions mutate the water surface array of an existing TerrainData
 * instance. They work with any heightmap source (procedural or real-world).
 *
 * @group Terrain
 */

import { TerrainData } from './terrain-data';
import type { TerrainConfig } from './terrain-data';

/**
 * Flood all vertices below a given elevation with water at that elevation.
 * Produces oceans and low-lying lakes.
 *
 * @param terrain - Terrain data to modify
 * @param waterLevel - Water surface elevation; vertices below this get water
 *
 * @example
 * ```typescript
 * // Flood everything below sea level
 * floodBelow(terrain, 0);
 * ```
 */
export function floodBelow(terrain: TerrainData, waterLevel: number): void {
  const heights = terrain.heights;
  const water = terrain.waterSurface;
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] < waterLevel) {
      water[i] = waterLevel;
    }
  }
}

/** 8-connected neighbor offsets (dx, dy). */
const NEIGHBORS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

/**
 * Trace a river from a starting vertex downhill using steepest descent.
 * The river follows the lowest neighbor at each step until it reaches
 * the grid edge, an existing water body, or a local minimum.
 *
 * @param terrain - Terrain data to modify
 * @param startCol - Starting column
 * @param startRow - Starting row
 * @param width - River half-width in grid cells (0 = single cell, 1 = 3 cells wide, etc.)
 * @param depth - How deep to carve the river channel in world units (default 3)
 */
export function traceRiver(
  terrain: TerrainData,
  startCol: number,
  startRow: number,
  width = 1,
  depth = 3,
): void {
  const vx = terrain.verticesX;
  const vy = terrain.verticesY;
  const heights = terrain.heights;
  const water = terrain.waterSurface;

  // Phase 1: trace the path using unmodified heights
  const path: { col: number; row: number }[] = [];
  const visited = new Set<number>();
  const key = (c: number, r: number): number => r * vx + c;

  let col = startCol;
  let row = startRow;

  const maxSteps = vx * vy;
  for (let step = 0; step < maxSteps; step++) {
    if (col < 0 || col >= vx || row < 0 || row >= vy) break;

    const k = key(col, row);
    if (visited.has(k)) break;
    visited.add(k);

    if (!isNaN(water[k]) && step > 0) break;

    path.push({ col, row });

    // Find steepest descent neighbor
    let bestCol = -1;
    let bestRow = -1;
    let bestH = heights[k];

    for (const [dx, dy] of NEIGHBORS) {
      const nc = col + dx;
      const nr = row + dy;
      if (nc < 0 || nc >= vx || nr < 0 || nr >= vy) continue;
      const nh = heights[nr * vx + nc];
      if (nh < bestH) {
        bestH = nh;
        bestCol = nc;
        bestRow = nr;
      }
    }

    if (bestCol === -1) break;
    col = bestCol;
    row = bestRow;
  }

  // Phase 2: carve the channel and set water along the traced path
  for (const p of path) {
    for (let dy = -width; dy <= width; dy++) {
      for (let dx = -width; dx <= width; dx++) {
        const nc = p.col + dx;
        const nr = p.row + dy;
        if (nc < 0 || nc >= vx || nr < 0 || nr >= vy) continue;
        const ni = nr * vx + nc;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const taper = Math.max(0, 1 - dist / (width + 1));
        const carveDepth = depth * taper;
        const originalH = heights[ni];
        const carvedH = originalH - carveDepth;
        if (carvedH < heights[ni]) {
          heights[ni] = carvedH;
        }
        // Water surface sits at the original (pre-carve) terrain level
        if (isNaN(water[ni]) || originalH > water[ni]) {
          water[ni] = originalH;
        }
      }
    }
  }
}

/** Min-heap for priority-flood algorithm. Keyed by height. */
class MinHeap {
  private _data: { col: number; row: number; h: number }[] = [];

  get length(): number { return this._data.length; }

  push(item: { col: number; row: number; h: number }): void {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  pop(): { col: number; row: number; h: number } | undefined {
    const data = this._data;
    if (data.length === 0) return undefined;
    const top = data[0];
    const last = data.pop()!;
    if (data.length > 0) {
      data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    const data = this._data;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (data[i].h >= data[parent].h) break;
      [data[i], data[parent]] = [data[parent], data[i]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const data = this._data;
    const n = data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && data[left].h < data[smallest].h) smallest = left;
      if (right < n && data[right].h < data[smallest].h) smallest = right;
      if (smallest === i) break;
      [data[i], data[smallest]] = [data[smallest], data[i]];
      i = smallest;
    }
  }
}

/**
 * Fill a depression (local minimum) with water up to the lowest spill point.
 * Uses a priority-flood from the seed point, expanding outward until the water
 * level reaches a point where it would spill over a ridge.
 *
 * @param terrain - Terrain data to modify
 * @param seedCol - Column of a point inside the depression
 * @param seedRow - Row of a point inside the depression
 * @param maxRise - Maximum rise above the seed point's elevation to fill (default 10)
 * @returns The fill level that was used, or NaN if the seed is out of bounds
 */
export function fillDepression(
  terrain: TerrainData,
  seedCol: number,
  seedRow: number,
  maxRise = 10,
): number {
  const vx = terrain.verticesX;
  const vy = terrain.verticesY;
  const heights = terrain.heights;
  const water = terrain.waterSurface;

  if (seedCol < 0 || seedCol >= vx || seedRow < 0 || seedRow >= vy) return NaN;

  const seedH = heights[seedRow * vx + seedCol];
  const maxLevel = seedH + maxRise;

  const key = (c: number, r: number): number => r * vx + c;
  const inBasin = new Set<number>();
  let spillLevel = maxLevel;

  const boundary = new MinHeap();
  const filled = new Set<number>();

  // Start from seed
  const startKey = key(seedCol, seedRow);
  filled.add(startKey);
  inBasin.add(startKey);

  // Add seed's neighbors to boundary
  for (const [dx, dy] of NEIGHBORS) {
    const nc = seedCol + dx;
    const nr = seedRow + dy;
    if (nc < 0 || nc >= vx || nr < 0 || nr >= vy) {
      spillLevel = Math.min(spillLevel, seedH);
      continue;
    }
    const nk = key(nc, nr);
    if (!filled.has(nk)) {
      boundary.push({ col: nc, row: nr, h: heights[nr * vx + nc] });
      filled.add(nk);
    }
  }

  let waterLevel = seedH;

  while (boundary.length > 0) {
    const cell = boundary.pop()!;

    if (cell.h > maxLevel) {
      spillLevel = Math.min(spillLevel, cell.h);
      break;
    }

    waterLevel = Math.max(waterLevel, cell.h);

    if (cell.col === 0 || cell.col === vx - 1 || cell.row === 0 || cell.row === vy - 1) {
      spillLevel = waterLevel;
      break;
    }

    inBasin.add(key(cell.col, cell.row));

    for (const [dx, dy] of NEIGHBORS) {
      const nc = cell.col + dx;
      const nr = cell.row + dy;
      if (nc < 0 || nc >= vx || nr < 0 || nr >= vy) {
        spillLevel = waterLevel;
        continue;
      }
      const nk = key(nc, nr);
      if (!filled.has(nk)) {
        filled.add(nk);
        boundary.push({ col: nc, row: nr, h: heights[nr * vx + nc] });
      }
    }
  }

  const fillLevel = Math.min(waterLevel, spillLevel);

  for (const k of inBasin) {
    if (heights[k] < fillLevel) {
      water[k] = fillLevel;
    }
  }

  return fillLevel;
}

/**
 * Populate a terrain with procedurally generated water bodies:
 * - A lake in the lowest depression
 * - Rivers flowing from high points downhill
 * - Low-lying flood areas
 *
 * @param terrain - Terrain data to modify (water surface will be populated)
 * @param options - Configuration for water generation
 */
export function generateWater(
  terrain: TerrainData,
  options: {
    /** Water level for low-lying flood areas (default: uses 15th percentile of heights). */
    floodLevel?: number;
    /** Number of rivers to generate (default 3). */
    riverCount?: number;
    /** River half-width in grid cells (default 1). */
    riverWidth?: number;
    /** Number of lakes to attempt filling (default 2). */
    lakeCount?: number;
    /** Maximum rise for lake fill above the seed depression (default 8). */
    lakeMaxRise?: number;
    /** Random seed for reproducibility (default 7). */
    seed?: number;
  } = {},
): void {
  const {
    riverCount = 3,
    riverWidth = 1,
    lakeCount = 2,
    lakeMaxRise = 8,
    seed = 7,
  } = options;

  const vx = terrain.verticesX;
  const vy = terrain.verticesY;
  const heights = terrain.heights;

  // Simple seeded pseudo-random
  let rngState = seed;
  const rand = (): number => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  // Compute height statistics
  const sorted = Float32Array.from(heights).sort();
  const floodLevel = options.floodLevel ?? sorted[Math.floor(sorted.length * 0.15)];

  // 1. Flood low-lying areas
  floodBelow(terrain, floodLevel);

  // 2. Fill depressions as lakes — find local minima
  if (lakeCount > 0) {
    // Collect local minima (lower than all 8 neighbors)
    const minima: { col: number; row: number; h: number }[] = [];
    for (let row = 1; row < vy - 1; row++) {
      for (let col = 1; col < vx - 1; col++) {
        const h = heights[row * vx + col];
        // Skip if already flooded
        if (h < floodLevel) continue;
        let isMin = true;
        for (const [dx, dy] of NEIGHBORS) {
          if (heights[(row + dy) * vx + (col + dx)] < h) {
            isMin = false;
            break;
          }
        }
        if (isMin) minima.push({ col, row, h });
      }
    }

    // Sort by height (fill the lowest depressions first)
    minima.sort((a, b) => a.h - b.h);

    // Fill up to lakeCount depressions, spaced apart
    let filled = 0;
    const usedMinima = new Set<string>();
    for (const m of minima) {
      if (filled >= lakeCount) break;
      // Skip if too close to an already-used minimum (at least 10% of grid apart)
      const minDist = Math.max(vx, vy) * 0.1;
      let tooClose = false;
      for (const key of usedMinima) {
        const [uc, ur] = key.split(',').map(Number);
        const dist = Math.sqrt((m.col - uc) ** 2 + (m.row - ur) ** 2);
        if (dist < minDist) { tooClose = true; break; }
      }
      if (tooClose) continue;

      fillDepression(terrain, m.col, m.row, lakeMaxRise);
      usedMinima.add(`${m.col},${m.row}`);
      filled++;
    }
  }

  // 3. Trace rivers from high points
  if (riverCount > 0) {
    // Find high-elevation starting points spread around the grid
    // Use random samples from the top 20% of elevations
    const threshold = sorted[Math.floor(sorted.length * 0.80)];
    const candidates: { col: number; row: number }[] = [];
    for (let row = 2; row < vy - 2; row++) {
      for (let col = 2; col < vx - 2; col++) {
        if (heights[row * vx + col] >= threshold) {
          candidates.push({ col, row });
        }
      }
    }

    // Shuffle and pick riverCount starting points, spaced apart
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const riverStarts: { col: number; row: number }[] = [];
    const minRiverDist = Math.max(vx, vy) * 0.15;
    for (const c of candidates) {
      if (riverStarts.length >= riverCount) break;
      let tooClose = false;
      for (const s of riverStarts) {
        const dist = Math.sqrt((c.col - s.col) ** 2 + (c.row - s.row) ** 2);
        if (dist < minRiverDist) { tooClose = true; break; }
      }
      if (tooClose) continue;
      riverStarts.push(c);
    }

    for (const start of riverStarts) {
      traceRiver(terrain, start.col, start.row, riverWidth);
    }
  }
}

/**
 * Create hilly terrain with procedurally generated water bodies
 * (rivers, lakes, and flooded lowlands).
 *
 * @param config - Grid configuration
 * @param options - Height variation and water generation options
 *
 * @example
 * ```typescript
 * const terrain = createHillyWithWater(
 *   { originX: -5000, originY: -5000, cellsX: 400, cellsY: 400, cellSize: 25 },
 *   { amplitude: 30, riverCount: 3, lakeCount: 2 },
 * );
 * ```
 */
export function createHillyWithWater(config: TerrainConfig, options: {
  /** Base height offset applied everywhere (default 0). */
  baseHeight?: number;
  /** Peak amplitude of the tallest hills in world units (default 20). */
  amplitude?: number;
  /** Random seed for terrain generation (default 42). */
  seed?: number;
  /** Number of rivers to generate (default 3). */
  riverCount?: number;
  /** River half-width in grid cells (default 1). */
  riverWidth?: number;
  /** Number of lakes to attempt filling (default 2). */
  lakeCount?: number;
  /** Maximum rise for lake fill (default 8). */
  lakeMaxRise?: number;
} = {}): TerrainData {
  const { baseHeight, amplitude, seed, ...waterOpts } = options;
  const terrain = TerrainData.createHilly(config, { baseHeight, amplitude, seed });
  generateWater(terrain, { seed: seed ?? 42, ...waterOpts });
  return terrain;
}
