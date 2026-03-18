/**
 * PixiJS render system for terrain heightmap visualization.
 *
 * Renders three layers:
 * 1. **Base terrain** — A colored mesh with hypsometric tinting and hillshading,
 *    placed below all elevation bands.
 * 2. **Contour lines** — Graphics overlay showing elevation contour lines on
 *    top of the base terrain.
 * 3. **Per-band occlusion meshes** — Opaque terrain fills inserted between
 *    elevation bands to hide tracks that are below the terrain surface
 *    (creating tunnel/viaduct/subway effects).
 *
 * @group Terrain
 */

import { Container, Graphics, MeshSimple, Texture } from 'pixi.js';
import type { WorldRenderSystem } from '@/world-render-system';
import type { TerrainData } from './terrain-data';
import { sampleColorRamp, hillshade, computeNormal } from './terrain-colors';
import { extractContourSegments } from './contour';
import { ELEVATION_VALUES } from '@/trains/tracks/types';
import { LEVEL_HEIGHT } from '@/trains/tracks/constants';

/** Contour line interval in world units (meters). */
const CONTOUR_MINOR_INTERVAL = 5;
/** Major contour lines are drawn every N minor intervals. */
const CONTOUR_MAJOR_EVERY = 2;

/**
 * Manages PixiJS rendering of terrain heightmap data within the WorldRenderSystem.
 */
export class TerrainRenderSystem {
  private _worldRenderSystem: WorldRenderSystem;
  private _terrainData: TerrainData;
  private _renderer: { renderer: { textureGenerator?: { generateTexture: (options: { target: Graphics; resolution: number }) => Texture } } } | null;

  /** Base terrain mesh (hypsometric color + hillshade). */
  private _baseMesh: MeshSimple | null = null;
  /** Contour line graphics overlay. */
  private _contourGraphics: Graphics | null = null;
  /** Per-band occlusion meshes. */
  private _occlusionMeshes: (MeshSimple | null)[] = [];

  /** Whether terrain visuals need rebuilding. */
  private _dirty = true;

  constructor(
    worldRenderSystem: WorldRenderSystem,
    terrainData: TerrainData,
    textureRenderer?: { renderer: { textureGenerator?: { generateTexture: (options: { target: Graphics; resolution: number }) => Texture } } },
  ) {
    this._worldRenderSystem = worldRenderSystem;
    this._terrainData = terrainData;
    this._renderer = textureRenderer ?? null;
    this.rebuild();
  }

  /** Get the associated terrain data. */
  get terrainData(): TerrainData {
    return this._terrainData;
  }

  /** Mark terrain for rebuild on next call to {@link rebuild}. */
  markDirty(): void {
    this._dirty = true;
  }

  /** Replace the terrain data and trigger a full rebuild. */
  setTerrainData(terrainData: TerrainData): void {
    this._terrainData = terrainData;
    this._dirty = true;
    this.rebuild();
  }

  /**
   * Rebuild all terrain visuals from the current heightmap data.
   * Only rebuilds if dirty flag is set, unless `force` is true.
   */
  rebuild(force = false): void {
    if (!this._dirty && !force) return;
    this._dirty = false;

    this._destroyVisuals();
    this._buildBaseMesh();
    this._buildContourLines();
    this._buildOcclusionMeshes();
  }

  private _destroyVisuals(): void {
    const baseContainer = this._worldRenderSystem.terrainBaseContainer;

    if (this._baseMesh) {
      baseContainer.removeChild(this._baseMesh);
      this._baseMesh.destroy();
      this._baseMesh = null;
    }
    if (this._contourGraphics) {
      baseContainer.removeChild(this._contourGraphics);
      this._contourGraphics.destroy();
      this._contourGraphics = null;
    }
    for (let i = 0; i < this._occlusionMeshes.length; i++) {
      const mesh = this._occlusionMeshes[i];
      if (mesh) {
        const oc = this._worldRenderSystem.getTerrainOcclusionContainer(i);
        if (oc) oc.removeChild(mesh);
        mesh.destroy();
      }
    }
    this._occlusionMeshes = [];
  }

  // ---------------------------------------------------------------------------
  // Base terrain mesh
  // ---------------------------------------------------------------------------

  private _buildBaseMesh(): void {
    const td = this._terrainData;
    const { cellSize, originX, originY } = td.config;
    const vx = td.verticesX;
    const vy = td.verticesY;
    const heights = td.heights;

    // Build vertex positions, UVs, and vertex colors
    const vertCount = vx * vy;
    const positions = new Float32Array(vertCount * 2);
    const uvs = new Float32Array(vertCount * 2);

    // We'll bake color + hillshade into a per-pixel texture via ImageData,
    // but for simplicity we use a white texture and tint via vertex colors.
    // PixiJS MeshSimple doesn't support per-vertex colors directly,
    // so we generate a texture from the heightmap.

    const texWidth = vx;
    const texHeight = vy;
    const pixelData = new Uint8Array(texWidth * texHeight * 4);

    for (let row = 0; row < vy; row++) {
      for (let col = 0; col < vx; col++) {
        const idx = row * vx + col;
        const h = heights[idx];

        // Vertex positions in world space
        positions[idx * 2] = originX + col * cellSize;
        positions[idx * 2 + 1] = originY + row * cellSize;

        // UVs map vertex to texture pixel center
        uvs[idx * 2] = (col + 0.5) / texWidth;
        uvs[idx * 2 + 1] = (row + 0.5) / texHeight;

        // Compute color with hillshading
        const color = sampleColorRamp(h);
        const [nx, ny, nz] = computeNormal(heights, col, row, vx, vy, cellSize);
        const shade = hillshade(nx, ny, nz);

        const pi = idx * 4;
        pixelData[pi] = Math.round(color.r * shade);
        pixelData[pi + 1] = Math.round(color.g * shade);
        pixelData[pi + 2] = Math.round(color.b * shade);
        pixelData[pi + 3] = 255;
      }
    }

    // Build triangle indices (two triangles per cell)
    const cellCount = td.config.cellsX * td.config.cellsY;
    const indices = new Uint32Array(cellCount * 6);
    let ii = 0;
    for (let row = 0; row < td.config.cellsY; row++) {
      for (let col = 0; col < td.config.cellsX; col++) {
        const tl = row * vx + col;
        const tr = tl + 1;
        const bl = (row + 1) * vx + col;
        const br = bl + 1;
        indices[ii++] = tl;
        indices[ii++] = tr;
        indices[ii++] = bl;
        indices[ii++] = tr;
        indices[ii++] = br;
        indices[ii++] = bl;
      }
    }

    // Create texture from pixel data
    const texture = Texture.from({
      resource: new Uint8Array(pixelData),
      width: texWidth,
      height: texHeight,
    });

    this._baseMesh = new MeshSimple({
      texture,
      vertices: positions,
      uvs,
      indices,
    });

    this._worldRenderSystem.terrainBaseContainer.addChild(this._baseMesh);
  }

  // ---------------------------------------------------------------------------
  // Contour lines
  // ---------------------------------------------------------------------------

  private _buildContourLines(): void {
    const td = this._terrainData;
    const heights = td.heights;

    // Determine height range
    let minH = Infinity;
    let maxH = -Infinity;
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] < minH) minH = heights[i];
      if (heights[i] > maxH) maxH = heights[i];
    }

    if (maxH - minH < CONTOUR_MINOR_INTERVAL * 0.5) {
      // Terrain is essentially flat — no contour lines needed
      return;
    }

    const g = new Graphics();

    const majorInterval = CONTOUR_MINOR_INTERVAL * CONTOUR_MAJOR_EVERY;
    const startLevel = Math.ceil(minH / CONTOUR_MINOR_INTERVAL) * CONTOUR_MINOR_INTERVAL;
    const endLevel = Math.floor(maxH / CONTOUR_MINOR_INTERVAL) * CONTOUR_MINOR_INTERVAL;

    for (let level = startLevel; level <= endLevel; level += CONTOUR_MINOR_INTERVAL) {
      const isMajor = Math.abs(level % majorInterval) < 0.01;
      const segments = extractContourSegments(td, level);

      if (segments.length === 0) continue;

      g.setStrokeStyle({
        width: isMajor ? 1.5 : 0.75,
        color: isMajor ? 0x000000 : 0x000000,
        alpha: isMajor ? 0.5 : 0.25,
      });

      for (const seg of segments) {
        g.moveTo(seg.a.x, seg.a.y);
        g.lineTo(seg.b.x, seg.b.y);
      }

      g.stroke();
    }

    this._contourGraphics = g;
    this._worldRenderSystem.terrainBaseContainer.addChild(g);
  }

  // ---------------------------------------------------------------------------
  // Per-band occlusion meshes
  // ---------------------------------------------------------------------------

  private _buildOcclusionMeshes(): void {
    const bandCount = this._worldRenderSystem.bandCount;
    this._occlusionMeshes = new Array(bandCount).fill(null);

    for (let bandIdx = 0; bandIdx < bandCount; bandIdx++) {
      // The elevation threshold for this band: tracks in bands below this
      // are hidden where terrain height >= this threshold.
      const elevationEnum = ELEVATION_VALUES[bandIdx];
      const threshold = elevationEnum * LEVEL_HEIGHT;

      // Skip the lowest band — nothing below it to occlude.
      if (bandIdx === 0) continue;

      const mesh = this._buildOcclusionMeshForThreshold(threshold);
      if (mesh) {
        const oc = this._worldRenderSystem.getTerrainOcclusionContainer(bandIdx);
        if (oc) {
          oc.addChild(mesh);
          this._occlusionMeshes[bandIdx] = mesh;
        }
      }
    }
  }

  /**
   * Build an opaque mesh covering grid cells where ANY vertex height >= threshold.
   * Uses the terrain's hypsometric color so the occlusion blends with the base.
   */
  private _buildOcclusionMeshForThreshold(threshold: number): MeshSimple | null {
    const td = this._terrainData;
    const { cellsX, cellsY, cellSize, originX, originY } = td.config;
    const vx = td.verticesX;
    const heights = td.heights;

    // Collect cells that need occlusion
    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const pixelCells: { col: number; row: number }[] = [];

    for (let row = 0; row < cellsY; row++) {
      for (let col = 0; col < cellsX; col++) {
        const h00 = heights[row * vx + col];
        const h10 = heights[row * vx + col + 1];
        const h01 = heights[(row + 1) * vx + col];
        const h11 = heights[(row + 1) * vx + col + 1];

        // Cell has occlusion if ANY corner is at or above threshold
        if (h00 < threshold && h10 < threshold && h01 < threshold && h11 < threshold) {
          continue;
        }

        const x0 = originX + col * cellSize;
        const y0 = originY + row * cellSize;
        const x1 = x0 + cellSize;
        const y1 = y0 + cellSize;

        const base = verts.length / 2;
        verts.push(x0, y0, x1, y0, x0, y1, x1, y1);
        // UVs will map to a tiny 1x1 texture, so all 0
        uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        pixelCells.push({ col, row });
      }
    }

    if (verts.length === 0) return null;

    // Build a small texture from the cell colors (average height per cell)
    // For simplicity, use a single color based on the threshold level
    const color = sampleColorRamp(threshold);

    // Create a 2x2 solid-color texture
    const texData = new Uint8Array([
      color.r, color.g, color.b, 255,
      color.r, color.g, color.b, 255,
      color.r, color.g, color.b, 255,
      color.r, color.g, color.b, 255,
    ]);
    const texture = Texture.from({
      resource: texData,
      width: 2,
      height: 2,
    });

    return new MeshSimple({
      texture,
      vertices: new Float32Array(verts),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    });
  }

  /** Clean up all PixiJS resources. */
  destroy(): void {
    this._destroyVisuals();
  }
}
