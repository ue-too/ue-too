import { TerrainData, validateSerializedTerrainData } from '../src/terrain/terrain-data';
import { extractContourSegments } from '../src/terrain/contour';
import { sampleColorRamp, hillshade, computeNormal } from '../src/terrain/terrain-colors';

describe('TerrainData', () => {
  const config = { originX: 0, originY: 0, cellsX: 4, cellsY: 4, cellSize: 10 };

  it('should create a flat terrain with correct dimensions', () => {
    const terrain = TerrainData.createFlat(config, 5);
    expect(terrain.verticesX).toBe(5);
    expect(terrain.verticesY).toBe(5);
    expect(terrain.worldWidth).toBe(40);
    expect(terrain.worldHeight).toBe(40);
    expect(terrain.heights.length).toBe(25);
    expect(terrain.getHeightAtGrid(0, 0)).toBe(5);
    expect(terrain.getHeightAtGrid(4, 4)).toBe(5);
  });

  it('should set and get individual vertex heights', () => {
    const terrain = TerrainData.createFlat(config, 0);
    terrain.setHeight(2, 3, 15);
    expect(terrain.getHeightAtGrid(2, 3)).toBe(15);
    expect(terrain.getHeightAtGrid(0, 0)).toBe(0);
  });

  it('should return 0 for out-of-bounds grid access', () => {
    const terrain = TerrainData.createFlat(config, 10);
    expect(terrain.getHeightAtGrid(-1, 0)).toBe(0);
    expect(terrain.getHeightAtGrid(0, -1)).toBe(0);
    expect(terrain.getHeightAtGrid(5, 0)).toBe(0);
    expect(terrain.getHeightAtGrid(0, 5)).toBe(0);
  });

  it('should no-op for out-of-bounds setHeight', () => {
    const terrain = TerrainData.createFlat(config, 0);
    terrain.setHeight(-1, 0, 99);
    terrain.setHeight(0, 5, 99);
    expect(terrain.getHeightAtGrid(0, 0)).toBe(0);
  });

  describe('bilinear interpolation', () => {
    it('should return exact values at grid vertices', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setHeight(1, 1, 20);
      // World position (10, 10) maps to grid vertex (1, 1)
      expect(terrain.getHeight(10, 10)).toBe(20);
    });

    it('should interpolate between vertices', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setHeight(0, 0, 0);
      terrain.setHeight(1, 0, 10);
      terrain.setHeight(0, 1, 0);
      terrain.setHeight(1, 1, 10);
      // Midpoint along X at row 0: (5, 0) should be 5
      expect(terrain.getHeight(5, 0)).toBe(5);
    });

    it('should return 0 outside grid bounds', () => {
      const terrain = TerrainData.createFlat(config, 10);
      expect(terrain.getHeight(-5, 0)).toBe(0);
      expect(terrain.getHeight(50, 0)).toBe(0);
      expect(terrain.getHeight(0, -5)).toBe(0);
      expect(terrain.getHeight(0, 50)).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should round-trip through serialize/deserialize', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setHeight(0, 0, 10);
      terrain.setHeight(2, 3, 25.5);
      terrain.setHeight(4, 4, -5);

      const serialized = terrain.serialize();
      const restored = TerrainData.deserialize(serialized);

      expect(restored.config).toEqual(config);
      expect(restored.verticesX).toBe(5);
      expect(restored.verticesY).toBe(5);
      expect(restored.getHeightAtGrid(0, 0)).toBe(10);
      expect(restored.getHeightAtGrid(2, 3)).toBe(25.5);
      expect(restored.getHeightAtGrid(4, 4)).toBe(-5);
      expect(restored.getHeightAtGrid(1, 1)).toBe(0);
    });

    it('should produce a string heightsBase64 field', () => {
      const terrain = TerrainData.createFlat(config, 0);
      const serialized = terrain.serialize();
      expect(typeof serialized.heightsBase64).toBe('string');
      expect(serialized.heightsBase64.length).toBeGreaterThan(0);
    });
  });

  it('should throw if heights array has wrong length', () => {
    expect(() => new TerrainData(config, new Float32Array(10))).toThrow();
  });
});

describe('validateSerializedTerrainData', () => {
  it('should accept valid data', () => {
    const terrain = TerrainData.createFlat(
      { originX: 0, originY: 0, cellsX: 2, cellsY: 2, cellSize: 1 },
      0,
    );
    const result = validateSerializedTerrainData(terrain.serialize());
    expect(result.valid).toBe(true);
  });

  it('should reject null', () => {
    expect(validateSerializedTerrainData(null).valid).toBe(false);
  });

  it('should reject missing config', () => {
    expect(validateSerializedTerrainData({ heightsBase64: 'abc' }).valid).toBe(false);
  });

  it('should reject missing heightsBase64', () => {
    expect(
      validateSerializedTerrainData({
        config: { originX: 0, originY: 0, cellsX: 2, cellsY: 2, cellSize: 1 },
      }).valid,
    ).toBe(false);
  });
});

describe('extractContourSegments', () => {
  it('should return no segments for completely flat terrain', () => {
    const terrain = TerrainData.createFlat(
      { originX: 0, originY: 0, cellsX: 4, cellsY: 4, cellSize: 10 },
      5,
    );
    // Contour at exactly height 5: all corners are equal, not > threshold
    const segments = extractContourSegments(terrain, 5);
    expect(segments.length).toBe(0);
  });

  it('should return segments when contour crosses cells', () => {
    const terrain = TerrainData.createFlat(
      { originX: 0, originY: 0, cellsX: 2, cellsY: 2, cellSize: 10 },
      0,
    );
    // Create a peak at center vertex
    terrain.setHeight(1, 1, 20);
    const segments = extractContourSegments(terrain, 10);
    expect(segments.length).toBeGreaterThan(0);
    // All segment endpoints should be within the grid bounds
    for (const seg of segments) {
      expect(seg.a.x).toBeGreaterThanOrEqual(0);
      expect(seg.a.x).toBeLessThanOrEqual(20);
      expect(seg.a.y).toBeGreaterThanOrEqual(0);
      expect(seg.a.y).toBeLessThanOrEqual(20);
    }
  });

  it('should return no segments when contour is above all heights', () => {
    const terrain = TerrainData.createFlat(
      { originX: 0, originY: 0, cellsX: 2, cellsY: 2, cellSize: 10 },
      5,
    );
    const segments = extractContourSegments(terrain, 100);
    expect(segments.length).toBe(0);
  });
});

describe('terrain-colors', () => {
  it('sampleColorRamp should return valid RGBA', () => {
    const color = sampleColorRamp(0);
    expect(color.r).toBeGreaterThanOrEqual(0);
    expect(color.r).toBeLessThanOrEqual(255);
    expect(color.a).toBe(255);
  });

  it('sampleColorRamp should vary with height', () => {
    const low = sampleColorRamp(0);
    const high = sampleColorRamp(30);
    // Colors at different heights should differ
    expect(low.r !== high.r || low.g !== high.g || low.b !== high.b).toBe(true);
  });

  it('hillshade should return value in [0.3, 1.0]', () => {
    const shade = hillshade(0, 0, 1); // flat surface pointing up
    expect(shade).toBeGreaterThanOrEqual(0.3);
    expect(shade).toBeLessThanOrEqual(1.0);
  });

  it('computeNormal should return upward normal for flat terrain', () => {
    // 3x3 grid, all at height 0
    const heights = new Float32Array(9);
    const [nx, ny, nz] = computeNormal(heights, 1, 1, 3, 3, 10);
    expect(nx).toBeCloseTo(0);
    expect(ny).toBeCloseTo(0);
    expect(nz).toBeCloseTo(1);
  });

  it('computeNormal should detect slopes', () => {
    // 3x3 grid with slope along X
    const heights = new Float32Array([0, 5, 10, 0, 5, 10, 0, 5, 10]);
    const [nx, _ny, _nz] = computeNormal(heights, 1, 1, 3, 3, 10);
    // Normal should point against the slope (negative X)
    expect(nx).toBeLessThan(0);
  });
});
