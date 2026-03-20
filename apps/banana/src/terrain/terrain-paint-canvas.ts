/**
 * MS Paint-style terrain canvas for the terrain editor.
 *
 * Two layers:
 * 1. **Terrain layer** — discrete elevation colors (opaque).
 * 2. **Water layer** — discrete water-depth colors (semi-transparent where
 *    water exists, fully transparent where it doesn't).
 *
 * No per-vertex height computation during editing — heights and water surface
 * are derived on export by reverse-mapping pixel colors.
 *
 * @group Terrain
 */

import { sampleColorRamp, sampleWaterColor } from './terrain-colors';
import { TerrainData, type TerrainConfig } from './terrain-data';
import { ELEVATION_VALUES } from '@/trains/tracks/types';
import { LEVEL_HEIGHT } from '@/trains/tracks/constants';

// ---------------------------------------------------------------------------
// Terrain elevation palette
// ---------------------------------------------------------------------------

/** A discrete elevation level with its display color. */
export type PaletteEntry = {
  /** Elevation enum value (e.g. -3, -2, …, 3). */
  elevationValue: number;
  /** World-space height in meters (elevationValue × LEVEL_HEIGHT). */
  height: number;
  /** Display color RGB [0, 255]. */
  r: number;
  g: number;
  b: number;
  /** CSS color string for UI display. */
  css: string;
};

function buildPalette(): PaletteEntry[] {
  return ELEVATION_VALUES.map(ev => {
    const height = ev * LEVEL_HEIGHT;
    const color = sampleColorRamp(height);
    return {
      elevationValue: ev,
      height,
      r: color.r,
      g: color.g,
      b: color.b,
      css: `rgb(${color.r},${color.g},${color.b})`,
    };
  });
}

/** Discrete elevation palette derived from ELEVATION_VALUES × LEVEL_HEIGHT. */
export const TERRAIN_PALETTE: PaletteEntry[] = buildPalette();

/** Index of the ground-level (height = 0) palette entry. */
export const GROUND_PALETTE_INDEX: number = TERRAIN_PALETTE.findIndex(p => p.height === 0);

// ---------------------------------------------------------------------------
// Water depth palette
// ---------------------------------------------------------------------------

/** A discrete water depth level with its display color. */
export type WaterPaletteEntry = {
  /** Water depth in meters above the terrain surface. */
  depth: number;
  /** Display color RGBA [0, 255]. */
  r: number;
  g: number;
  b: number;
  a: number;
  /** CSS color string for UI display (opaque version for the swatch). */
  css: string;
};

/** Discrete water depths available in the editor. */
const WATER_DEPTHS = [3, 8, 15];

function buildWaterPalette(): WaterPaletteEntry[] {
  return WATER_DEPTHS.map(depth => {
    const color = sampleWaterColor(depth);
    return {
      depth,
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a,
      css: `rgb(${color.r},${color.g},${color.b})`,
    };
  });
}

/** Discrete water palette (shallow → deep). */
export const WATER_PALETTE: WaterPaletteEntry[] = buildWaterPalette();

// ---------------------------------------------------------------------------
// Paint canvas
// ---------------------------------------------------------------------------

/**
 * MS Paint-style terrain canvas with a separate water overlay.
 *
 * Each layer stores one pixel per grid vertex. Brush strokes paint a
 * discrete palette color directly — no height buffer, no color ramp
 * sampling, no normal computation, no hillshading during editing.
 */
export class TerrainPaintCanvas {
  /** Terrain elevation canvas (opaque). */
  readonly terrainCanvas: HTMLCanvasElement;
  /** Water overlay canvas (transparent where no water). */
  readonly waterCanvas: HTMLCanvasElement;

  readonly width: number;
  readonly height: number;

  private readonly _terrainCtx: CanvasRenderingContext2D;
  private readonly _terrainImageData: ImageData;
  private readonly _waterCtx: CanvasRenderingContext2D;
  private readonly _waterImageData: ImageData;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Terrain layer
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = width;
    this.terrainCanvas.height = height;
    this._terrainCtx = this.terrainCanvas.getContext('2d')!;
    this._terrainImageData = this._terrainCtx.createImageData(width, height);
    this.fillAllTerrain(GROUND_PALETTE_INDEX);

    // Water layer
    this.waterCanvas = document.createElement('canvas');
    this.waterCanvas.width = width;
    this.waterCanvas.height = height;
    this._waterCtx = this.waterCanvas.getContext('2d')!;
    this._waterImageData = this._waterCtx.createImageData(width, height);
    // Start fully transparent (no water)
    this._waterCtx.putImageData(this._waterImageData, 0, 0);
  }

  // ---- Terrain layer ----

  /** Fill the entire terrain canvas with a palette color. */
  fillAllTerrain(paletteIndex: number): void {
    const entry = TERRAIN_PALETTE[paletteIndex];
    if (!entry) return;
    const pixels = this._terrainImageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = entry.r;
      pixels[i + 1] = entry.g;
      pixels[i + 2] = entry.b;
      pixels[i + 3] = 255;
    }
    this._terrainCtx.putImageData(this._terrainImageData, 0, 0);
  }

  /** Paint a circular stamp on the terrain layer. */
  paintTerrain(cx: number, cy: number, radius: number, paletteIndex: number): void {
    const entry = TERRAIN_PALETTE[paletteIndex];
    if (!entry) return;
    this._stampCircle(this._terrainImageData, cx, cy, radius, entry.r, entry.g, entry.b, 255);
    this._uploadDirty(this._terrainCtx, this._terrainImageData, cx, cy, radius);
  }

  // ---- Water layer ----

  /** Paint a circular stamp on the water layer. */
  paintWater(cx: number, cy: number, radius: number, waterPaletteIndex: number): void {
    const entry = WATER_PALETTE[waterPaletteIndex];
    if (!entry) return;
    this._stampCircle(this._waterImageData, cx, cy, radius, entry.r, entry.g, entry.b, entry.a);
    this._uploadDirty(this._waterCtx, this._waterImageData, cx, cy, radius);
  }

  /** Erase water in a circular area (set to fully transparent). */
  eraseWater(cx: number, cy: number, radius: number): void {
    this._stampCircle(this._waterImageData, cx, cy, radius, 0, 0, 0, 0);
    this._uploadDirty(this._waterCtx, this._waterImageData, cx, cy, radius);
  }

  // ---- Export / Import ----

  /**
   * Export both layers to a TerrainData.
   *
   * Terrain pixels → nearest elevation palette height.
   * Water pixels → if alpha > 0, nearest water depth → water surface = height + depth.
   */
  exportToTerrainData(config: TerrainConfig): TerrainData {
    const tPixels = this._terrainImageData.data;
    const wPixels = this._waterImageData.data;
    const count = this.width * this.height;
    const heights = new Float32Array(count);
    const waterSurface = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const pi = i * 4;

      // Terrain height from pixel color
      const h = nearestPaletteHeight(tPixels[pi], tPixels[pi + 1], tPixels[pi + 2]);
      heights[i] = h;

      // Water from overlay alpha
      if (wPixels[pi + 3] > 0) {
        const depth = nearestWaterDepth(wPixels[pi], wPixels[pi + 1], wPixels[pi + 2]);
        waterSurface[i] = h + depth;
      } else {
        waterSurface[i] = NaN;
      }
    }

    return new TerrainData(config, heights, waterSurface);
  }

  /**
   * Import from a TerrainData: quantize heights to palette colors on the
   * terrain layer and paint water depths on the water layer.
   */
  importFromTerrainData(terrainData: TerrainData): void {
    const tPixels = this._terrainImageData.data;
    const wPixels = this._waterImageData.data;
    const heights = terrainData.heights;
    const water = terrainData.waterSurface;

    for (let i = 0; i < heights.length; i++) {
      const pi = i * 4;

      // Terrain
      const entry = nearestPaletteEntry(heights[i]);
      tPixels[pi] = entry.r;
      tPixels[pi + 1] = entry.g;
      tPixels[pi + 2] = entry.b;
      tPixels[pi + 3] = 255;

      // Water
      const w = water[i];
      if (!isNaN(w)) {
        const depth = Math.max(0, w - heights[i]);
        const wEntry = nearestWaterPaletteEntry(depth);
        wPixels[pi] = wEntry.r;
        wPixels[pi + 1] = wEntry.g;
        wPixels[pi + 2] = wEntry.b;
        wPixels[pi + 3] = wEntry.a;
      } else {
        wPixels[pi] = 0;
        wPixels[pi + 1] = 0;
        wPixels[pi + 2] = 0;
        wPixels[pi + 3] = 0;
      }
    }

    this._terrainCtx.putImageData(this._terrainImageData, 0, 0);
    this._waterCtx.putImageData(this._waterImageData, 0, 0);
  }

  // ---- Internal helpers ----

  /** Stamp a filled circle of a solid RGBA color into an ImageData buffer. */
  private _stampCircle(
    imageData: ImageData,
    cx: number, cy: number, radius: number,
    r: number, g: number, b: number, a: number,
  ): void {
    const pixels = imageData.data;
    const r2 = radius * radius;
    const colMin = Math.max(0, Math.floor(cx - radius));
    const colMax = Math.min(this.width - 1, Math.ceil(cx + radius));
    const rowMin = Math.max(0, Math.floor(cy - radius));
    const rowMax = Math.min(this.height - 1, Math.ceil(cy + radius));

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const dx = col - cx;
        const dy = row - cy;
        if (dx * dx + dy * dy <= r2) {
          const i = (row * this.width + col) * 4;
          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = a;
        }
      }
    }
  }

  /** Upload the dirty region around a circle stamp. */
  private _uploadDirty(
    ctx: CanvasRenderingContext2D,
    imageData: ImageData,
    cx: number, cy: number, radius: number,
  ): void {
    const colMin = Math.max(0, Math.floor(cx - radius));
    const colMax = Math.min(this.width - 1, Math.ceil(cx + radius));
    const rowMin = Math.max(0, Math.floor(cy - radius));
    const rowMax = Math.min(this.height - 1, Math.ceil(cy + radius));
    const dirtyW = colMax - colMin + 1;
    const dirtyH = rowMax - rowMin + 1;
    if (dirtyW > 0 && dirtyH > 0) {
      ctx.putImageData(imageData, 0, 0, colMin, rowMin, dirtyW, dirtyH);
    }
  }
}

// ---------------------------------------------------------------------------
// Palette lookup helpers
// ---------------------------------------------------------------------------

/** Find the palette entry whose height is closest to the given value. */
function nearestPaletteEntry(height: number): PaletteEntry {
  let best = TERRAIN_PALETTE[0];
  let bestDist = Math.abs(height - best.height);
  for (let i = 1; i < TERRAIN_PALETTE.length; i++) {
    const d = Math.abs(height - TERRAIN_PALETTE[i].height);
    if (d < bestDist) {
      bestDist = d;
      best = TERRAIN_PALETTE[i];
    }
  }
  return best;
}

/** Find the palette height whose RGB is closest to the given pixel color. */
function nearestPaletteHeight(r: number, g: number, b: number): number {
  let bestHeight = 0;
  let bestDist = Infinity;
  for (const entry of TERRAIN_PALETTE) {
    const dr = r - entry.r;
    const dg = g - entry.g;
    const db = b - entry.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestHeight = entry.height;
    }
  }
  return bestHeight;
}

/** Find the water palette entry whose depth is closest to the given value. */
function nearestWaterPaletteEntry(depth: number): WaterPaletteEntry {
  let best = WATER_PALETTE[0];
  let bestDist = Math.abs(depth - best.depth);
  for (let i = 1; i < WATER_PALETTE.length; i++) {
    const d = Math.abs(depth - WATER_PALETTE[i].depth);
    if (d < bestDist) {
      bestDist = d;
      best = WATER_PALETTE[i];
    }
  }
  return best;
}

/** Find the water depth whose RGB is closest to the given pixel color. */
function nearestWaterDepth(r: number, g: number, b: number): number {
  let bestDepth = WATER_PALETTE[0].depth;
  let bestDist = Infinity;
  for (const entry of WATER_PALETTE) {
    const dr = r - entry.r;
    const dg = g - entry.g;
    const db = b - entry.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestDepth = entry.depth;
    }
  }
  return bestDepth;
}
