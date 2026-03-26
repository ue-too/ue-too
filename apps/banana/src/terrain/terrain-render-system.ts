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

import { CanvasSource, Container, Graphics, Mesh, MeshGeometry, MeshSimple, Texture } from 'pixi.js';
import type { WorldRenderSystem } from '@/world-render-system';
import type { TerrainData } from './terrain-data';
import { sampleColorRamp, sampleWaterColor, hillshade, computeNormal } from './terrain-colors';
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

  /** Shared grid geometry (positions + UVs + indices) used by both base and water meshes. */
  private _sharedGridGeometry: MeshGeometry | null = null;
  /** Base terrain mesh (hypsometric color + hillshade). */
  private _baseMesh: Mesh | null = null;
  /** Canvas-backed texture source for the base mesh. */
  private _baseCanvasSource: CanvasSource | null = null;
  /** ImageData used for fast pixel writes on the base canvas. */
  private _baseImageData: ImageData | null = null;
  /** Water surface mesh (depth-tinted blue overlay). */
  private _waterMesh: Mesh | null = null;
  /** Canvas-backed texture source for the water mesh. */
  private _waterCanvasSource: CanvasSource | null = null;
  /** ImageData used for fast pixel writes on the water canvas. */
  private _waterImageData: ImageData | null = null;
  /** Contour line graphics overlay. */
  private _contourGraphics: Graphics | null = null;
  /** Per-band occlusion meshes. */
  private _occlusionMeshes: (MeshSimple | null)[] = [];

  /** Whether terrain visuals need rebuilding. */
  private _dirty = true;

  /** Whether X-ray mode is active (terrain occlusion becomes semi-transparent). */
  private _xray = false;
  /** Alpha applied to occlusion meshes when X-ray is active. */
  private static readonly XRAY_ALPHA = 0.35;

  /** Whether the terrain fill (base mesh + occlusion) is visible. Contour lines remain. */
  private _fillVisible = true;
  /** Opacity of the terrain fill [0, 1]. Applied on top of X-ray alpha for occlusion. */
  private _fillOpacity = 1;
  /** Whether occlusion meshes use white instead of terrain colors. */
  private _whiteOcclusion = false;

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

  /** Whether X-ray mode is active (occlusion becomes semi-transparent). */
  get xray(): boolean {
    return this._xray;
  }

  set xray(value: boolean) {
    if (this._xray === value) return;
    this._xray = value;
    this._applyOcclusionAlpha();
  }

  /** Whether the terrain fill is visible. Contour lines always remain. */
  get fillVisible(): boolean {
    return this._fillVisible;
  }

  set fillVisible(value: boolean) {
    if (this._fillVisible === value) return;
    this._fillVisible = value;
    this._applyFillVisibility();
  }

  /** Opacity of the terrain fill [0, 1]. */
  get fillOpacity(): number {
    return this._fillOpacity;
  }

  set fillOpacity(value: number) {
    const clamped = Math.max(0, Math.min(1, value));
    if (this._fillOpacity === clamped) return;
    this._fillOpacity = clamped;
    this._applyFillAlpha();
  }

  /** Whether occlusion meshes use white instead of terrain colors. */
  get whiteOcclusion(): boolean {
    return this._whiteOcclusion;
  }

  set whiteOcclusion(value: boolean) {
    if (this._whiteOcclusion === value) return;
    this._whiteOcclusion = value;
    this._rebuildOcclusionMeshes();
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
    this._buildSharedGridGeometry();
    this._buildBaseMesh();
    this._buildWaterMesh();
    this._buildContourLines();
    this._buildOcclusionMeshes();
  }

  /**
   * Update only the pixels within a dirty region of the terrain/water textures.
   *
   * Uses Canvas2D `putImageData` with a dirty rect — only the affected pixels
   * are recomputed and uploaded. Zero allocations, zero full-buffer copies.
   *
   * Call {@link rebuild} with `force: true` after painting ends to regenerate
   * contour lines and occlusion meshes.
   *
   * @param colMin - Left column of the dirty region (inclusive)
   * @param colMax - Right column of the dirty region (inclusive)
   * @param rowMin - Top row of the dirty region (inclusive)
   * @param rowMax - Bottom row of the dirty region (inclusive)
   */
  refreshRegion(colMin: number, colMax: number, rowMin: number, rowMax: number): void {
    const td = this._terrainData;
    const vx = td.verticesX;
    const vy = td.verticesY;
    const heights = td.heights;
    const waterSurface = td.waterSurface;
    const { cellSize } = td.config;

    const c0 = Math.max(0, colMin);
    const c1 = Math.min(vx - 1, colMax);
    const r0 = Math.max(0, rowMin);
    const r1 = Math.min(vy - 1, rowMax);
    const dirtyW = c1 - c0 + 1;
    const dirtyH = r1 - r0 + 1;
    if (dirtyW <= 0 || dirtyH <= 0) return;

    // Update base terrain pixels
    if (this._baseCanvasSource && this._baseImageData) {
      const pixels = this._baseImageData.data;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const idx = row * vx + col;
          const h = heights[idx];
          const color = sampleColorRamp(h);
          const [nx, ny, nz] = computeNormal(heights, col, row, vx, vy, cellSize);
          const shade = hillshade(nx, ny, nz);
          const pi = idx * 4;
          pixels[pi] = Math.round(color.r * shade);
          pixels[pi + 1] = Math.round(color.g * shade);
          pixels[pi + 2] = Math.round(color.b * shade);
          pixels[pi + 3] = 255;
        }
      }
      // putImageData with dirty rect — only uploads the changed region
      const ctx = this._baseCanvasSource.context2D;
      ctx.putImageData(this._baseImageData, 0, 0, c0, r0, dirtyW, dirtyH);
      this._baseCanvasSource.update();
    }

    // Update water pixels
    if (this._waterCanvasSource && this._waterImageData) {
      const pixels = this._waterImageData.data;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const idx = row * vx + col;
          const w = waterSurface[idx];
          const pi = idx * 4;
          if (isNaN(w)) {
            pixels[pi] = 0; pixels[pi + 1] = 0; pixels[pi + 2] = 0; pixels[pi + 3] = 0;
          } else {
            const depth = Math.max(0, w - heights[idx]);
            const color = sampleWaterColor(depth);
            pixels[pi] = color.r; pixels[pi + 1] = color.g;
            pixels[pi + 2] = color.b; pixels[pi + 3] = color.a;
          }
        }
      }
      const ctx = this._waterCanvasSource.context2D;
      ctx.putImageData(this._waterImageData, 0, 0, c0, r0, dirtyW, dirtyH);
      this._waterCanvasSource.update();
    }
  }

  private _destroyVisuals(): void {
    const baseContainer = this._worldRenderSystem.terrainBaseContainer;

    if (this._baseMesh) {
      baseContainer.removeChild(this._baseMesh);
      this._baseMesh.destroy();
      this._baseMesh = null;
      this._baseCanvasSource = null;
      this._baseImageData = null;
    }
    if (this._waterMesh) {
      baseContainer.removeChild(this._waterMesh);
      this._waterMesh.destroy();
      this._waterMesh = null;
      this._waterCanvasSource = null;
      this._waterImageData = null;
    }
    if (this._sharedGridGeometry) {
      this._sharedGridGeometry.destroy();
      this._sharedGridGeometry = null;
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
  // Shared grid geometry (used by both base and water meshes)
  // ---------------------------------------------------------------------------

  /**
   * Build a single MeshGeometry for the full terrain grid.  Both the base
   * terrain mesh and the water mesh share this geometry — they only differ
   * in their textures.  Sharing avoids duplicating ~6.4 MB of typed arrays
   * and their corresponding WebGPU staging buffers.
   */
  private _buildSharedGridGeometry(): void {
    const td = this._terrainData;
    const { cellsX, cellsY, cellSize, originX, originY } = td.config;
    const vx = td.verticesX;
    const vy = td.verticesY;

    const vertCount = vx * vy;
    const positions = new Float32Array(vertCount * 2);
    const uvs = new Float32Array(vertCount * 2);

    for (let row = 0; row < vy; row++) {
      for (let col = 0; col < vx; col++) {
        const idx = row * vx + col;
        positions[idx * 2] = originX + col * cellSize;
        positions[idx * 2 + 1] = originY + row * cellSize;
        uvs[idx * 2] = (col + 0.5) / vx;
        uvs[idx * 2 + 1] = (row + 0.5) / vy;
      }
    }

    const cellCount = cellsX * cellsY;
    const indices = new Uint32Array(cellCount * 6);
    let ii = 0;
    for (let row = 0; row < cellsY; row++) {
      for (let col = 0; col < cellsX; col++) {
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

    this._sharedGridGeometry = new MeshGeometry({
      positions,
      uvs,
      indices,
    });
  }

  // ---------------------------------------------------------------------------
  // Base terrain mesh
  // ---------------------------------------------------------------------------

  private _buildBaseMesh(): void {
    const td = this._terrainData;
    const { cellSize } = td.config;
    const vx = td.verticesX;
    const vy = td.verticesY;
    const heights = td.heights;

    // Create an offscreen canvas for the texture
    const canvas = document.createElement('canvas');
    canvas.width = vx;
    canvas.height = vy;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(vx, vy);
    const pixels = imageData.data; // RGBA order

    for (let row = 0; row < vy; row++) {
      for (let col = 0; col < vx; col++) {
        const idx = row * vx + col;
        const h = heights[idx];

        const color = sampleColorRamp(h);
        const [nx, ny, nz] = computeNormal(heights, col, row, vx, vy, cellSize);
        const shade = hillshade(nx, ny, nz);

        const pi = idx * 4;
        pixels[pi] = Math.round(color.r * shade);
        pixels[pi + 1] = Math.round(color.g * shade);
        pixels[pi + 2] = Math.round(color.b * shade);
        pixels[pi + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Canvas-backed texture — PixiJS auto-uploads on draw
    this._baseCanvasSource = new CanvasSource({ resource: canvas, resolution: 1 });
    this._baseImageData = imageData;
    const texture = new Texture(this._baseCanvasSource);

    this._baseMesh = new Mesh({
      geometry: this._sharedGridGeometry!,
      texture,
    });

    this._worldRenderSystem.terrainBaseContainer.addChild(this._baseMesh);
  }

  // ---------------------------------------------------------------------------
  // Water surface mesh
  // ---------------------------------------------------------------------------

  private _buildWaterMesh(): void {
    const td = this._terrainData;
    const vx = td.verticesX;
    const vy = td.verticesY;
    const heights = td.heights;
    const waterSurface = td.waterSurface;

    // Always build the water mesh so refreshRegion can paint water later
    const canvas = document.createElement('canvas');
    canvas.width = vx;
    canvas.height = vy;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(vx, vy);
    const pixels = imageData.data; // RGBA order

    for (let row = 0; row < vy; row++) {
      for (let col = 0; col < vx; col++) {
        const idx = row * vx + col;

        const w = waterSurface[idx];
        const pi = idx * 4;

        if (isNaN(w)) {
          pixels[pi] = 0; pixels[pi + 1] = 0; pixels[pi + 2] = 0; pixels[pi + 3] = 0;
        } else {
          const depth = Math.max(0, w - heights[idx]);
          const color = sampleWaterColor(depth);
          pixels[pi] = color.r; pixels[pi + 1] = color.g;
          pixels[pi + 2] = color.b; pixels[pi + 3] = color.a;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    this._waterCanvasSource = new CanvasSource({ resource: canvas, resolution: 1 });
    this._waterImageData = imageData;
    const texture = new Texture(this._waterCanvasSource);

    this._waterMesh = new Mesh({
      geometry: this._sharedGridGeometry!,
      texture,
    });

    // Place water above base terrain but below contour lines
    this._waterMesh.zIndex = 0.5;

    this._worldRenderSystem.terrainBaseContainer.addChild(this._waterMesh);
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
        if (this._xray) mesh.alpha = TerrainRenderSystem.XRAY_ALPHA;
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
    const color = this._whiteOcclusion
      ? { r: 255, g: 255, b: 255 }
      : sampleColorRamp(threshold);

    // Create a 2x2 solid-color texture (BGRA order for WebGPU).
    const texData = new Uint8Array([
      color.b, color.g, color.r, 255,
      color.b, color.g, color.r, 255,
      color.b, color.g, color.r, 255,
      color.b, color.g, color.r, 255,
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

  /** Destroy and rebuild occlusion meshes (e.g. after color mode change). */
  private _rebuildOcclusionMeshes(): void {
    for (let i = 0; i < this._occlusionMeshes.length; i++) {
      const mesh = this._occlusionMeshes[i];
      if (mesh) {
        const oc = this._worldRenderSystem.getTerrainOcclusionContainer(i);
        if (oc) oc.removeChild(mesh);
        mesh.destroy();
      }
    }
    this._occlusionMeshes = [];
    this._buildOcclusionMeshes();
    this._applyFillVisibility();
  }

  /** Apply the current X-ray alpha to all occlusion meshes, factoring in fill opacity. */
  private _applyOcclusionAlpha(): void {
    const baseAlpha = this._xray ? TerrainRenderSystem.XRAY_ALPHA : 1;
    const alpha = baseAlpha * this._fillOpacity;
    for (const mesh of this._occlusionMeshes) {
      if (mesh) mesh.alpha = alpha;
    }
  }

  /** Show/hide the terrain fill (base mesh + water + occlusion). */
  private _applyFillVisibility(): void {
    if (this._baseMesh) this._baseMesh.visible = this._fillVisible;
    if (this._waterMesh) this._waterMesh.visible = this._fillVisible;
    for (const mesh of this._occlusionMeshes) {
      if (mesh) mesh.visible = this._fillVisible;
    }
  }

  /** Apply fill opacity to base mesh, water mesh, and occlusion meshes. */
  private _applyFillAlpha(): void {
    if (this._baseMesh) this._baseMesh.alpha = this._fillOpacity;
    if (this._waterMesh) this._waterMesh.alpha = this._fillOpacity;
    this._applyOcclusionAlpha();
  }

  /** Clean up all PixiJS resources. */
  destroy(): void {
    this._destroyVisuals();
  }
}
