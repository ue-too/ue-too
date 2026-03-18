/**
 * Heightmap-based terrain data stored as a regular grid of vertex heights.
 *
 * The grid stores vertex heights (corners of cells), so a grid with `cellsX`
 * cells has `cellsX + 1` vertices along X. Heights are in world units (meters).
 *
 * @group Terrain
 */

/** Configuration for the terrain grid dimensions and placement. */
export type TerrainConfig = {
  /** World-space X origin (top-left corner of the grid). */
  originX: number;
  /** World-space Y origin (top-left corner of the grid). */
  originY: number;
  /** Number of cells along the X axis. Vertex count is cellsX + 1. */
  cellsX: number;
  /** Number of cells along the Y axis. Vertex count is cellsY + 1. */
  cellsY: number;
  /** World-space size of each cell in meters. */
  cellSize: number;
};

/** JSON-safe serialized terrain data. Heights are base64-encoded Float32Array. */
export type SerializedTerrainData = {
  config: TerrainConfig;
  /** Row-major Float32 heights, base64-encoded for compactness. */
  heightsBase64: string;
};

export class TerrainData {
  readonly config: TerrainConfig;
  /** Row-major vertex heights. Length = (cellsX+1) * (cellsY+1). */
  private _heights: Float32Array;

  /** Number of vertices along X. */
  get verticesX(): number {
    return this.config.cellsX + 1;
  }

  /** Number of vertices along Y. */
  get verticesY(): number {
    return this.config.cellsY + 1;
  }

  /** Direct access to the underlying height buffer. */
  get heights(): Float32Array {
    return this._heights;
  }

  /** World-space extent along X. */
  get worldWidth(): number {
    return this.config.cellsX * this.config.cellSize;
  }

  /** World-space extent along Y. */
  get worldHeight(): number {
    return this.config.cellsY * this.config.cellSize;
  }

  constructor(config: TerrainConfig, heights: Float32Array) {
    const expectedLength = (config.cellsX + 1) * (config.cellsY + 1);
    if (heights.length !== expectedLength) {
      throw new Error(
        `Height array length ${heights.length} does not match expected ${expectedLength} for ${config.cellsX + 1}x${config.cellsY + 1} vertices`,
      );
    }
    this.config = config;
    this._heights = heights;
  }

  /**
   * Create a flat terrain at the given height.
   *
   * @param config - Grid configuration
   * @param defaultHeight - Height value for all vertices (default 0)
   */
  static createFlat(config: TerrainConfig, defaultHeight = 0): TerrainData {
    const count = (config.cellsX + 1) * (config.cellsY + 1);
    const heights = new Float32Array(count);
    if (defaultHeight !== 0) {
      heights.fill(defaultHeight);
    }
    return new TerrainData(config, heights);
  }

  /** Get the height at a grid vertex. Returns 0 if out of bounds. */
  getHeightAtGrid(col: number, row: number): number {
    if (col < 0 || col >= this.verticesX || row < 0 || row >= this.verticesY) {
      return 0;
    }
    return this._heights[row * this.verticesX + col];
  }

  /** Set the height at a grid vertex. No-op if out of bounds. */
  setHeight(col: number, row: number, value: number): void {
    if (col < 0 || col >= this.verticesX || row < 0 || row >= this.verticesY) {
      return;
    }
    this._heights[row * this.verticesX + col] = value;
  }

  /**
   * Get the interpolated height at an arbitrary world position using bilinear interpolation.
   *
   * @param worldX - World-space X coordinate
   * @param worldY - World-space Y coordinate
   * @returns Interpolated height, or 0 if outside the grid bounds
   */
  getHeight(worldX: number, worldY: number): number {
    const { originX, originY, cellSize } = this.config;
    const gx = (worldX - originX) / cellSize;
    const gy = (worldY - originY) / cellSize;

    const col = Math.floor(gx);
    const row = Math.floor(gy);

    if (col < 0 || col >= this.config.cellsX || row < 0 || row >= this.config.cellsY) {
      return 0;
    }

    const fx = gx - col;
    const fy = gy - row;

    const h00 = this._heights[row * this.verticesX + col];
    const h10 = this._heights[row * this.verticesX + col + 1];
    const h01 = this._heights[(row + 1) * this.verticesX + col];
    const h11 = this._heights[(row + 1) * this.verticesX + col + 1];

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;

    return h0 * (1 - fy) + h1 * fy;
  }

  /** Encode terrain data to a JSON-safe object. */
  serialize(): SerializedTerrainData {
    const bytes = new Uint8Array(this._heights.buffer, this._heights.byteOffset, this._heights.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return {
      config: { ...this.config },
      heightsBase64: btoa(binary),
    };
  }

  /** Reconstruct terrain data from a serialized object. */
  static deserialize(data: SerializedTerrainData): TerrainData {
    const binary = atob(data.heightsBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const heights = new Float32Array(bytes.buffer);
    return new TerrainData(data.config, heights);
  }
}

/**
 * Validate that unknown data conforms to the {@link SerializedTerrainData} schema.
 */
export function validateSerializedTerrainData(
  data: unknown,
): { valid: true } | { valid: false; error: string } {
  if (data == null || typeof data !== 'object') {
    return { valid: false, error: 'Terrain data must be a non-null object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.heightsBase64 !== 'string') {
    return { valid: false, error: 'Missing or invalid "heightsBase64" string' };
  }
  if (obj.config == null || typeof obj.config !== 'object') {
    return { valid: false, error: 'Missing or invalid "config" object' };
  }
  const cfg = obj.config as Record<string, unknown>;
  for (const key of ['originX', 'originY', 'cellsX', 'cellsY', 'cellSize']) {
    if (typeof cfg[key] !== 'number') {
      return { valid: false, error: `config.${key} must be a number` };
    }
  }
  return { valid: true };
}
