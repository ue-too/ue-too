import { Container, FillGradient, Graphics } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve, offset2 } from '@ue-too/curve';
import { Point } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';
import { ELEVATION, ProjectionPositiveResult, TrackSegmentDrawData, TrackSegmentWithCollision } from './types';
import { shadows } from '@/utils';
import { WorldRenderSystem, findElevationInterval } from '@/world-render-system';

export class TrackRenderSystem {

    private _worldRenderSystem: WorldRenderSystem;
    private _trackOffsetContainer: Container;
    private _topLevelContainer: Container;
    private _trackCurveManager: TrackCurveManager;
    private _offsetGraphicsMap: Map<number, Container> = new Map();

    /** Keys of drawables registered with the WorldRenderSystem by this renderer. */
    private _drawableKeys: Set<string> = new Set();

    /** Keys of preview drawables (ephemeral, re-created on each preview change). */
    private _previewKeys: string[] = [];

    private _previewStartProjection: Graphics = new Graphics();
    private _previewEndProjection: Graphics = new Graphics();

    private _abortController: AbortController = new AbortController();

    constructor(worldRenderSystem: WorldRenderSystem, trackCurveManager: TrackCurveManager, curveCreationEngine: CurveCreationEngine) {
        this._worldRenderSystem = worldRenderSystem;
        this._topLevelContainer = new Container();
        this._trackOffsetContainer = new Container();

        worldRenderSystem.addOverlayContainer(this._trackOffsetContainer);
        worldRenderSystem.addOverlayContainer(this._topLevelContainer);

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

        this._previewStartProjection.destroy();
        this._previewEndProjection.destroy();

        this._worldRenderSystem.removeOverlayContainer(this._trackOffsetContainer);
        this._trackOffsetContainer.destroy({ children: true });

        this._worldRenderSystem.removeOverlayContainer(this._topLevelContainer);
        this._topLevelContainer.destroy({ children: true });

        this._offsetGraphicsMap.clear();
    }

    private _onDelete(key: string) {
        const container = this._worldRenderSystem.removeDrawable(key);
        if (container !== undefined) {
            container.destroy({ children: true });
            this._drawableKeys.delete(key);
        }

        this._worldRenderSystem.removeShadow(key);

        this._reindexDrawData();
    }

    private _onRemoveTrackSegment(curveNumber: number) {
        const segmentsContainer = this._offsetGraphicsMap.get(curveNumber);
        if (segmentsContainer !== undefined) {
            this._trackOffsetContainer.removeChild(segmentsContainer);
            segmentsContainer.destroy({ children: true });
            this._offsetGraphicsMap.delete(curveNumber);
        }
    }

    private _onAddTrackSegment(curveNumber: number, trackSegment: TrackSegmentWithCollision) {
        const positiveOffsets = offset2(trackSegment.curve, trackSegment.gauge / 2).points;
        const negativeOffsets = offset2(trackSegment.curve, -trackSegment.gauge / 2).points;

        const segmentsContainer = new Container();

        const positiveOffsetsGraphics = new Graphics();
        const negativeOffsetsGraphics = new Graphics();

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
    }

    private _onNewTrackData(index: number, drawDataList: (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[]) {

        drawDataList.forEach((drawData) => {
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });

            const segmentsContainer = new Container();

            const segments = cutBezierCurveIntoEqualSegments(drawData.curve, drawData.elevation, 1);
            for (let i = 0; i < segments.length - 1; i++) {
                const graphics = new Graphics();
                graphics.moveTo(segments[i].point.x, segments[i].point.y);
                graphics.lineTo(segments[i + 1].point.x, segments[i + 1].point.y);
                const gradient = strokeGradientForElevation(segments[i].point, segments[i + 1].point, segments[i].elevation, segments[i + 1].elevation);
                graphics.stroke({ fill: gradient, width: drawData.gauge });
                segmentsContainer.addChild(graphics);
            }

            const shadowGraphics = new Graphics();

            const shadowPoints = shadows(drawData, 135, 10);

            if (shadowPoints.positive.length > 0 && shadowPoints.negative.length > 0) {
                shadowGraphics.moveTo(shadowPoints.positive[0].x, shadowPoints.positive[0].y);
                for (let i = 1; i < shadowPoints.positive.length; i++) {
                    shadowGraphics.lineTo(shadowPoints.positive[i].x, shadowPoints.positive[i].y);
                }
                shadowGraphics.lineTo(shadowPoints.negative[shadowPoints.negative.length - 1].x, shadowPoints.negative[shadowPoints.negative.length - 1].y);
                for (let i = shadowPoints.negative.length - 2; i >= 0; i--) {
                    shadowGraphics.lineTo(shadowPoints.negative[i].x, shadowPoints.negative[i].y);
                }
                shadowGraphics.closePath();

                shadowGraphics.fill({ color: 0x000000 });

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
     */
    private _reindexDrawData() {
        const drawDataOrder = this._trackCurveManager.persistedDrawData;
        const orderInElevation = new Map<number, number>();

        drawDataOrder.forEach((drawData) => {
            const rawElevation = Math.max(drawData.elevation.from, drawData.elevation.to);
            const bandIndex = this._worldRenderSystem.getElevationBandIndex(rawElevation);
            const n = orderInElevation.get(bandIndex) ?? 0;
            orderInElevation.set(bandIndex, n + 1);
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const zIndex = this._worldRenderSystem.computeZIndex(bandIndex, n);
            this._worldRenderSystem.setDrawableZIndex(key, zIndex);
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
}

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
    console.log('gradient', rgbToHex(findElevationColorStop(elevationFrom)), rgbToHex(findElevationColorStop(elevationTo)));
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
