import { Container, FillGradient, Graphics, MeshSimple, Texture } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve, offset2 } from '@ue-too/curve';
import { Point, PointCal } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';
import { ELEVATION, ProjectionPositiveResult, TrackSegmentDrawData, TrackSegmentWithCollision } from './types';
import { shadows, clearShadowCache } from '@/utils';
import { WorldRenderSystem, findElevationInterval } from '@/world-render-system';
import { CameraState, CameraZoomEventPayload, ObservableBoardCamera } from '@ue-too/board';

/** Zoom level above which detailed track draw data is shown; below this only the bezier curve is drawn. */
const ZOOM_THRESHOLD_DETAILED_TRACK = 5;

/** How to render detailed track draw data: elevation-colored segments + offset rails, or a single tiled texture along the curve. */
export type DetailedTrackRenderStyle = 'elevation' | 'texture';

/** World-space length (meters when 1px = 1m) per one repeat of the track texture along the curve. ~0.6m matches typical tie spacing. */
const TRACK_TEXTURE_TILE_LEN = 0.6;

/** Resolution of the procedural track segment texture (power-of-two for repeat wrap). */
const TRACK_TEX_SIZE = 64;

/** Renderer (or app) that provides texture generation for the texture-style track. */
type TrackTextureRenderer = {
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

    private _sunAngle: number = 135;
    private _baseShadowLength: number = 10;

    private _camera: ObservableBoardCamera;

    /** Optional renderer for generating track texture (required for texture render style). */
    private _textureRenderer: TrackTextureRenderer | null = null;

    /** How to draw detailed track: elevation-colored segments or tiled texture. */
    private _detailedRenderStyle: DetailedTrackRenderStyle = 'elevation';

    /** Cached procedural track texture; created lazily when texture style is used. */
    private _trackTexture: Texture | null = null;

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

        worldRenderSystem.addOverlayContainer(this._trackOffsetContainer);
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

    private _onZoom(_event: CameraZoomEventPayload, cameraState: CameraState) {
        this._applyZoomLod(cameraState.zoomLevel);
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
            record.graphics.visible = useDetailed;
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

        for (const [, record] of this._shadowRecords) {
            if (record.constantElevation) {
                record.graphics.position.set(
                    Math.cos(sunAngleRad) * record.shadowLength,
                    Math.sin(sunAngleRad) * record.shadowLength,
                );
            } else {
                record.graphics.clear();
                const shadowPoints = shadows(record.drawData, this._sunAngle, this._baseShadowLength);
                if (shadowPoints.positive.length > 0 && shadowPoints.negative.length > 0) {
                    drawShadowPolygon(record.graphics, shadowPoints);
                }
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

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = curve.getPointbyPercentage(t);
            const derivative = curve.derivativeByPercentage(t);
            const tangent = PointCal.unitVector(derivative);
            const nx = -tangent.y;
            const ny = tangent.x;

            if (i > 0) {
                const prev = curve.getPointbyPercentage((i - 1) / steps);
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
            const segments = cutBezierCurveIntoEqualSegments(drawData.curve, drawData.elevation, 1);
            for (let i = 0; i < segments.length - 1; i++) {
                const graphics = new Graphics();
                graphics.moveTo(segments[i].point.x, segments[i].point.y);
                graphics.lineTo(segments[i + 1].point.x, segments[i + 1].point.y);
                const gradient = strokeGradientForElevation(segments[i].point, segments[i + 1].point, segments[i].elevation, segments[i + 1].elevation);
                graphics.stroke({ fill: gradient, width: drawData.gauge });
                elevationNode.addChild(graphics);
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

            const shadowGraphics = new Graphics();
            const isConstant = drawData.elevation.from === drawData.elevation.to;
            const hasPositiveElevation =
                drawData.elevation.from > 0 || drawData.elevation.to > 0;

            if (isConstant && hasPositiveElevation) {
                const edgePoints = computeShadowEdgePolygon(drawData);
                drawShadowPolygon(shadowGraphics, edgePoints);

                const shadowLen = this._baseShadowLength * (drawData.elevation.from / 100);
                const sunAngleRad = (this._sunAngle * Math.PI) / 180;
                shadowGraphics.position.set(
                    Math.cos(sunAngleRad) * shadowLen,
                    Math.sin(sunAngleRad) * shadowLen,
                );

                this._shadowRecords.set(key, {
                    drawData,
                    graphics: shadowGraphics,
                    constantElevation: true,
                    shadowLength: shadowLen,
                });
            } else {
                const shadowPoints = shadows(drawData, this._sunAngle, this._baseShadowLength);
                if (shadowPoints.positive.length > 0 && shadowPoints.negative.length > 0) {
                    drawShadowPolygon(shadowGraphics, shadowPoints);
                }

                this._shadowRecords.set(key, {
                    drawData,
                    graphics: shadowGraphics,
                    constantElevation: false,
                    shadowLength: 0,
                });
            }

            const shadowElevation = this._worldRenderSystem.resolveElevationLevel(
                Math.max(drawData.elevation.from, drawData.elevation.to)
            );
            this._worldRenderSystem.addShadow(key, shadowGraphics, shadowElevation);

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

        drawDataOrder.forEach((drawData) => {
            const rawElevation = Math.max(drawData.elevation.from, drawData.elevation.to);
            const bandIndex = this._worldRenderSystem.getElevationBandIndex(rawElevation);
            const n = orderInElevation.get(bandIndex) ?? 0;
            orderInElevation.set(bandIndex, n + 1);
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const zIndex = this._worldRenderSystem.computeZIndex(bandIndex, n);
            this._worldRenderSystem.setDrawableZIndex(key, zIndex);
            this._drawDataBandMap.set(key, bandIndex);
        });

        orderInElevation.forEach((count, bandIndex) => {
            this._worldRenderSystem.setBandTrackCount(bandIndex, count);
        });

        this._worldRenderSystem.sortChildren();
    }

    private _onPreviewDrawDataChange(drawDataList: { index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined) {
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
            const positiveOffsetsGraphics = new Graphics();
            const negativeOffsetsGraphics = new Graphics();

            const segments = cutBezierCurveIntoEqualSegments(drawData.curve, drawData.elevation, 1);

            graphics.moveTo(segments[0].point.x, segments[0].point.y);
            for (let i = 1; i < segments.length; i++) {
                graphics.lineTo(segments[i].point.x, segments[i].point.y);
            }
            graphics.stroke({ color: 0x000000, pixelLine: true });

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

type ShadowRecord = {
    drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] };
    graphics: Graphics;
    /** True when from === to and elevation > 0 — position-only update is sufficient. */
    constantElevation: boolean;
    /** For constant-elevation entries, the pre-computed shadow length used with the position offset. */
    shadowLength: number;
};

/**
 * Draw a closed shadow polygon from positive and negative edge arrays.
 * Traces the positive edge forward, then the negative edge in reverse.
 */
const drawShadowPolygon = (
    graphics: Graphics,
    points: { positive: Point[]; negative: Point[] },
): void => {
    graphics.moveTo(points.positive[0].x, points.positive[0].y);
    for (let i = 1; i < points.positive.length; i++) {
        graphics.lineTo(points.positive[i].x, points.positive[i].y);
    }
    graphics.lineTo(
        points.negative[points.negative.length - 1].x,
        points.negative[points.negative.length - 1].y,
    );
    for (let i = points.negative.length - 2; i >= 0; i--) {
        graphics.lineTo(points.negative[i].x, points.negative[i].y);
    }
    graphics.closePath();
    graphics.fill({ color: 0x000000 });
};

/**
 * Compute the shadow edge polygon (track edges offset by half the standard
 * gauge) **without** any sun-angle translation. The caller applies the
 * sun offset via `graphics.position`, so the polygon shape is reusable
 * across angle changes.
 */
const computeShadowEdgePolygon = (
    trackSegment: TrackSegmentDrawData,
    steps: number = 10,
): { positive: Point[]; negative: Point[] } => {
    const trackHalfWidth = 1.067 / 2;
    const positive: Point[] = [];
    const negative: Point[] = [];

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = trackSegment.curve.getPointbyPercentage(t);
        const tangent = PointCal.unitVector(
            trackSegment.curve.derivativeByPercentage(t),
        );
        const ortho: Point = { x: -tangent.y, y: tangent.x };

        positive.push({
            x: point.x + ortho.x * trackHalfWidth,
            y: point.y + ortho.y * trackHalfWidth,
        });
        negative.push({
            x: point.x - ortho.x * trackHalfWidth,
            y: point.y - ortho.y * trackHalfWidth,
        });
    }

    return { positive, negative };
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

/**
 * Creates a linear gradient for a stroke from path start to end, colored by elevation.
 * Uses PixiJS global texture space so the gradient runs along the path.
 */
const strokeGradientForElevation = (
    start: Point,
    end: Point,
    elevationFrom: ELEVATION,
    elevationTo: ELEVATION
): FillGradient => {
    return new FillGradient({
        type: 'linear',
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        colorStops: [
            { offset: 0, color: rgbToHex(findElevationColorStop(elevationFrom)) },
            { offset: 1, color: rgbToHex(findElevationColorStop(elevationTo)) },
        ],
        textureSpace: 'global',
    });
};


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
