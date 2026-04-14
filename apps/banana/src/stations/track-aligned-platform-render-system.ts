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

// ---------------------------------------------------------------------------
// Spine-relative UV helpers
// ---------------------------------------------------------------------------

/** Compute cumulative arc-lengths for a polyline. */
function cumulativeArcLengths(pts: Point[]): number[] {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        lens.push(lens[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return lens;
}

/** Interpolate a point along a polyline at a given arc-length. */
function samplePolylineAtArcLength(
    polyline: Point[],
    arcLens: number[],
    targetArc: number,
): Point {
    if (polyline.length <= 1) return polyline[0] ?? { x: 0, y: 0 };
    for (let i = 0; i < polyline.length - 1; i++) {
        if (targetArc <= arcLens[i + 1] || i === polyline.length - 2) {
            const segArc = arcLens[i + 1] - arcLens[i];
            const t = segArc > 0 ? Math.min(1, (targetArc - arcLens[i]) / segArc) : 0;
            return {
                x: polyline[i].x + t * (polyline[i + 1].x - polyline[i].x),
                y: polyline[i].y + t * (polyline[i + 1].y - polyline[i].y),
            };
        }
    }
    return polyline[polyline.length - 1];
}

/**
 * Project a point onto a polyline.
 * Returns the arc-length at the closest point and the perpendicular distance.
 */
function projectOntoPolyline(
    pt: Point,
    polyline: Point[],
    arcLengths: number[],
): { arcLength: number; dist: number } {
    let bestDistSq = Infinity;
    let bestArc = 0;

    for (let i = 0; i < polyline.length - 1; i++) {
        const ax = polyline[i].x,
            ay = polyline[i].y;
        const bx = polyline[i + 1].x,
            by = polyline[i + 1].y;
        const abx = bx - ax,
            aby = by - ay;
        const segLenSq = abx * abx + aby * aby;

        let t = 0;
        if (segLenSq > 1e-12) {
            t = Math.max(0, Math.min(1, ((pt.x - ax) * abx + (pt.y - ay) * aby) / segLenSq));
        }

        const projX = ax + t * abx;
        const projY = ay + t * aby;
        const dx = pt.x - projX;
        const dy = pt.y - projY;
        const distSq = dx * dx + dy * dy;

        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestArc = arcLengths[i] + t * Math.sqrt(segLenSq);
        }
    }

    return { arcLength: bestArc, dist: Math.sqrt(bestDistSq) };
}

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

        const getCurve = (segmentId: number) => {
            const curve = this._trackGraph.getTrackSegmentCurve(segmentId);
            if (curve === null) throw new Error(`Missing curve for segment ${segmentId}`);
            return curve;
        };

        try {
            const trackEdgeA = sampleSpineEdge(platform.spineA, platform.offset, getCurve);

            if (platform.outerVertices.kind === 'single') {
                return this._buildSingleSpineStripMesh(
                    trackEdgeA,
                    platform.outerVertices.vertices,
                    texture,
                );
            } else {
                const trackEdgeB = sampleSpineEdge(platform.spineB!, platform.offset, getCurve);
                return this._buildDualSpineStripMesh(
                    trackEdgeA,
                    trackEdgeB,
                    platform.outerVertices.capA,
                    platform.outerVertices.capB,
                    texture,
                );
            }
        } catch {
            return null;
        }
    }

    /**
     * Build a triangle-strip mesh for a single-spine platform.
     * Pairs each spine sample with a corresponding point on the outer edge
     * (resampled by matching normalized arc-length).
     */
    private _buildSingleSpineStripMesh(
        spineEdge: Point[],
        outerVerts: Point[],
        texture: Texture,
    ): MeshSimple | null {
        if (spineEdge.length < 2 || outerVerts.length < 1) return null;

        const spineArcLens = cumulativeArcLengths(spineEdge);
        const totalSpineArc = spineArcLens[spineArcLens.length - 1];
        if (totalSpineArc < 1e-9) return null;

        // Outer vertices run from spine end anchor back to spine start anchor.
        // Reverse to align with the spine direction (start → end).
        const alignedOuter = [...outerVerts].reverse();
        const outerArcLens = cumulativeArcLengths(alignedOuter);
        const totalOuterArc = outerArcLens[outerArcLens.length - 1];

        const verts: number[] = [];
        const uvs: number[] = [];

        for (let i = 0; i < spineEdge.length; i++) {
            const sp = spineEdge[i];
            const t = spineArcLens[i] / totalSpineArc;
            const op =
                totalOuterArc > 0
                    ? samplePolylineAtArcLength(alignedOuter, outerArcLens, t * totalOuterArc)
                    : alignedOuter[0];

            const v = spineArcLens[i] / PLATFORM_TEXTURE_TILE_LEN;

            // Near edge (spine): u=0 → safety line.
            verts.push(sp.x, sp.y);
            uvs.push(0, v);

            // Far edge (outer): u < 1 so the wrapping safety line doesn't appear.
            verts.push(op.x, op.y);
            uvs.push(1 - SAFETY_LINE_FRAC, v);
        }

        const pairCount = spineEdge.length;
        const indices: number[] = [];
        for (let i = 0; i < pairCount - 1; i++) {
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

    /**
     * Build a triangle-strip mesh for a dual-spine platform.
     * Pairs spine A samples with corresponding resampled spine B points,
     * plus earcut-triangulated end caps.
     */
    private _buildDualSpineStripMesh(
        trackEdgeA: Point[],
        trackEdgeB: Point[],
        capA: Point[],
        capB: Point[],
        texture: Texture,
    ): MeshSimple | null {
        if (trackEdgeA.length < 2 || trackEdgeB.length < 2) return null;

        const arcLensA = cumulativeArcLengths(trackEdgeA);
        const totalArcA = arcLensA[arcLensA.length - 1];
        if (totalArcA < 1e-9) return null;

        // Reverse edge B to align with edge A direction.
        const reversedEdgeB = [...trackEdgeB].reverse();
        const arcLensRevB = cumulativeArcLengths(reversedEdgeB);
        const totalArcRevB = arcLensRevB[arcLensRevB.length - 1];

        const verts: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        // --- Main body strip: edge A (u=0) paired with resampled reversed edge B (u=1). ---
        for (let i = 0; i < trackEdgeA.length; i++) {
            const t = arcLensA[i] / totalArcA;
            const pA = trackEdgeA[i];
            const pB =
                totalArcRevB > 0
                    ? samplePolylineAtArcLength(reversedEdgeB, arcLensRevB, t * totalArcRevB)
                    : reversedEdgeB[0];
            const v = arcLensA[i] / PLATFORM_TEXTURE_TILE_LEN;

            verts.push(pA.x, pA.y);
            uvs.push(0, v); // spine A — safety line

            verts.push(pB.x, pB.y);
            uvs.push(1, v); // spine B — safety line (wraps to u=0)
        }

        for (let i = 0; i < trackEdgeA.length - 1; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        // --- End caps (earcut for non-empty cap vertex arrays). ---
        const lastA = trackEdgeA[trackEdgeA.length - 1];
        const firstRevB = reversedEdgeB[0];
        this._appendCapTriangles(lastA, capA, firstRevB, trackEdgeA, arcLensA, verts, uvs, indices);

        const lastRevB = reversedEdgeB[reversedEdgeB.length - 1];
        const firstA = trackEdgeA[0];
        this._appendCapTriangles(lastRevB, capB, firstA, trackEdgeA, arcLensA, verts, uvs, indices);

        if (indices.length === 0) return null;

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    /**
     * Triangulate and append a small cap polygon (startPt → capVerts → endPt)
     * to the running vertex/index arrays using earcut.
     */
    private _appendCapTriangles(
        startPt: Point,
        capVerts: Point[],
        endPt: Point,
        spineEdge: Point[],
        spineArcLens: number[],
        verts: number[],
        uvs: number[],
        indices: number[],
    ): void {
        if (capVerts.length === 0) return;

        const capPolygon = [startPt, ...capVerts, endPt];
        if (capPolygon.length < 3) return;

        const baseVertex = verts.length / 2;

        const flatCoords: number[] = [];
        for (const p of capPolygon) {
            flatCoords.push(p.x, p.y);
        }
        const capIndices = earcut(flatCoords);
        if (capIndices.length === 0) return;

        // Approximate UVs for cap vertices via projection onto the spine.
        for (const p of capPolygon) {
            const proj = projectOntoPolyline(p, spineEdge, spineArcLens);
            verts.push(p.x, p.y);
            uvs.push(0.5, proj.arcLength / PLATFORM_TEXTURE_TILE_LEN);
        }

        for (const idx of capIndices) {
            indices.push(baseVertex + idx);
        }
    }
}
