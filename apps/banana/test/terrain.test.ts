import { TerrainData, validateSerializedTerrainData } from '../src/terrain/terrain-data';
import { extractContourSegments } from '../src/terrain/contour';
import { sampleColorRamp, sampleWaterColor, hillshade, computeNormal } from '../src/terrain/terrain-colors';
import { floodBelow, traceRiver, fillDepression, generateWater, createHillyWithWater } from '../src/terrain/terrain-water';

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

  it('should throw if water surface array has wrong length', () => {
    const heights = new Float32Array(25);
    const water = new Float32Array(10);
    expect(() => new TerrainData(config, heights, water)).toThrow();
  });

  describe('water surface', () => {
    it('should initialize water surface to all NaN by default', () => {
      const terrain = TerrainData.createFlat(config, 0);
      for (let i = 0; i < terrain.waterSurface.length; i++) {
        expect(isNaN(terrain.waterSurface[i])).toBe(true);
      }
    });

    it('should set and get water surface at grid vertices', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setWaterSurface(2, 3, 5);
      expect(terrain.getWaterSurfaceAtGrid(2, 3)).toBe(5);
      expect(isNaN(terrain.getWaterSurfaceAtGrid(0, 0))).toBe(true);
    });

    it('should return NaN for out-of-bounds water queries', () => {
      const terrain = TerrainData.createFlat(config, 0);
      expect(isNaN(terrain.getWaterSurfaceAtGrid(-1, 0))).toBe(true);
      expect(isNaN(terrain.getWaterSurfaceAtGrid(0, 5))).toBe(true);
    });

    it('hasWater should return false for NaN and true for finite values', () => {
      const terrain = TerrainData.createFlat(config, 0);
      expect(terrain.hasWater(0, 0)).toBe(false);
      terrain.setWaterSurface(0, 0, 3);
      expect(terrain.hasWater(0, 0)).toBe(true);
    });

    it('hasWater should return false for out-of-bounds', () => {
      const terrain = TerrainData.createFlat(config, 0);
      expect(terrain.hasWater(-1, 0)).toBe(false);
      expect(terrain.hasWater(5, 5)).toBe(false);
    });

    it('should no-op for out-of-bounds setWaterSurface', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setWaterSurface(-1, 0, 5);
      terrain.setWaterSurface(0, 5, 5);
      // No crash, water remains all NaN
      expect(terrain.hasWater(0, 0)).toBe(false);
    });
  });

  describe('water depth', () => {
    it('should return 0 when no water', () => {
      const terrain = TerrainData.createFlat(config, 5);
      expect(terrain.getWaterDepth(5, 5)).toBe(0);
    });

    it('should return surface minus terrain height', () => {
      const terrain = TerrainData.createFlat(config, 0);
      // Set water surface at 10m across a cell
      terrain.setWaterSurface(0, 0, 10);
      terrain.setWaterSurface(1, 0, 10);
      terrain.setWaterSurface(0, 1, 10);
      terrain.setWaterSurface(1, 1, 10);
      // Terrain is at 0, water at 10 → depth = 10
      expect(terrain.getWaterDepth(0, 0)).toBe(10);
    });

    it('should return 0 when terrain is above water surface', () => {
      const terrain = TerrainData.createFlat(config, 20);
      terrain.setWaterSurface(0, 0, 5);
      terrain.setWaterSurface(1, 0, 5);
      terrain.setWaterSurface(0, 1, 5);
      terrain.setWaterSurface(1, 1, 5);
      expect(terrain.getWaterDepth(0, 0)).toBe(0);
    });
  });

  describe('water surface interpolation', () => {
    it('should interpolate between vertices with water', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setWaterSurface(0, 0, 0);
      terrain.setWaterSurface(1, 0, 10);
      terrain.setWaterSurface(0, 1, 0);
      terrain.setWaterSurface(1, 1, 10);
      // Midpoint along X: (5, 0) → surface should be 5
      expect(terrain.getWaterSurfaceAt(5, 0)).toBe(5);
    });

    it('should return NaN when any contributing vertex has no water', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setWaterSurface(0, 0, 5);
      // Only one corner has water, rest are NaN
      expect(isNaN(terrain.getWaterSurfaceAt(0, 0))).toBe(true);
    });

    it('should return NaN outside grid bounds', () => {
      const terrain = TerrainData.createFlat(config, 0);
      expect(isNaN(terrain.getWaterSurfaceAt(-5, 0))).toBe(true);
      expect(isNaN(terrain.getWaterSurfaceAt(50, 0))).toBe(true);
    });
  });

  describe('serialization with water', () => {
    it('should round-trip water surface through serialize/deserialize', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setWaterSurface(1, 1, 5);
      terrain.setWaterSurface(2, 3, 12.5);

      const serialized = terrain.serialize();
      expect(serialized.waterSurfaceBase64).toBeDefined();

      const restored = TerrainData.deserialize(serialized);
      expect(restored.getWaterSurfaceAtGrid(1, 1)).toBe(5);
      expect(restored.getWaterSurfaceAtGrid(2, 3)).toBe(12.5);
      expect(isNaN(restored.getWaterSurfaceAtGrid(0, 0))).toBe(true);
    });

    it('should omit waterSurfaceBase64 when no water exists', () => {
      const terrain = TerrainData.createFlat(config, 0);
      const serialized = terrain.serialize();
      expect(serialized.waterSurfaceBase64).toBeUndefined();
    });

    it('should deserialize old format without water (backward compat)', () => {
      const terrain = TerrainData.createFlat(config, 0);
      const serialized = terrain.serialize();
      // Simulate old format by removing the field
      delete serialized.waterSurfaceBase64;
      const restored = TerrainData.deserialize(serialized);
      for (let i = 0; i < restored.waterSurface.length; i++) {
        expect(isNaN(restored.waterSurface[i])).toBe(true);
      }
    });
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

  it('should accept data with waterSurfaceBase64', () => {
    const terrain = TerrainData.createFlat(
      { originX: 0, originY: 0, cellsX: 2, cellsY: 2, cellSize: 1 },
      0,
    );
    terrain.setWaterSurface(0, 0, 5);
    const result = validateSerializedTerrainData(terrain.serialize());
    expect(result.valid).toBe(true);
  });

  it('should reject non-string waterSurfaceBase64', () => {
    const terrain = TerrainData.createFlat(
      { originX: 0, originY: 0, cellsX: 2, cellsY: 2, cellSize: 1 },
      0,
    );
    const serialized = terrain.serialize() as Record<string, unknown>;
    serialized.waterSurfaceBase64 = 123;
    const result = validateSerializedTerrainData(serialized);
    expect(result.valid).toBe(false);
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

  describe('sampleWaterColor', () => {
    it('should return valid RGBA with alpha < 255 for shallow water', () => {
      const color = sampleWaterColor(0);
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.a).toBeLessThan(255);
      expect(color.a).toBeGreaterThan(0);
    });

    it('should return increasingly opaque colors for deeper water', () => {
      const shallow = sampleWaterColor(0);
      const deep = sampleWaterColor(15);
      expect(deep.a).toBeGreaterThan(shallow.a);
    });

    it('should clamp at the deepest stop', () => {
      const deep = sampleWaterColor(15);
      const veryDeep = sampleWaterColor(100);
      expect(veryDeep.r).toBe(deep.r);
      expect(veryDeep.g).toBe(deep.g);
      expect(veryDeep.b).toBe(deep.b);
      expect(veryDeep.a).toBe(deep.a);
    });

    it('should clamp negative depth to 0', () => {
      const zero = sampleWaterColor(0);
      const negative = sampleWaterColor(-5);
      expect(negative.r).toBe(zero.r);
      expect(negative.g).toBe(zero.g);
      expect(negative.b).toBe(zero.b);
      expect(negative.a).toBe(zero.a);
    });
  });
});

describe('terrain-water', () => {
  const config = { originX: 0, originY: 0, cellsX: 20, cellsY: 20, cellSize: 10 };

  describe('floodBelow', () => {
    it('should set water surface for vertices below the flood level', () => {
      const terrain = TerrainData.createFlat(config, -5);
      floodBelow(terrain, 0);
      // All vertices are at -5, below flood level 0
      for (let i = 0; i < terrain.waterSurface.length; i++) {
        expect(terrain.waterSurface[i]).toBe(0);
      }
    });

    it('should not set water for vertices at or above the flood level', () => {
      const terrain = TerrainData.createFlat(config, 5);
      floodBelow(terrain, 0);
      for (let i = 0; i < terrain.waterSurface.length; i++) {
        expect(isNaN(terrain.waterSurface[i])).toBe(true);
      }
    });

    it('should only flood vertices that are below the level', () => {
      const terrain = TerrainData.createFlat(config, 0);
      terrain.setHeight(5, 5, -10);
      terrain.setHeight(6, 5, -3);
      floodBelow(terrain, 0);
      expect(terrain.waterSurface[5 * 21 + 5]).toBe(0);
      expect(terrain.waterSurface[5 * 21 + 6]).toBe(0);
      expect(isNaN(terrain.waterSurface[0])).toBe(true);
    });
  });

  describe('traceRiver', () => {
    it('should create a path of water from start downhill', () => {
      // Create a slope: height decreases along X
      const terrain = TerrainData.createFlat(config, 0);
      for (let row = 0; row <= 20; row++) {
        for (let col = 0; col <= 20; col++) {
          terrain.setHeight(col, row, 20 - col);
        }
      }
      traceRiver(terrain, 5, 10, 0);
      // River should have created water from col 5 downhill to col 20
      let waterCount = 0;
      for (let i = 0; i < terrain.waterSurface.length; i++) {
        if (!isNaN(terrain.waterSurface[i])) waterCount++;
      }
      expect(waterCount).toBeGreaterThan(5);
    });

    it('should stop at the grid edge', () => {
      const terrain = TerrainData.createFlat(config, 0);
      for (let row = 0; row <= 20; row++) {
        for (let col = 0; col <= 20; col++) {
          terrain.setHeight(col, row, 20 - col);
        }
      }
      // Should not throw even when river reaches edge
      traceRiver(terrain, 5, 10, 0);
    });
  });

  describe('fillDepression', () => {
    it('should fill a basin with water up to the spill level', () => {
      // Create a bowl: center is low, edges are high
      const terrain = TerrainData.createFlat(config, 10);
      // Dig a depression at center
      terrain.setHeight(10, 10, 0);
      terrain.setHeight(9, 10, 2);
      terrain.setHeight(11, 10, 2);
      terrain.setHeight(10, 9, 2);
      terrain.setHeight(10, 11, 2);

      const level = fillDepression(terrain, 10, 10, 15);
      expect(level).toBeGreaterThan(0);
      // The center should have water
      expect(terrain.hasWater(10, 10)).toBe(true);
    });

    it('should return NaN for out-of-bounds seed', () => {
      const terrain = TerrainData.createFlat(config, 0);
      expect(isNaN(fillDepression(terrain, -1, 0))).toBe(true);
    });
  });

  describe('generateWater', () => {
    it('should populate water on hilly terrain', () => {
      const terrain = TerrainData.createHilly(config, { amplitude: 20, seed: 42 });
      generateWater(terrain, { riverCount: 2, lakeCount: 1 });
      let waterCount = 0;
      for (let i = 0; i < terrain.waterSurface.length; i++) {
        if (!isNaN(terrain.waterSurface[i])) waterCount++;
      }
      expect(waterCount).toBeGreaterThan(0);
    });

    it('should be reproducible with the same seed', () => {
      const t1 = TerrainData.createHilly(config, { amplitude: 20, seed: 42 });
      generateWater(t1, { seed: 7 });
      const t2 = TerrainData.createHilly(config, { amplitude: 20, seed: 42 });
      generateWater(t2, { seed: 7 });
      for (let i = 0; i < t1.waterSurface.length; i++) {
        const w1 = t1.waterSurface[i];
        const w2 = t2.waterSurface[i];
        if (isNaN(w1)) {
          expect(isNaN(w2)).toBe(true);
        } else {
          expect(w2).toBe(w1);
        }
      }
    });
  });

  describe('createHillyWithWater', () => {
    it('should create terrain with both heights and water', () => {
      const terrain = createHillyWithWater(config, { amplitude: 20, seed: 42 });
      // Should have varied heights
      let minH = Infinity, maxH = -Infinity;
      for (let i = 0; i < terrain.heights.length; i++) {
        if (terrain.heights[i] < minH) minH = terrain.heights[i];
        if (terrain.heights[i] > maxH) maxH = terrain.heights[i];
      }
      expect(maxH - minH).toBeGreaterThan(1);

      // Should have some water
      let waterCount = 0;
      for (let i = 0; i < terrain.waterSurface.length; i++) {
        if (!isNaN(terrain.waterSurface[i])) waterCount++;
      }
      expect(waterCount).toBeGreaterThan(0);
    });
  });
});
