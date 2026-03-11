import { Container, Graphics, MeshSimple, Text, Texture } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve, offset2 } from '@ue-too/curve';
import { Point, PointCal } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';
import { ELEVATION, ELEVATION_MAX, ELEVATION_MIN, ProjectionPositiveResult, TrackSegmentDrawData, TrackSegmentWithCollision } from './types';
import { LEVEL_HEIGHT } from './constants';
import { clearShadowCache } from '@/utils';
import { WorldRenderSystem, findElevationInterval, Z_INDEX_OFFSET_RAILS } from '@/world-render-system';
import { CameraState, CameraZoomEventPayload, ObservableBoardCamera } from '@ue-too/board';

/** Zoom level above which detailed track draw data is shown; below this only the bezier curve is drawn. */
const ZOOM_THRESHOLD_DETAILED_TRACK = 5;

/** How to render detailed track draw data: elevation-colored segments + offset rails, or a single tiled texture along the curve. */
export type DetailedTrackRenderStyle = 'elevation' | 'texture';

/** World-space length (meters when 1px = 1m) per one repeat of the track texture along the curve. ~0.6m matches typical tie spacing. */
const TRACK_TEXTURE_TILE_LEN = 0.6;

/** Resolution of the procedural track segment texture (power-of-two for repeat wrap). */
const TRACK_TEX_SIZE = 64;

/** Dimensions of the shared 1D elevation gradient texture. */
const ELEVATION_GRADIENT_WIDTH = 4;
const ELEVATION_GRADIENT_HEIGHT = 128;

/** Raw elevation range in world units (ELEVATION * LEVEL_HEIGHT). */
const ELEVATION_RAW_MIN = ELEVATION_MIN * LEVEL_HEIGHT;
const ELEVATION_RAW_MAX = ELEVATION_MAX * LEVEL_HEIGHT;

/** Map a raw elevation value to a normalised [0, 1] coordinate into the gradient texture. */
const normalizeElevation = (rawElevation: number): number =>
    (rawElevation - ELEVATION_RAW_MIN) / (ELEVATION_RAW_MAX - ELEVATION_RAW_MIN);

/** Size of the tiny solid-black texture used for shadow meshes. */
const SHADOW_TEX_SIZE = 4;

/** Half the standard track gauge used for shadow edge offsets. */
const SHADOW_TRACK_HALF_WIDTH = 1.067 / 2;

/** Renderer (or app) that provides texture generation for the texture-style track and train cars. */
export type TrackTextureRenderer = {
    renderer: { textureGenerator: { generateTexture: (options: { target: Container }) => Texture } };
};

export class TrackRenderSystem {

    private _worldRenderSystem: WorldRenderSystem;
    private _simplifiedTrack: Container;
    private _trackOffsetContainer: Container;
    private _topLevelContainer: Container;
    private _trackCurveManager: TrackCurveManager;
    private _offsetGraphicsMap: Map<number, Container> = new Map();
    private _simplifiedTrackGraphicsMap: Map<number, Graphics> = new Map();

    /** Keys of drawables registered with the WorldRenderSystem by this renderer. */
    private _drawableKeys: Set<string> = new Set();

    /** Maps each draw data key to its elevation band index (rebuilt on every reindex). */
    private _drawDataBandMap: Map<string, number> = new Map();

    /** Keys of preview drawables (ephemeral, re-created on each preview change). */
    private _previewKeys: string[] = [];

    private _previewStartProjection: Graphics = new Graphics();
    private _previewEndProjection: Graphics = new Graphics();

    private _showPreviewCurveArcs: boolean = false;
    private _latestPreviewDrawDataList:
        | { index: number; drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[]
        | undefined = undefined;

    private _sunAngle: number = 135;
    private _baseShadowLength: number = 10;

    private _camera: ObservableBoardCamera;

    /** Optional renderer for generating track texture (required for texture render style). */
    private _textureRenderer: TrackTextureRenderer | null = null;

    /** How to draw detailed track: elevation-colored segments or tiled texture. */
    private _detailedRenderStyle: DetailedTrackRenderStyle = 'elevation';

    /** Cached procedural track texture; created lazily when texture style is used. */
    private _trackTexture: Texture | null = null;

    /** Shared 1D elevation gradient texture; created lazily. */
    private _elevationGradientTexture: Texture | null = null;

    /** Tiny solid-black texture for shadow meshes; created lazily. */
    private _shadowTexture: Texture | null = null;

    /**
     * Per-key shadow state retained for efficient sun-angle updates.
     *
     * - `constantElevation` shadows (from === to, elevation > 0) only need a
     *   position update because the polygon shape is angle-independent.
     * - Varying-elevation shadows must be cleared and redrawn.
     */
    private _shadowRecords: Map<string, ShadowRecord> = new Map();

    /** For each drawable key, the container has elevationNode at index 0 and textureNode at index 1. */
    private _detailedStyleNodes: Map<string, { elevationNode: Container; textureNode: Container }> = new Map();

    private _abortController: AbortController = new AbortController();

    constructor(
        worldRenderSystem: WorldRenderSystem,
        trackCurveManager: TrackCurveManager,
        curveCreationEngine: CurveCreationEngine,
        camera: ObservableBoardCamera,
        textureRenderer?: TrackTextureRenderer | null,
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._topLevelContainer = new Container();
        this._trackOffsetContainer = new Container();
        this._simplifiedTrack = new Container();

        worldRenderSystem.addOverlayContainer(this._trackOffsetContainer, { zIndex: Z_INDEX_OFFSET_RAILS });
        worldRenderSystem.addOverlayContainer(this._topLevelContainer);
        worldRenderSystem.addOverlayContainer(this._simplifiedTrack);

        this._trackCurveManager = trackCurveManager;

        this._trackCurveManager.onDelete(this._onDelete.bind(this), { signal: this._abortController.signal });
        this._trackCurveManager.onAdd(this._onNewTrackData.bind(this), { signal: this._abortController.signal });
        curveCreationEngine.onPreviewDrawDataChange(this._onPreviewDrawDataChange.bind(this), { signal: this._abortController.signal });

        this._previewStartProjection.visible = false;
        this._previewEndProjection.visible = false;

        this._previewStartProjection.arc(0, 0, 1, 0, 2 * Math.PI);
        this._previewStartProjection.pivot.set(this._previewStartProjection.width / 2, this._previewStartProjection.height / 2);
        this._previewStartProjection.fill({ color: 0xFFFFFF });
        this._topLevelContainer.addChild(this._previewStartProjection);

        curveCreationEngine.onPreviewStartProjectionChange(this._onPreviewStartChange.bind(this), { signal: this._abortController.signal });

        this._previewEndProjection.arc(0, 0, 1, 0, 2 * Math.PI);
        this._previewEndProjection.pivot.set(this._previewEndProjection.width / 2, this._previewEndProjection.height / 2);
        this._previewEndProjection.fill({ color: 0xFFFFFF });
        this._topLevelContainer.addChild(this._previewEndProjection);

        curveCreationEngine.onPreviewEndProjectionChange(this._onPreviewEndChange.bind(this), { signal: this._abortController.signal });

        this._trackCurveManager.onAddTrackSegment(this._onAddTrackSegment.bind(this), { signal: this._abortController.signal });
        this._trackCurveManager.onRemoveTrackSegment(this._onRemoveTrackSegment.bind(this), { signal: this._abortController.signal });

        this._camera = camera;
        this._textureRenderer = textureRenderer ?? null;

        this._camera.on('zoom', this._onZoom.bind(this), { signal: this._abortController.signal });

        this._applyZoomLod(this._camera.zoomLevel);
    }

    /** Current detailed track render style (elevation segments + offset rails vs. tiled texture). */
    get detailedRenderStyle(): DetailedTrackRenderStyle {
        return this._detailedRenderStyle;
    }

    set detailedRenderStyle(style: DetailedTrackRenderStyle) {
        if (this._detailedRenderStyle === style) return;
        this._detailedRenderStyle = style;
        this._applyDetailedRenderStyle();
    }

    /** Apply current detailed render style visibility to all drawable containers and offset rails. */
    private _applyDetailedRenderStyle(): void {
        const useElevation = this._detailedRenderStyle === 'elevation';
        for (const [, { elevationNode, textureNode }] of this._detailedStyleNodes) {
            elevationNode.visible = useElevation;
            textureNode.visible = !useElevation;
        }
        const useDetailed = this._camera.zoomLevel >= ZOOM_THRESHOLD_DETAILED_TRACK;
        this._trackOffsetContainer.visible = useDetailed && useElevation;
    }

    get sunAngle(): number {
        return this._sunAngle;
    }

    set sunAngle(angle: number) {
        if (this._sunAngle === angle) return;
        this._sunAngle = angle;
        clearShadowCache();
        this._rebuildAllShadows();
    }

    get showPreviewCurveArcs(): boolean {
        return this._showPreviewCurveArcs;
    }

    set showPreviewCurveArcs(show: boolean) {
        if (this._showPreviewCurveArcs === show) return;
        this._showPreviewCurveArcs = show;
        // Redraw current preview immediately (without requiring pointer movement).
        this._onPreviewDrawDataChange(this._latestPreviewDrawDataList);
    }

    private _onZoom(_event: CameraZoomEventPayload, cameraState: CameraState) {
        this._applyZoomLod(cameraState.zoomLevel);
        // Redraw preview so radius labels pick up new zoom-based font size.
        if (this._showPreviewCurveArcs) {
            this._onPreviewDrawDataChange(this._latestPreviewDrawDataList);
        }
    }

    /**
     * Toggle track representation by zoom: low zoom shows only the bezier curve;
     * high zoom shows detailed draw data (elevation segments, shadows) and hides the simplified curve.
     */
    private _applyZoomLod(zoomLevel: number): void {
        const useDetailed = zoomLevel >= ZOOM_THRESHOLD_DETAILED_TRACK;
        const useElevation = this._detailedRenderStyle === 'elevation';

        this._simplifiedTrack.visible = !useDetailed;
        this._trackOffsetContainer.visible = useDetailed && useElevation;

        for (const key of this._drawableKeys) {
            const container = this._worldRenderSystem.getDrawable(key);
            if (container !== undefined) {
                container.visible = useDetailed;
            }
        }

        for (const [, record] of this._shadowRecords) {
            record.mesh.visible = useDetailed;
        }
    }

    /**
     * Update every shadow for the current sun angle.
     *
     * Constant-elevation shadows only need a position update (cheap).
     * Varying-elevation shadows are cleared and redrawn in-place (no
     * destroy/create overhead).
     */
    private _rebuildAllShadows(): void {
        const sunAngleRad = (this._sunAngle * Math.PI) / 180;
        const cosA = Math.cos(sunAngleRad);
        const sinA = Math.sin(sunAngleRad);

        for (const [, record] of this._shadowRecords) {
            if (record.constantElevation) {
                record.mesh.position.set(
                    cosA * record.shadowLength,
                    sinA * record.shadowLength,
                );
            } else if (record.baseVerts && record.elevationFactors) {
                const verts = record.mesh.vertices as Float32Array;
                const base = record.baseVerts;
                const factors = record.elevationFactors;
                for (let i = 0; i < factors.length; i++) {
                    const offsetX = cosA * factors[i];
                    const offsetY = sinA * factors[i];
                    const bi = i * 4;
                    verts[bi] = base[bi] + offsetX;
                    verts[bi + 1] = base[bi + 1] + offsetY;
                    verts[bi + 2] = base[bi + 2] + offsetX;
                    verts[bi + 3] = base[bi + 3] + offsetY;
                }
                record.mesh.vertices = verts;
            }
        }
    }

    private _onPreviewStartChange(projection: ProjectionPositiveResult | null) {
        if (projection === null) {
            this._previewStartProjection.visible = false;
            return;
        }

        const type = projection.hitType;
        const position = projection.projectionPoint;

        if (!this._previewStartProjection.visible) {
            this._previewStartProjection.visible = true;
        }

        this._previewStartProjection.position.set(position.x, position.y);
        const color = getProjectionTypeColor(type);
        this._previewStartProjection.tint = color;
    }

    private _onPreviewEndChange(projection: ProjectionPositiveResult | null) {
        if (projection === null) {
            this._previewEndProjection.visible = false;
            return;
        }

        const type = projection.hitType;
        const position = projection.projectionPoint;

        if (!this._previewEndProjection.visible) {
            this._previewEndProjection.visible = true;
        }

        this._previewEndProjection.position.set(position.x, position.y);
        const color = getProjectionTypeColor(type);
        this._previewEndProjection.tint = color;
    }

    cleanup() {
        this._abortController.abort();

        this._previewKeys.forEach(key => {
            const container = this._worldRenderSystem.removeDrawable(key);
            container?.destroy({ children: true });
        });
        this._previewKeys = [];

        this._drawableKeys.forEach(key => {
            const container = this._worldRenderSystem.removeDrawable(key);
            container?.destroy({ children: true });
            this._worldRenderSystem.removeShadow(key);
        });
        this._drawableKeys.clear();
        this._shadowRecords.clear();

        this._previewStartProjection.destroy();
        this._previewEndProjection.destroy();

        this._worldRenderSystem.removeOverlayContainer(this._trackOffsetContainer);
        this._trackOffsetContainer.destroy({ children: true });

        this._worldRenderSystem.removeOverlayContainer(this._topLevelContainer);
        this._topLevelContainer.destroy({ children: true });

        this._offsetGraphicsMap.clear();
        this._detailedStyleNodes.clear();
        if (this._trackTexture !== null) {
            this._trackTexture.destroy(true);
            this._trackTexture = null;
        }
        if (this._elevationGradientTexture !== null) {
            this._elevationGradientTexture.destroy(true);
            this._elevationGradientTexture = null;
        }
        if (this._shadowTexture !== null) {
            this._shadowTexture.destroy(true);
            this._shadowTexture = null;
        }
    }

    private _onDelete(key: string) {
        this._detailedStyleNodes.delete(key);
        const container = this._worldRenderSystem.removeDrawable(key);
        if (container !== undefined) {
            container.destroy({ children: true });
            this._drawableKeys.delete(key);
        }

        this._worldRenderSystem.removeShadow(key);
        this._shadowRecords.delete(key);

        this._reindexDrawData();
    }

    /**
     * Build a mesh that draws the track texture along the curve (strip with UVs so texture tiles along arc length).
     * Returns null if texture generation is not available.
     */
    private _buildTrackMeshForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const texture = this._getOrCreateTrackTexture();
        if (texture === null) return null;

        const { curve, gauge } = drawData;
        const hw = gauge / 2;
        const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
        const verts: number[] = [];
        const uvs: number[] = [];
        let arcLen = 0;

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            if (i > 0) {
                const prevT = (i - 1) / steps;
                const prev = i === 1 ? startPoint : curve.getPointbyPercentage(prevT);
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                arcLen += Math.sqrt(dx * dx + dy * dy);
            }
            const v = arcLen / TRACK_TEXTURE_TILE_LEN;

            verts.push(point.x - nx * hw, point.y - ny * hw);
            uvs.push(0, v);
            verts.push(point.x + nx * hw, point.y + ny * hw);
            uvs.push(1, v);
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    /** Create or return the shared procedural track segment texture (ballast, tie, rails). */
    private _getOrCreateTrackTexture(): Texture | null {
        if (this._trackTexture !== null) return this._trackTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        g.rect(0, 0, TRACK_TEX_SIZE, TRACK_TEX_SIZE);
        g.fill(0x9e8c6a);

        const rng = seededRng(42);
        for (let i = 0; i < 90; i++) {
            const px = rng() * TRACK_TEX_SIZE;
            const py = rng() * TRACK_TEX_SIZE;
            const pr = 1 + rng() * 2;
            const pc = [0x7a6a4a, 0xb8a880, 0x6e6050, 0xc4b090][Math.floor(rng() * 4)];
            g.circle(px, py, pr);
            g.fill({ color: pc, alpha: 0.75 });
        }

        const tieY = TRACK_TEX_SIZE * 0.5 - 6;
        g.rect(2, tieY, TRACK_TEX_SIZE - 4, 12);
        g.fill(0x5c3a1e);
        for (let i = 0; i < 5; i++) {
            const gy = tieY + 2 + rng() * 8;
            g.moveTo(2, gy);
            g.lineTo(TRACK_TEX_SIZE - 2, gy + rng() * 2 - 1);
            g.stroke({ color: 0x3b2510, alpha: 0.5, width: 0.6 });
        }

        const railL = TRACK_TEX_SIZE * 0.22;
        const railR = TRACK_TEX_SIZE * 0.78;
        const railW = 5;
        for (const rx of [railL, railR]) {
            g.rect(rx - railW / 2, 0, railW, TRACK_TEX_SIZE);
            g.fill(0x888888);
            g.rect(rx - 1, 0, 2, TRACK_TEX_SIZE);
            g.fill({ color: 0xcccccc, alpha: 0.7 });
        }

        this._trackTexture = renderer.generateTexture({ target: g });
        const source = this._trackTexture.source;
        if ('addressMode' in source) {
            (source as { addressMode: string }).addressMode = 'repeat';
        }
        return this._trackTexture;
    }

    /** Create or return the shared 1D elevation gradient texture. */
    private _getOrCreateElevationGradientTexture(): Texture | null {
        if (this._elevationGradientTexture !== null) return this._elevationGradientTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        for (let y = 0; y < ELEVATION_GRADIENT_HEIGHT; y++) {
            const normalizedV = y / (ELEVATION_GRADIENT_HEIGHT - 1);
            const rawElevation = ELEVATION_RAW_MIN + normalizedV * (ELEVATION_RAW_MAX - ELEVATION_RAW_MIN);
            const rgb = findElevationColorStop(rawElevation);
            const color = rgbToHex(rgb);
            g.rect(0, y, ELEVATION_GRADIENT_WIDTH, 1);
            g.fill(color);
        }

        this._elevationGradientTexture = renderer.generateTexture({ target: g });
        return this._elevationGradientTexture;
    }

    /** Create or return the shared solid-black texture for shadow meshes. */
    private _getOrCreateShadowTexture(): Texture | null {
        if (this._shadowTexture !== null) return this._shadowTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const g = new Graphics();
        g.rect(0, 0, SHADOW_TEX_SIZE, SHADOW_TEX_SIZE);
        g.fill(0x000000);

        this._shadowTexture = renderer.generateTexture({ target: g });
        return this._shadowTexture;
    }

    /**
     * Build a shadow mesh strip along a curve.
     *
     * @param curve - The bezier curve to trace
     * @param elevation - Elevation range for shadow offset calculation
     * @param sunAngle - Sun angle in degrees
     * @param baseShadowLength - Base shadow length multiplier
     * @returns The mesh plus auxiliary data for efficient sun-angle updates,
     *          or null if the texture renderer is unavailable
     */
    private _buildShadowMesh(
        curve: BCurve,
        elevation: { from: number; to: number },
        sunAngle: number,
        baseShadowLength: number,
    ): { mesh: MeshSimple; baseVerts: Float32Array; elevationFactors: Float32Array } | null {
        const texture = this._getOrCreateShadowTexture();
        if (texture === null) return null;

        const steps = 10;
        const sunAngleRad = (sunAngle * Math.PI) / 180;
        const cosA = Math.cos(sunAngleRad);
        const sinA = Math.sin(sunAngleRad);

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        const vertCount = (steps + 1) * 2;
        const baseVerts = new Float32Array(vertCount * 2);
        const elevationFactors = new Float32Array(steps + 1);
        const verts = new Float32Array(vertCount * 2);
        const uvs = new Float32Array(vertCount * 2);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const tangent = PointCal.unitVector(curve.derivativeByPercentage(t));
            const nx = -tangent.y;
            const ny = tangent.x;

            const elevationAtT = elevation.from + (elevation.to - elevation.from) * t;
            const shadowLen = elevationAtT > 0 ? baseShadowLength * (elevationAtT / 100) : 0;
            const offsetX = cosA * shadowLen;
            const offsetY = sinA * shadowLen;

            const bi = i * 4;
            // Left edge base (no sun offset)
            baseVerts[bi] = point.x + nx * SHADOW_TRACK_HALF_WIDTH;
            baseVerts[bi + 1] = point.y + ny * SHADOW_TRACK_HALF_WIDTH;
            // Right edge base
            baseVerts[bi + 2] = point.x - nx * SHADOW_TRACK_HALF_WIDTH;
            baseVerts[bi + 3] = point.y - ny * SHADOW_TRACK_HALF_WIDTH;

            elevationFactors[i] = shadowLen;

            // Apply sun offset
            verts[bi] = baseVerts[bi] + offsetX;
            verts[bi + 1] = baseVerts[bi + 1] + offsetY;
            verts[bi + 2] = baseVerts[bi + 2] + offsetX;
            verts[bi + 3] = baseVerts[bi + 3] + offsetY;

            const ui = i * 4;
            uvs[ui] = 0; uvs[ui + 1] = 0;
            uvs[ui + 2] = 1; uvs[ui + 3] = 0;
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        const mesh = new MeshSimple({
            texture,
            vertices: verts,
            uvs,
            indices: new Uint32Array(indices),
        });

        return { mesh, baseVerts, elevationFactors };
    }

    /**
     * Build a mesh strip along the curve colored by the elevation gradient.
     * Uses a single shared gradient texture with UV V coordinates mapping
     * from normalised(elevation.from) to normalised(elevation.to).
     */
    private _buildElevationMeshForDrawData(drawData: TrackSegmentDrawData): MeshSimple | null {
        const texture = this._getOrCreateElevationGradientTexture();
        if (texture === null) return null;

        const { curve, gauge, elevation } = drawData;
        const hw = gauge / 2;
        const steps = Math.max(2, Math.ceil(curve.fullLength / 2));
        const verts: number[] = [];
        const uvs: number[] = [];

        const vFrom = normalizeElevation(elevation.from);
        const vTo = normalizeElevation(elevation.to);

        const controlPoints = curve.getControlPoints();
        const startPoint = controlPoints[0];
        const endPoint = controlPoints[controlPoints.length - 1];

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = i === 0 ? startPoint : i === steps ? endPoint : curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            const v = vFrom + (vTo - vFrom) * t;

            verts.push(point.x - nx * hw, point.y - ny * hw);
            uvs.push(0.5, v);
            verts.push(point.x + nx * hw, point.y + ny * hw);
            uvs.push(0.5, v);
        }

        const indices: number[] = [];
        for (let i = 0; i < steps; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(verts),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }

    private _onRemoveTrackSegment(curveNumber: number) {
        const segmentsContainer = this._offsetGraphicsMap.get(curveNumber);
        if (segmentsContainer !== undefined) {
            this._trackOffsetContainer.removeChild(segmentsContainer);
            segmentsContainer.destroy({ children: true });
            this._offsetGraphicsMap.delete(curveNumber);
        }

        const simplifiedTrackGraphics = this._simplifiedTrackGraphicsMap.get(curveNumber);
        if (simplifiedTrackGraphics !== undefined) {
            this._simplifiedTrack.removeChild(simplifiedTrackGraphics);
            simplifiedTrackGraphics.destroy();
            this._simplifiedTrackGraphicsMap.delete(curveNumber);
        }
    }

    private _onAddTrackSegment(curveNumber: number, trackSegment: TrackSegmentWithCollision) {
        const positiveOffsets = offset2(trackSegment.curve, trackSegment.gauge / 2).points;
        const negativeOffsets = offset2(trackSegment.curve, -trackSegment.gauge / 2).points;

        const segmentsContainer = new Container();

        const positiveOffsetsGraphics = new Graphics();
        const negativeOffsetsGraphics = new Graphics();
        const simplifiedTrackGraphics = new Graphics();

        const controlPoints = trackSegment.curve.getControlPoints();

        simplifiedTrackGraphics.moveTo(controlPoints[0].x, controlPoints[0].y);
        if (controlPoints.length === 3) {
            simplifiedTrackGraphics.quadraticCurveTo(controlPoints[1].x, controlPoints[1].y, controlPoints[2].x, controlPoints[2].y);
        } else {
            simplifiedTrackGraphics.bezierCurveTo(controlPoints[1].x, controlPoints[1].y, controlPoints[2].x, controlPoints[2].y, controlPoints[3].x, controlPoints[3].y);
        }
        simplifiedTrackGraphics.stroke({ color: 0x000000, pixelLine: true });

        positiveOffsetsGraphics.moveTo(positiveOffsets[0].x, positiveOffsets[0].y);
        for (let i = 1; i < positiveOffsets.length; i++) {
            positiveOffsetsGraphics.lineTo(positiveOffsets[i].x, positiveOffsets[i].y);
        }
        positiveOffsetsGraphics.stroke({ color: 0x000000, pixelLine: true });

        negativeOffsetsGraphics.moveTo(negativeOffsets[0].x, negativeOffsets[0].y);
        for (let i = 1; i < negativeOffsets.length; i++) {
            negativeOffsetsGraphics.lineTo(negativeOffsets[i].x, negativeOffsets[i].y);
        }
        negativeOffsetsGraphics.stroke({ color: 0x000000, pixelLine: true });

        segmentsContainer.addChild(positiveOffsetsGraphics);
        segmentsContainer.addChild(negativeOffsetsGraphics);

        this._offsetGraphicsMap.set(curveNumber, segmentsContainer);

        this._trackOffsetContainer.addChild(segmentsContainer);

        this._simplifiedTrack.addChild(simplifiedTrackGraphics);
        this._simplifiedTrackGraphicsMap.set(curveNumber, simplifiedTrackGraphics);
    }

    private _onNewTrackData(index: number, drawDataList: (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[]) {

        drawDataList.forEach((drawData) => {
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });

            const segmentsContainer = new Container();

            const elevationNode = new Container();
            const elevationMesh = this._buildElevationMeshForDrawData(drawData);
            if (elevationMesh !== null) {
                elevationNode.addChild(elevationMesh);
            }
            segmentsContainer.addChild(elevationNode);

            const textureNode = new Container();
            const trackMesh = this._buildTrackMeshForDrawData(drawData);
            if (trackMesh !== null) {
                textureNode.addChild(trackMesh);
            }
            textureNode.visible = this._detailedRenderStyle === 'texture';
            elevationNode.visible = this._detailedRenderStyle === 'elevation';
            segmentsContainer.addChild(textureNode);

            this._detailedStyleNodes.set(key, { elevationNode, textureNode });

            const isConstant = drawData.elevation.from === drawData.elevation.to;
            const hasPositiveElevation =
                drawData.elevation.from > 0 || drawData.elevation.to > 0;

            const shadowResult = hasPositiveElevation
                ? this._buildShadowMesh(
                    drawData.curve, drawData.elevation, this._sunAngle, this._baseShadowLength,
                )
                : null;

            if (shadowResult !== null) {
                const { mesh: shadowMesh, baseVerts, elevationFactors } = shadowResult;

                if (isConstant && hasPositiveElevation) {
                    const shadowLen = this._baseShadowLength * (drawData.elevation.from / 100);
                    // Use base vertices (no baked sun offset); position handles the offset
                    shadowMesh.vertices = new Float32Array(baseVerts);
                    const sunAngleRad = (this._sunAngle * Math.PI) / 180;
                    shadowMesh.position.set(
                        Math.cos(sunAngleRad) * shadowLen,
                        Math.sin(sunAngleRad) * shadowLen,
                    );
                    this._shadowRecords.set(key, {
                        drawData,
                        mesh: shadowMesh,
                        constantElevation: true,
                        shadowLength: shadowLen,
                    });
                } else {
                    this._shadowRecords.set(key, {
                        drawData,
                        mesh: shadowMesh,
                        constantElevation: false,
                        shadowLength: 0,
                        baseVerts,
                        elevationFactors,
                    });
                }

                const shadowElevation = this._worldRenderSystem.resolveElevationLevel(
                    Math.max(drawData.elevation.from, drawData.elevation.to)
                );
                this._worldRenderSystem.addShadow(key, shadowMesh, shadowElevation);
            }

            this._drawableKeys.add(key);
            this._worldRenderSystem.addDrawable(key, segmentsContainer);
        });

        this._reindexDrawData();
    }

    /**
     * Recompute z-indices for all persisted track drawables based on the
     * current draw order from the track curve manager.
     *
     * Also updates the per-band track counts in {@link WorldRenderSystem} so
     * that on-track objects (train bogies, etc.) can be placed above all
     * track drawables in the same elevation band.
     */
    private _reindexDrawData() {
        const drawDataOrder = this._trackCurveManager.persistedDrawData;
        const orderInElevation = new Map<number, number>();
        this._drawDataBandMap.clear();

        // Group draw data by elevation band, then sort within each band
        // by minimum elevation so ramps draw below constant-elevation tracks.
        const bandGroups = new Map<number, { drawData: TrackSegmentDrawData; key: string; minElevation: number }[]>();

        drawDataOrder.forEach((drawData) => {
            const rawElevation = Math.max(drawData.elevation.from, drawData.elevation.to);
            const bandIndex = this._worldRenderSystem.getElevationBandIndex(rawElevation);
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const minElevation = Math.min(drawData.elevation.from, drawData.elevation.to);

            let group = bandGroups.get(bandIndex);
            if (!group) {
                group = [];
                bandGroups.set(bandIndex, group);
            }
            group.push({ drawData, key, minElevation });
        });

        for (const [bandIndex, group] of bandGroups) {
            group.sort((a, b) => a.minElevation - b.minElevation);
            for (let n = 0; n < group.length; n++) {
                const { key } = group[n];
                const zIndex = this._worldRenderSystem.computeZIndex(bandIndex, n);
                this._worldRenderSystem.setDrawableZIndex(key, zIndex);
                this._drawDataBandMap.set(key, bandIndex);
            }
            orderInElevation.set(bandIndex, group.length);
        }

        orderInElevation.forEach((count, bandIndex) => {
            this._worldRenderSystem.setBandTrackCount(bandIndex, count);
        });

        this._worldRenderSystem.sortChildren();
    }

    private _onPreviewDrawDataChange(drawDataList: { index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined) {
        this._latestPreviewDrawDataList = drawDataList;
        this._previewKeys.forEach(key => {
            const container = this._worldRenderSystem.removeDrawable(key);
            container?.destroy({ children: true });
        });
        this._previewKeys = [];

        if (drawDataList == undefined) {
            return;
        }

        drawDataList.forEach(({ drawData, index }, i) => {
            const key = `__preview__${i}`;
            const segmentsContainer = new Container();
            const graphics = new Graphics();
            const arcFanContainer = new Container();
            const positiveOffsetsGraphics = new Graphics();
            const negativeOffsetsGraphics = new Graphics();

            const segments = cutBezierCurveIntoEqualSegments(drawData.curve, drawData.elevation, 1);

            graphics.moveTo(segments[0].point.x, segments[0].point.y);
            for (let i = 1; i < segments.length; i++) {
                graphics.lineTo(segments[i].point.x, segments[i].point.y);
            }
            graphics.stroke({ color: 0x000000, pixelLine: true });

            if (this._showPreviewCurveArcs) {
                // For straight lines, arc fitting is not meaningful (circle radius -> ∞)
                // and can produce noisy results. Skip entirely.
                if (!curveIsNearlyStraight(drawData.curve)) {
                const arcs = drawData.curve.getArcs(0.5);
                for (const arc of arcs) {
                    const a0 = Math.atan2(arc.startPoint.y - arc.center.y, arc.startPoint.x - arc.center.x);
                    const a1 = Math.atan2(arc.endPoint.y - arc.center.y, arc.endPoint.x - arc.center.x);

                    // Choose direction that best matches the curve by sampling a midpoint.
                    const midT = (arc.startT + arc.endT) / 2;
                    const midPoint = drawData.curve.get(midT);
                    const am = Math.atan2(midPoint.y - arc.center.y, midPoint.x - arc.center.x);

                    const cwErr = arcDirectionFitError(arc.center, arc.radius, a0, a1, am, 'cw');
                    const ccwErr = arcDirectionFitError(arc.center, arc.radius, a0, a1, am, 'ccw');
                    const direction: 'cw' | 'ccw' = cwErr <= ccwErr ? 'cw' : 'ccw';

                    const wedge = new Graphics();
                    // Build a "fan" (sector) shape: center -> start -> arc -> back to center.
                    // Use polyline instead of Graphics.arc() to avoid full-circle ambiguity.
                    const span = angleDelta(a0, a1, direction);
                    if (span > Math.PI * 1.9) continue; // Skip near-full-circle arcs
                    wedge.moveTo(arc.center.x, arc.center.y);
                    wedge.lineTo(arc.startPoint.x, arc.startPoint.y);
                    drawArcPolyline(wedge, arc.center, arc.radius, a0, a1, direction);
                    wedge.lineTo(arc.center.x, arc.center.y);
                    wedge.closePath();
                    wedge.fill({ color: 0x1d4ed8, alpha: 0.18 });
                    wedge.stroke({ color: 0x1d4ed8, alpha: 0.55, pixelLine: true, width: 1 });
                    arcFanContainer.addChild(wedge);

                    // CAD-style radius label: position near the arc (not at center).
                    const labelDist = arc.radius * 0.7; // ~70% from center toward arc
                    const midAngle = direction === 'ccw' ? a0 + span / 2 : a0 - span / 2;
                    const labelX = arc.center.x + Math.cos(midAngle) * labelDist;
                    const labelY = arc.center.y + Math.sin(midAngle) * labelDist;
                    const zoomLevel = this._camera.zoomLevel;
                    // Use fixed pixel font + scale container by 1/zoom so text stays crisp and constant screen size.
                    const labelContainer = new Container();
                    labelContainer.position.set(labelX, labelY);
                    labelContainer.scale.set(1 / zoomLevel, 1 / zoomLevel);
                    const radiusLabel = new Text({
                        text: `R ${arc.radius.toFixed(1)}`,
                        style: {
                            fontFamily: 'sans-serif',
                            fontSize: 14,
                            fill: 0x1d4ed8,
                            fontWeight: '600',
                        },
                    });
                    radiusLabel.anchor.set(0.5, 0.5);
                    radiusLabel.position.set(0, 0);
                    labelContainer.addChild(radiusLabel);
                    arcFanContainer.addChild(labelContainer);
                }
                }
            }

            const positiveOffsets = drawData.positiveOffsets;
            const negativeOffsets = drawData.negativeOffsets;

            positiveOffsetsGraphics.moveTo(positiveOffsets[0].x, positiveOffsets[0].y);
            for (let i = 1; i < positiveOffsets.length; i++) {
                positiveOffsetsGraphics.lineTo(positiveOffsets[i].x, positiveOffsets[i].y);
            }
            positiveOffsetsGraphics.stroke({ color: 0x000000, pixelLine: true });

            negativeOffsetsGraphics.moveTo(negativeOffsets[0].x, negativeOffsets[0].y);
            for (let i = 1; i < negativeOffsets.length; i++) {
                negativeOffsetsGraphics.lineTo(negativeOffsets[i].x, negativeOffsets[i].y);
            }
            negativeOffsetsGraphics.stroke({ color: 0x000000, pixelLine: true });

            if (this._showPreviewCurveArcs) {
                // Put the fan wedges behind the preview polyline.
                segmentsContainer.addChild(arcFanContainer);
            }
            segmentsContainer.addChild(graphics);
            segmentsContainer.addChild(positiveOffsetsGraphics);
            segmentsContainer.addChild(negativeOffsetsGraphics);

            this._worldRenderSystem.addDrawable(key, segmentsContainer);
            this._worldRenderSystem.setDrawableZIndex(key, index);
            this._previewKeys.push(key);
        });
    }

    getZIndexOf(drawDataIdentifier: { trackSegmentNumber: number, tValInterval: { start: number, end: number } }): number {
        const key = JSON.stringify(drawDataIdentifier);
        return this._worldRenderSystem.getDrawableZIndex(key);
    }

    /**
     * Return a z-index for an on-track object (e.g. a train bogie) that sits
     * above every track drawable in the same elevation band as the given draw data.
     *
     * @param drawDataIdentifier - Identifier of the draw data the object sits on
     * @returns A z-index above all tracks in that elevation band, or null if the
     *          identifier is unknown
     */
    getOnTrackObjectZIndex(drawDataIdentifier: { trackSegmentNumber: number, tValInterval: { start: number, end: number } }): number | null {
        const key = JSON.stringify(drawDataIdentifier);
        const bandIndex = this._drawDataBandMap.get(key);
        if (bandIndex === undefined) return null;
        return this._worldRenderSystem.computeOnTrackObjectZIndex(bandIndex);
    }
}

const normalizeAngle0ToTau = (a: number): number => {
    const TAU = Math.PI * 2;
    let x = a % TAU;
    if (x < 0) x += TAU;
    return x;
};

const angleDelta = (from: number, to: number, direction: 'cw' | 'ccw'): number => {
    const TAU = Math.PI * 2;
    const a0 = normalizeAngle0ToTau(from);
    const a1 = normalizeAngle0ToTau(to);
    if (direction === 'ccw') {
        // Increase angle (wrapping) from a0 to a1
        return (a1 - a0 + TAU) % TAU;
    }
    // Decrease angle (wrapping) from a0 to a1
    return (a0 - a1 + TAU) % TAU;
};

const drawArcPolyline = (
    g: Graphics,
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    direction: 'cw' | 'ccw',
): void => {
    const span = angleDelta(startAngle, endAngle, direction);
    const steps = Math.max(8, Math.ceil((span * radius) / 8)); // ~1 point per 8px of arc length
    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const a =
            direction === 'ccw'
                ? startAngle + span * t
                : startAngle - span * t;
        const x = center.x + Math.cos(a) * radius;
        const y = center.y + Math.sin(a) * radius;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
};

const arcDirectionFitError = (
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    desiredMidAngle: number,
    direction: 'cw' | 'ccw',
): number => {
    // Compare the mid-angle produced by traversing the arc to the curve’s mid-angle.
    const span = angleDelta(startAngle, endAngle, direction);
    const candidateMidAngle =
        direction === 'ccw'
            ? startAngle + span / 2
            : startAngle - span / 2;
    const a = normalizeAngle0ToTau(candidateMidAngle);
    const b = normalizeAngle0ToTau(desiredMidAngle);
    const d = Math.abs(a - b);
    // Smallest angular distance on circle.
    const TAU = Math.PI * 2;
    const angularDist = Math.min(d, TAU - d);
    // Scale by radius so larger arcs penalize mismatch more.
    return angularDist * radius;
};

const curveIsNearlyStraight = (curve: BCurve): boolean => {
    const cps = curve.getControlPoints();
    if (cps.length < 2) return true;
    const a = cps[0];
    const b = cps[cps.length - 1];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const denom = Math.hypot(ab.x, ab.y);
    if (denom < 1e-6) return true; // Degenerate (all points on top of each other)

    // Max perpendicular distance of control points to the chord AB.
    // If small relative to chord length, treat as straight.
    let maxDist = 0;
    for (let i = 1; i < cps.length - 1; i++) {
        const p = cps[i];
        const ap = { x: p.x - a.x, y: p.y - a.y };
        const cross = Math.abs(ab.x * ap.y - ab.y * ap.x);
        const dist = cross / denom;
        if (dist > maxDist) maxDist = dist;
    }

    // Threshold tuned for world-space coordinates: allow tiny curvature jitter.
    return maxDist / denom < 0.002;
};

type ShadowRecord = {
    drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] };
    mesh: MeshSimple;
    /** True when from === to and elevation > 0 — position-only update is sufficient. */
    constantElevation: boolean;
    /** For constant-elevation entries, the pre-computed shadow length used with the position offset. */
    shadowLength: number;
    /**
     * For varying-elevation shadows: base vertex positions (curve ± ortho * hw,
     * no sun offset) stored flat [x0,y0, x1,y1, …] so sun-angle updates can
     * recompute vertices without re-evaluating the curve.
     */
    baseVerts?: Float32Array;
    /** Per-vertex-pair elevation factor (shadowLength / baseShadowLength) for sun-angle updates. */
    elevationFactors?: Float32Array;
};

const cutBezierCurveIntoEqualSegments = (curve: BCurve, segmentElevation: { from: number, to: number }, length: number) => {
    const segments: { point: Point, elevation: number }[] = [];
    const cps = curve.getControlPoints();
    segments.push({ point: cps[0], elevation: segmentElevation.from });
    const steps = Math.ceil(curve.fullLength / length);
    for (let i = 0; i <= steps; i++) {
        const percentage = i / steps;
        const point = curve.getPointbyPercentage(percentage);
        const elevation = segmentElevation.from + (segmentElevation.to - segmentElevation.from) * percentage;
        segments.push({ point, elevation });
    }
    return segments;
}

/** RGB components 0–255 for interpolation. */
export type Rgb = { r: number; g: number; b: number };

const rgbToHex = (rgb: Rgb): number =>
    (Math.round(rgb.r) << 16) | (Math.round(rgb.g) << 8) | Math.round(rgb.b);

/**
 * Linear interpolation between two RGB colors.
 * @param a - Start color
 * @param b - End color
 * @param t - Interpolation factor in [0, 1]
 * @returns Interpolated RGB
 */
export const interpolateRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
});

const findElevationColorStop = (elevation: number): Rgb => {
    const interval = findElevationInterval(elevation);
    if (interval === null) {
        return { r: 0, g: 0, b: 0 };
    }

    return interpolateRgb(getElevationColorRgb(interval.interval[0]), getElevationColorRgb(interval.interval[1]), interval.ratio);
};

/** Elevation colors as RGB (0–255) for interpolation. */
export const getElevationColorRgb = (elevation: ELEVATION): Rgb => {
    switch (elevation) {
        case ELEVATION.SUB_3:
            return { r: 255, g: 0, b: 0 };
        case ELEVATION.SUB_2:
            return { r: 255, g: 165, b: 0 };
        case ELEVATION.SUB_1:
            return { r: 255, g: 255, b: 0 };
        case ELEVATION.GROUND:
            return { r: 0, g: 255, b: 0 };
        case ELEVATION.ABOVE_1:
            return { r: 0, g: 255, b: 255 };
        case ELEVATION.ABOVE_2:
            return { r: 255, g: 0, b: 255 };
        case ELEVATION.ABOVE_3:
            return { r: 0, g: 0, b: 255 };
        default:
            return { r: 128, g: 128, b: 128 };
    }
};

/** Seeded RNG for deterministic procedural texture (mulberry32-style). */
function seededRng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const getProjectionTypeColor = (type: ProjectionPositiveResult['hitType']): number => {
    switch (type) {
        case 'joint':
            return 0x3BA429;
        case 'curve':
            return 0xB23737;
        case 'edge':
            return 0x2711EE;
    }
};
