/**
 * Hypsometric color ramp and hillshading utilities for terrain rendering.
 *
 * @group Terrain
 */

/** An RGBA color with components in [0, 255]. */
export type RGBA = { r: number; g: number; b: number; a: number };

/**
 * Color stops for hypsometric tinting. Heights are in world units (meters).
 * The ramp transitions smoothly between stops via linear interpolation.
 */
export const COLOR_STOPS: { height: number; color: RGBA }[] = [
  { height: -20, color: { r: 75, g: 95, b: 78, a: 255 } },     // muted deep green (valley floor)
  { height: -10, color: { r: 95, g: 120, b: 95, a: 255 } },    // muted dark green
  { height: -3, color: { r: 115, g: 140, b: 110, a: 255 } },   // muted sage
  { height: 0, color: { r: 135, g: 155, b: 120, a: 255 } },    // soft sage (ground level)
  { height: 3, color: { r: 155, g: 165, b: 125, a: 255 } },    // muted yellow-green
  { height: 8, color: { r: 175, g: 175, b: 140, a: 255 } },    // soft khaki
  { height: 15, color: { r: 185, g: 170, b: 140, a: 255 } },   // muted tan
  { height: 20, color: { r: 165, g: 145, b: 120, a: 255 } },   // soft brown
  { height: 30, color: { r: 145, g: 125, b: 110, a: 255 } },   // muted dark brown
];

/**
 * Color stops for water depth tinting. Depth is in world units (meters).
 * Shallow water is lighter and more transparent; deep water is darker and opaque.
 */
export const WATER_COLOR_STOPS: { depth: number; color: RGBA }[] = [
  { depth: 0, color: { r: 140, g: 200, b: 230, a: 160 } },   // shallow: light blue, semi-transparent
  { depth: 5, color: { r: 70, g: 130, b: 190, a: 200 } },     // medium
  { depth: 15, color: { r: 30, g: 60, b: 120, a: 230 } },     // deep: dark blue, nearly opaque
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Sample the hypsometric color ramp at a given height.
 *
 * @param height - Terrain height in world units (meters)
 * @returns RGBA color
 */
export function sampleColorRamp(height: number): RGBA {
  if (COLOR_STOPS.length === 0) {
    return { r: 128, g: 128, b: 128, a: 255 };
  }
  if (height <= COLOR_STOPS[0].height) {
    return { ...COLOR_STOPS[0].color };
  }
  if (height >= COLOR_STOPS[COLOR_STOPS.length - 1].height) {
    return { ...COLOR_STOPS[COLOR_STOPS.length - 1].color };
  }

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i];
    const b = COLOR_STOPS[i + 1];
    if (height >= a.height && height <= b.height) {
      const t = (height - a.height) / (b.height - a.height);
      return {
        r: Math.round(lerp(a.color.r, b.color.r, t)),
        g: Math.round(lerp(a.color.g, b.color.g, t)),
        b: Math.round(lerp(a.color.b, b.color.b, t)),
        a: 255,
      };
    }
  }
  return { ...COLOR_STOPS[COLOR_STOPS.length - 1].color };
}

/**
 * Sample the water color ramp at a given depth.
 *
 * @param depth - Water depth in world units (meters), clamped to >= 0
 * @returns RGBA color with depth-dependent alpha
 */
export function sampleWaterColor(depth: number): RGBA {
  const d = Math.max(0, depth);
  if (WATER_COLOR_STOPS.length === 0) {
    return { r: 100, g: 150, b: 200, a: 180 };
  }
  if (d <= WATER_COLOR_STOPS[0].depth) {
    return { ...WATER_COLOR_STOPS[0].color };
  }
  if (d >= WATER_COLOR_STOPS[WATER_COLOR_STOPS.length - 1].depth) {
    return { ...WATER_COLOR_STOPS[WATER_COLOR_STOPS.length - 1].color };
  }

  for (let i = 0; i < WATER_COLOR_STOPS.length - 1; i++) {
    const a = WATER_COLOR_STOPS[i];
    const b = WATER_COLOR_STOPS[i + 1];
    if (d >= a.depth && d <= b.depth) {
      const t = (d - a.depth) / (b.depth - a.depth);
      return {
        r: Math.round(lerp(a.color.r, b.color.r, t)),
        g: Math.round(lerp(a.color.g, b.color.g, t)),
        b: Math.round(lerp(a.color.b, b.color.b, t)),
        a: Math.round(lerp(a.color.a, b.color.a, t)),
      };
    }
  }
  return { ...WATER_COLOR_STOPS[WATER_COLOR_STOPS.length - 1].color };
}

/**
 * Compute a hillshade factor for a surface normal given a fixed light direction.
 *
 * The light comes from the upper-left at a 45° elevation angle, which is the
 * cartographic convention for terrain shading.
 *
 * @param nx - Surface normal X component
 * @param ny - Surface normal Y component
 * @param nz - Surface normal Z component (up)
 * @returns Shade factor in [0.3, 1.0] where 1.0 is fully lit
 */
export function hillshade(nx: number, ny: number, nz: number): number {
  // Light direction: upper-left at 45° elevation (azimuth 315°, altitude 45°)
  const lx = -0.5;
  const ly = -0.5;
  const lz = 0.7071;

  // Normalize surface normal
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-8) return 0.65;
  const invLen = 1 / len;

  const dot = (nx * invLen) * lx + (ny * invLen) * ly + (nz * invLen) * lz;
  // Map from [-1, 1] to [0.3, 1.0] — never fully black
  return 0.3 + 0.7 * Math.max(0, dot);
}

/**
 * Compute the surface normal at a grid vertex from its 4 neighbors using central differences.
 *
 * @param heights - Flat height array (row-major)
 * @param col - Column index
 * @param row - Row index
 * @param verticesX - Number of vertices per row
 * @param verticesY - Number of vertices per column
 * @param cellSize - World-space cell size
 * @returns Surface normal [nx, ny, nz] (not normalized)
 */
export function computeNormal(
  heights: Float32Array,
  col: number,
  row: number,
  verticesX: number,
  verticesY: number,
  cellSize: number,
): [number, number, number] {
  const left = col > 0 ? heights[row * verticesX + (col - 1)] : heights[row * verticesX + col];
  const right = col < verticesX - 1 ? heights[row * verticesX + (col + 1)] : heights[row * verticesX + col];
  const up = row > 0 ? heights[(row - 1) * verticesX + col] : heights[row * verticesX + col];
  const down = row < verticesY - 1 ? heights[(row + 1) * verticesX + col] : heights[row * verticesX + col];

  // Central difference: dh/dx and dh/dy
  const dx = (right - left) / (2 * cellSize);
  const dy = (down - up) / (2 * cellSize);

  // Surface normal from height field: (-dh/dx, -dh/dy, 1)
  return [-dx, -dy, 1];
}
