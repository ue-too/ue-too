import { Container, Graphics, MeshSimple, Texture } from 'pixi.js';
import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';
import type { TrackGraph } from '@/trains/tracks/track';
import type { TrackTextureRenderer } from '@/trains/tracks/render-system';
import { LEVEL_HEIGHT } from '@/trains/tracks/constants';
import type { WorldRenderSystem } from '@/world-render-system';
import type { StationManager } from './station-manager';
import type { Platform } from './types';

/** World-space length per one repeat of the platform texture along the curve. */
const PLATFORM_TEXTURE_TILE_LEN = 2;

/** Resolution of the procedural platform texture (power-of-two for repeat wrap). */
const PLATFORM_TEX_SIZE = 128;

/** Yellow safety-line width as a fraction of the texture. */
const SAFETY_LINE_FRAC = 0.06;

type StationRenderRecord = {
  container: Container;
};

function stationKey(id: number): string {
  return `station-${id}`;
}

/**
 * Seeded PRNG (same algorithm used by the track render system).
 */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class StationRenderSystem {
  private _worldRenderSystem: WorldRenderSystem;
  private _stationManager: StationManager;
  private _trackGraph: TrackGraph;
  private _textureRenderer: TrackTextureRenderer | null;

  private _records: Map<number, StationRenderRecord> = new Map();
  private _platformTexture: Texture | null = null;

  constructor(
    worldRenderSystem: WorldRenderSystem,
    stationManager: StationManager,
    trackGraph: TrackGraph,
    textureRenderer?: TrackTextureRenderer | null,
  ) {
    this._worldRenderSystem = worldRenderSystem;
    this._stationManager = stationManager;
    this._trackGraph = trackGraph;
    this._textureRenderer = textureRenderer ?? null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  addStation(id: number): void {
    if (this._records.has(id)) return;

    const station = this._stationManager.getStation(id);
    if (station === null) return;

    const container = new Container();

    for (const platform of station.platforms) {
      const mesh = this._buildPlatformMesh(platform);
      if (mesh !== null) {
        container.addChild(mesh);
      }
    }

    const key = stationKey(id);
    const elevationRaw = (station.elevation as number) * LEVEL_HEIGHT;
    const bandIndex = this._worldRenderSystem.getElevationBandIndex(elevationRaw);
    // Place platform above track ballast in the drawable sublayer.
    this._worldRenderSystem.addToBand(key, container, bandIndex, 'drawable');
    this._worldRenderSystem.setOrderInBand(key, 450);
    this._worldRenderSystem.sortChildren();

    this._records.set(id, { container });
  }

  removeStation(id: number): void {
    const record = this._records.get(id);
    if (record === undefined) return;

    const key = stationKey(id);
    const removed = this._worldRenderSystem.removeFromBand(key);
    removed?.destroy({ children: true });
    this._records.delete(id);
  }

  cleanup(): void {
    for (const [id] of this._records) {
      this.removeStation(id);
    }
    this._records.clear();
    if (this._platformTexture !== null) {
      this._platformTexture.destroy(true);
      this._platformTexture = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Texture
  // ---------------------------------------------------------------------------

  private _getOrCreatePlatformTexture(): Texture | null {
    if (this._platformTexture !== null) return this._platformTexture;
    const renderer = this._textureRenderer?.renderer?.textureGenerator;
    if (renderer === undefined) return null;

    const size = PLATFORM_TEX_SIZE;
    const g = new Graphics();

    // Base concrete fill.
    g.rect(0, 0, size, size);
    g.fill(0xb0aca8);

    // Subtle surface variation — small random marks.
    const rng = seededRng(101);
    for (let i = 0; i < 60; i++) {
      const mx = rng() * size;
      const my = rng() * size;
      const mw = 2 + rng() * 4;
      const mh = 1 + rng() * 2;
      g.rect(mx, my, mw, mh);
      g.fill({ color: 0x9a9690, alpha: 0.3 + rng() * 0.3 });
    }

    // Yellow safety line on the track-facing edge only (u=0 / near edge).
    // The far edge (u=1) faces the center of the island — no line there.
    const lineW = Math.round(size * SAFETY_LINE_FRAC);
    g.rect(0, 0, lineW, size);
    g.fill(0xf0cc00);

    this._platformTexture = renderer.generateTexture({ target: g });
    const source = this._platformTexture.source;
    if ('addressMode' in source) {
      (source as { addressMode: string }).addressMode = 'repeat';
    }
    g.destroy();
    return this._platformTexture;
  }

  // ---------------------------------------------------------------------------
  // Mesh
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Preview (drag-to-place)
  // ---------------------------------------------------------------------------

  private _previewGraphics: Graphics | null = null;
  private _previewKey = 'station-preview';

  /**
   * Show or update a translucent preview of the station footprint.
   *
   * @param center - World-space center of the station
   * @param direction - Unit direction the tracks run along
   * @param length - Station length (meters)
   * @param trackSpacing - Distance between the two track centerlines
   */
  showPreview(center: Point, direction: Point, length: number, trackSpacing: number): void {
    if (this._previewGraphics === null) {
      this._previewGraphics = new Graphics();
      this._worldRenderSystem.addDrawable(this._previewKey, this._previewGraphics);
    }

    const g = this._previewGraphics;
    g.clear();

    const dir = PointCal.unitVector(direction);
    const normal: Point = { x: -dir.y, y: dir.x };
    const halfLen = length / 2;
    const halfSpacing = trackSpacing / 2;

    // Outer rectangle (full station footprint including tracks)
    const corners = [
      { x: center.x - dir.x * halfLen - normal.x * halfSpacing, y: center.y - dir.y * halfLen - normal.y * halfSpacing },
      { x: center.x + dir.x * halfLen - normal.x * halfSpacing, y: center.y + dir.y * halfLen - normal.y * halfSpacing },
      { x: center.x + dir.x * halfLen + normal.x * halfSpacing, y: center.y + dir.y * halfLen + normal.y * halfSpacing },
      { x: center.x - dir.x * halfLen + normal.x * halfSpacing, y: center.y - dir.y * halfLen + normal.y * halfSpacing },
    ];

    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      g.lineTo(corners[i].x, corners[i].y);
    }
    g.closePath();
    g.fill({ color: 0x4488cc, alpha: 0.25 });
    g.stroke({ color: 0x4488cc, alpha: 0.8, width: 0.15 });

    // Direction indicator line from center along the track direction
    g.moveTo(center.x, center.y);
    g.lineTo(center.x + dir.x * halfLen, center.y + dir.y * halfLen);
    g.stroke({ color: 0xffffff, alpha: 0.6, width: 0.1 });

    // Preview is a non-banded drawable with a high z-index to render on top.
    g.zIndex = 9999;
    this._worldRenderSystem.sortChildren();
  }

  hidePreview(): void {
    if (this._previewGraphics !== null) {
      this._worldRenderSystem.removeDrawable(this._previewKey);
      this._previewGraphics.destroy();
      this._previewGraphics = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Mesh
  // ---------------------------------------------------------------------------

  /**
   * Build a textured mesh for a single platform by sampling the adjacent
   * track curve and extruding perpendicular to it.
   */
  private _buildPlatformMesh(platform: Platform): MeshSimple | null {
    const texture = this._getOrCreatePlatformTexture();
    if (texture === null) return null;

    const curve = this._trackGraph.getTrackSegmentCurve(platform.track);
    if (curve === null) return null;

    const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
    const { offset, width, side } = platform;

    const verts: number[] = [];
    const uvs: number[] = [];
    let arcLen = 0;
    let prevPoint: { x: number; y: number } | null = null;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = curve.getPointbyPercentage(t);
      const d = curve.derivative(t);
      const mag = Math.sqrt(d.x * d.x + d.y * d.y);
      if (mag < 1e-9) continue;

      // Left normal of the tangent: (-dy, dx)
      const nx = (-d.y / mag) * side;
      const ny = (d.x / mag) * side;

      // Near edge (track side, with safety line) and far edge.
      // Slight overlap (0.05) on the far edge prevents a visible seam where two
      // island-platform halves meet (their normals can diverge by a tiny amount).
      const nearEdge = { x: p.x + nx * offset, y: p.y + ny * offset };
      const farEdge = { x: p.x + nx * (offset + width + 0.05), y: p.y + ny * (offset + width + 0.05) };

      // Accumulate arc length for UV tiling.
      if (prevPoint !== null) {
        const segDx = p.x - prevPoint.x;
        const segDy = p.y - prevPoint.y;
        arcLen += Math.sqrt(segDx * segDx + segDy * segDy);
      }
      prevPoint = p;

      const v = arcLen / PLATFORM_TEXTURE_TILE_LEN;

      // u=0 at near edge (safety line), u=1 at far edge (safety line).
      verts.push(nearEdge.x, nearEdge.y);
      uvs.push(0, v);
      verts.push(farEdge.x, farEdge.y);
      uvs.push(1, v);
    }

    // Build triangle indices (triangle strip as indexed triangles).
    const vertexPairCount = verts.length / 4;
    const indices: number[] = [];
    for (let i = 0; i < vertexPairCount - 1; i++) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }

    if (indices.length === 0) return null;

    return new MeshSimple({
      texture,
      vertices: new Float32Array(verts),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    });
  }
}
