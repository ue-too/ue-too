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
  { height: -20, color: { r: 45, g: 80, b: 50, a: 255 } },    // deep green (valley floor)
  { height: -10, color: { r: 65, g: 115, b: 65, a: 255 } },   // dark green
  { height: -3, color: { r: 80, g: 140, b: 80, a: 255 } },    // green
  { height: 0, color: { r: 100, g: 160, b: 90, a: 255 } },     // green (ground level)
  { height: 3, color: { r: 140, g: 175, b: 90, a: 255 } },     // yellow-green
  { height: 8, color: { r: 180, g: 185, b: 100, a: 255 } },    // light olive
  { height: 15, color: { r: 195, g: 170, b: 105, a: 255 } },   // tan
  { height: 20, color: { r: 165, g: 130, b: 85, a: 255 } },    // brown
  { height: 30, color: { r: 140, g: 105, b: 75, a: 255 } },    // dark brown
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
