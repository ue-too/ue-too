import { Container, Graphics, MeshSimple, Texture } from 'pixi.js';
import earcut from 'earcut';
import type { Point } from '@ue-too/math';
import type { TrackGraph } from '@/trains/tracks/track';
import type { TrackTextureRenderer } from '@/trains/tracks/render-system';
import { LEVEL_HEIGHT } from '@/trains/tracks/constants';
import type { WorldRenderSystem } from '@/world-render-system';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatform } from './track-aligned-platform-types';
import { sampleSpineEdge } from './spine-utils';

/** World-space length per one repeat of the platform texture (tiling). */
const PLATFORM_TEXTURE_TILE_LEN = 2;

/** Resolution of the procedural platform texture (power-of-two for repeat wrap). */
const PLATFORM_TEX_SIZE = 128;

/** Yellow safety-line width as a fraction of the texture. */
const SAFETY_LINE_FRAC = 0.06;

type TrackAlignedPlatformRenderRecord = {
    container: Container;
};

function platformKey(id: number): string {
    return `track-aligned-platform-${id}`;
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

export class TrackAlignedPlatformRenderSystem {
    private _worldRenderSystem: WorldRenderSystem;
    private _platformManager: TrackAlignedPlatformManager;
    private _trackGraph: TrackGraph;
    private _textureRenderer: TrackTextureRenderer | null;

    private _records: Map<number, TrackAlignedPlatformRenderRecord> = new Map();
    private _platformTexture: Texture | null = null;

    // Preview graphics for placement tools
    private _previewGraphics: Graphics | null = null;
    private _previewKey = 'track-aligned-platform-preview';

    constructor(
        worldRenderSystem: WorldRenderSystem,
        platformManager: TrackAlignedPlatformManager,
        trackGraph: TrackGraph,
        textureRenderer?: TrackTextureRenderer | null,
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._platformManager = platformManager;
        this._trackGraph = trackGraph;
        this._textureRenderer = textureRenderer ?? null;
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    addPlatform(id: number, elevation: number): void {
        if (this._records.has(id)) return;

        const platform = this._platformManager.getPlatform(id);
        if (platform === null) return;

        const mesh = this._buildMesh(platform);
        if (mesh === null) return;

        const container = new Container();
        container.addChild(mesh);

        const key = platformKey(id);
        const elevationRaw = elevation * LEVEL_HEIGHT;
        const bandIndex = this._worldRenderSystem.getElevationBandIndex(elevationRaw);
        this._worldRenderSystem.addToBand(key, container, bandIndex, 'drawable');
        this._worldRenderSystem.setOrderInBand(key, 450);
        this._worldRenderSystem.sortChildren();

        this._records.set(id, { container });
    }

    removePlatform(id: number): void {
        const record = this._records.get(id);
        if (record === undefined) return;

        const key = platformKey(id);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
        this._records.delete(id);
    }

    // ---------------------------------------------------------------------------
    // Preview (placement tool feedback)
    // ---------------------------------------------------------------------------

    private _ensurePreviewGraphics(): Graphics {
        if (this._previewGraphics === null) {
            this._previewGraphics = new Graphics();
            this._previewGraphics.zIndex = 9999;
            this._worldRenderSystem.addDrawable(this._previewKey, this._previewGraphics);
        }
        return this._previewGraphics;
    }

    /**
     * Show a highlight along a track segment to indicate it can be clicked.
     * Used in PICK_START state when the cursor is near a track.
     */
    showTrackHighlight(segmentId: number, projectionT: number, side: 1 | -1, offset: number): void {
        const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
        if (curve === null) return;

        const g = this._ensurePreviewGraphics();
        g.clear();

        // Draw the full track edge on the chosen side.
        const steps = Math.max(8, Math.ceil(curve.fullLength / 2));
        let started = false;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const pos = curve.get(t);
            const d = curve.derivative(t);
            const mag = Math.sqrt(d.x * d.x + d.y * d.y);
            if (mag < 1e-12) continue;
            const nx = (-d.y / mag) * side;
            const ny = (d.x / mag) * side;
            const px = pos.x + nx * offset;
            const py = pos.y + ny * offset;
            if (!started) {
                g.moveTo(px, py);
                started = true;
            } else {
                g.lineTo(px, py);
            }
        }
        g.stroke({ color: 0x44cc88, alpha: 0.9, width: 0.3 });

        // Draw a dot at the projected point.
        const projPos = curve.get(projectionT);
        g.circle(projPos.x, projPos.y, 0.5);
        g.fill({ color: 0x44cc88, alpha: 0.8 });

        this._worldRenderSystem.sortChildren();
    }

    /**
     * Show the spine edge preview and optional outer polygon during placement.
     * @param spinePoints - sampled spine edge points
     * @param outerVertices - outer polygon vertices drawn so far (can be empty)
     * @param startAnchor - start anchor point (for closing indicator)
     * @param endAnchor - end anchor point (if spine confirmed)
     */
    showPlacementPreview(
        spinePoints: Point[],
        outerVertices: Point[],
        startAnchor: Point | null,
        endAnchor: Point | null,
    ): void {
        const g = this._ensurePreviewGraphics();
        g.clear();

        // Draw the spine edge.
        if (spinePoints.length >= 2) {
            g.moveTo(spinePoints[0].x, spinePoints[0].y);
            for (let i = 1; i < spinePoints.length; i++) {
                g.lineTo(spinePoints[i].x, spinePoints[i].y);
            }
            g.stroke({ color: 0x44cc88, alpha: 0.9, width: 0.25 });
        }

        // Draw outer polygon vertices.
        if (outerVertices.length > 0) {
            // Line from end anchor to first outer vertex.
            if (endAnchor !== null) {
                g.moveTo(endAnchor.x, endAnchor.y);
                g.lineTo(outerVertices[0].x, outerVertices[0].y);
            }
            // Connect outer vertices.
            g.moveTo(outerVertices[0].x, outerVertices[0].y);
            for (let i = 1; i < outerVertices.length; i++) {
                g.lineTo(outerVertices[i].x, outerVertices[i].y);
            }
            g.stroke({ color: 0xf0cc00, alpha: 0.8, width: 0.2 });

            // Dots at each vertex.
            for (const v of outerVertices) {
                g.circle(v.x, v.y, 0.3);
                g.fill({ color: 0xf0cc00, alpha: 0.8 });
            }
        }

        // Anchor points.
        if (startAnchor !== null) {
            g.circle(startAnchor.x, startAnchor.y, 0.5);
            g.fill({ color: 0x44cc88, alpha: 0.9 });
        }
        if (endAnchor !== null) {
            g.circle(endAnchor.x, endAnchor.y, 0.5);
            g.fill({ color: 0xcc4444, alpha: 0.9 });
        }

        this._worldRenderSystem.sortChildren();
    }

    hidePreview(): void {
        if (this._previewGraphics !== null) {
            this._worldRenderSystem.removeDrawable(this._previewKey);
            this._previewGraphics.destroy();
            this._previewGraphics = null;
        }
    }

    cleanup(): void {
        this.hidePreview();
        for (const [id] of this._records) {
            this.removePlatform(id);
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

    private _getOrCreateTexture(): Texture | null {
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

        // Yellow safety line on the track-facing edge.
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

    private _buildMesh(platform: TrackAlignedPlatform): MeshSimple | null {
        const texture = this._getOrCreateTexture();
        if (texture === null) return null;

        // Build getCurve wrapper — bail if any curve is missing.
        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        let polygon: Point[];

        try {
            const trackEdgeA = sampleSpineEdge(platform.spineA, platform.offset, getCurve);

            if (platform.outerVertices.kind === 'single') {
                // Single-spine: track edge + outer vertices polyline closes the polygon.
                polygon = [...trackEdgeA, ...platform.outerVertices.vertices];
            } else {
                // Dual-spine: track edge A → cap A → reversed track edge B → cap B.
                const trackEdgeB = sampleSpineEdge(platform.spineB!, platform.offset, getCurve);
                const reversedTrackEdgeB = [...trackEdgeB].reverse();
                const { capA, capB } = platform.outerVertices;
                polygon = [...trackEdgeA, ...capA, ...reversedTrackEdgeB, ...capB];
            }
        } catch {
            return null;
        }

        if (polygon.length < 3) return null;

        // Flatten to coordinate array for earcut.
        const flatCoords: number[] = [];
        for (const p of polygon) {
            flatCoords.push(p.x, p.y);
        }

        const indices = earcut(flatCoords);
        if (indices.length === 0) return null;

        // Compute bounding box for UV tiling.
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of polygon) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        // Generate UV coordinates using bounding-box tiling.
        const uvs: number[] = [];
        for (const p of polygon) {
            const u = rangeX > 0 ? (p.x - minX) / PLATFORM_TEXTURE_TILE_LEN : 0;
            const v = rangeY > 0 ? (p.y - minY) / PLATFORM_TEXTURE_TILE_LEN : 0;
            uvs.push(u, v);
        }

        // Flatten vertex positions.
        const vertices: number[] = [];
        for (const p of polygon) {
            vertices.push(p.x, p.y);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(vertices),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }
}
