import { Container, Ellipse, FillGradient, Graphics } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve, offset2 } from '@ue-too/curve';
import { Point } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';
import { ELEVATION, ELEVATION_VALUES, ProjectionPositiveResult, TrackSegmentDrawData, TrackSegmentWithCollision } from './types';
import { LEVEL_HEIGHT } from './constants';
import { shadows } from '@/utils';

/** zIndex range per elevation so shadow at elevation E draws after segments at elevations < E. */
const LAYERS_PER_ELEVATION = 1000;

const getElevationIndex = (elevation: ELEVATION): number => {
    const i = ELEVATION_VALUES.indexOf(elevation);
    return i >= 0 ? i : 0;
};

/** Elevation layer for draw order: use upper bound when between levels so higher-elevation shadow draws on top of lower-elevation gradient. */
const getElevationForLayer = (
    interval: { interval: [ELEVATION, ELEVATION]; ratio: number } | null
): ELEVATION =>
    interval
        ? interval.ratio > 0
            ? interval.interval[1]
            : interval.interval[0]
        : ELEVATION.GROUND;

export class TrackRenderSystem {

    private _mainContainer: Container;
    private _trackDrawDataContainer: Container;
    private _trackOffsetContainer: Container;
    private _topLevelContainer: Container;
    private _trackCurveManager: TrackCurveManager;
    private _drawDataSplitsMap: Map<string, Container> = new Map();
    private _offsetGraphicsMap: Map<number, Container> = new Map();
    private _shadowGraphicsMap: Map<string, { graphics: Graphics, elevation: ELEVATION }> = new Map();
    private _shadowGraphicsContainerMap: Map<ELEVATION, Container> = new Map();

    private _previewGraphics: Container[] = [];

    private _previewStartProjection: Graphics = new Graphics();
    private _previewEndProjection: Graphics = new Graphics();

    private _abortController: AbortController = new AbortController();

    get container(): Container {
        return this._mainContainer;
    }

    constructor(trackCurveManager: TrackCurveManager, curveCreationEngine: CurveCreationEngine) {
        this._mainContainer = new Container();
        this._topLevelContainer = new Container();
        this._trackDrawDataContainer = new Container();
        this._trackDrawDataContainer.sortableChildren = true;
        this._trackOffsetContainer = new Container();
        this._mainContainer.addChild(this._trackDrawDataContainer);
        this._mainContainer.addChild(this._trackOffsetContainer);
        this._mainContainer.addChild(this._topLevelContainer);
        this._trackCurveManager = trackCurveManager;

        this._trackCurveManager.onDelete(this._onDelete.bind(this), { signal: this._abortController.signal });
        this._trackCurveManager.onAdd(this._onNewTrackData.bind(this), { signal: this._abortController.signal });
        curveCreationEngine.onPreviewDrawDataChange(this._onPreviewDrawDataChange.bind(this), { signal: this._abortController.signal });

        /** start projection point */
        this._previewStartProjection.visible = false;
        this._previewEndProjection.visible = false;

        this._previewStartProjection.arc(0, 0, 1, 0, 2 * Math.PI);
        this._previewStartProjection.pivot.set(this._previewStartProjection.width / 2, this._previewStartProjection.height / 2);
        this._previewStartProjection.fill({ color: 0xFFFFFF });
        this._topLevelContainer.addChild(this._previewStartProjection);

        curveCreationEngine.onPreviewStartProjectionChange(this._onPreviewStartChange.bind(this), { signal: this._abortController.signal });
        /** start projection point */

        /** end projection point */
        this._previewEndProjection.visible = false;
        this._previewEndProjection.arc(0, 0, 1, 0, 2 * Math.PI);
        this._previewEndProjection.pivot.set(this._previewEndProjection.width / 2, this._previewEndProjection.height / 2);
        this._previewEndProjection.fill({ color: 0xFFFFFF });
        this._topLevelContainer.addChild(this._previewEndProjection);

        curveCreationEngine.onPreviewEndProjectionChange(this._onPreviewEndChange.bind(this), { signal: this._abortController.signal });
        /** end projection point */


        this._trackCurveManager.onAddTrackSegment(this._onAddTrackSegment.bind(this), { signal: this._abortController.signal });
        this._trackCurveManager.onRemoveTrackSegment(this._onRemoveTrackSegment.bind(this), { signal: this._abortController.signal });

        // Shadow at elevation E gets zIndex E*LAYERS_PER_ELEVATION so it draws after segments at lower elevations
        ELEVATION_VALUES.forEach((elevation, i) => {
            const container = new Container();
            container.zIndex = i * LAYERS_PER_ELEVATION;
            this._trackDrawDataContainer.addChild(container);
            this._shadowGraphicsContainerMap.set(elevation, container);
        });
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
        this._previewGraphics.forEach(container => {
            this._trackDrawDataContainer.removeChild(container);
            container.destroy({ children: true });
        });
        this._previewGraphics = [];
        this._drawDataSplitsMap.forEach(container => {
            this._trackDrawDataContainer.removeChild(container);
            container.destroy({ children: true });
        });
        this._drawDataSplitsMap.clear();
        this._trackDrawDataContainer.destroy({ children: true });
        this._previewStartProjection.destroy();
        this._previewEndProjection.destroy();
        this._trackOffsetContainer.destroy({ children: true });
        this._mainContainer.destroy({ children: true });
    }

    private _onDelete(key: string) {
        const segmentsContainer = this._drawDataSplitsMap.get(key);
        if (segmentsContainer !== undefined) {
            segmentsContainer.destroy({ children: true });
            this._drawDataSplitsMap.delete(key);
            this._trackDrawDataContainer.removeChild(segmentsContainer);
        }

        const shadowGraphics = this._shadowGraphicsMap.get(key);
        if (shadowGraphics !== undefined) {
            shadowGraphics.graphics.destroy({ children: true });
            this._shadowGraphicsContainerMap.get(shadowGraphics.elevation)?.removeChild(shadowGraphics.graphics);
            this._shadowGraphicsMap.delete(key);
        }

        const drawDataOrder = this._trackCurveManager.persistedDrawData;
        const orderInElevation = new Map<number, number>();

        drawDataOrder.forEach((drawData) => {
            const interval = findElevationInterval(Math.max(drawData.elevation.from, drawData.elevation.to));
            const elevationForSegment = getElevationForLayer(interval);
            const elevationIndex = getElevationIndex(elevationForSegment);
            const n = orderInElevation.get(elevationIndex) ?? 0;
            orderInElevation.set(elevationIndex, n + 1);
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const segmentsContainer = this._drawDataSplitsMap.get(key);
            if (segmentsContainer !== undefined) {
                segmentsContainer.zIndex = elevationIndex * LAYERS_PER_ELEVATION + 1 + n;
            }
        });
        this._trackDrawDataContainer.sortChildren();
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
            const positiveOffsets = drawData.positiveOffsets;
            const negativeOffsets = drawData.negativeOffsets;

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


            const elevationInterval = findElevationInterval(Math.max(drawData.elevation.from, drawData.elevation.to));
            const elevationForLayer = getElevationForLayer(elevationInterval);

            const shadowGraphicsContainer = this._shadowGraphicsContainerMap.get(elevationForLayer);
            if (shadowGraphicsContainer !== undefined) {
                shadowGraphicsContainer.addChild(shadowGraphics);
            }

            this._shadowGraphicsMap.set(key, { graphics: shadowGraphics, elevation: elevationForLayer });
            this._drawDataSplitsMap.set(key, segmentsContainer);
            this._trackDrawDataContainer.addChild(segmentsContainer);
        });

        const drawDataOrder = this._trackCurveManager.persistedDrawData;
        const orderInElevation = new Map<number, number>();

        drawDataOrder.forEach((drawData) => {
            const interval = findElevationInterval(Math.max(drawData.elevation.from, drawData.elevation.to));
            const elevationForSegment = getElevationForLayer(interval);
            const elevationIndex = getElevationIndex(elevationForSegment);
            const n = orderInElevation.get(elevationIndex) ?? 0;
            orderInElevation.set(elevationIndex, n + 1);
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const segmentsContainer = this._drawDataSplitsMap.get(key);
            if (segmentsContainer !== undefined) {
                segmentsContainer.zIndex = elevationIndex * LAYERS_PER_ELEVATION + 1 + n;
            }
        });
        this._trackDrawDataContainer.sortChildren();
    }

    private _onPreviewDrawDataChange(drawDataList: { index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] | undefined) {
        this._previewGraphics.forEach(container => {
            this._trackDrawDataContainer.removeChild(container);
            container.destroy({ children: true });
        });
        this._previewGraphics = [];

        if (drawDataList == undefined) {
            return;
        }

        drawDataList.forEach(({ drawData, index }) => {
            const segmentsContainer = new Container();
            const graphics = new Graphics();
            const positiveOffsetsGraphics = new Graphics();
            const negativeOffsetsGraphics = new Graphics();

            const segments = cutBezierCurveIntoEqualSegments(drawData.curve, drawData.elevation, 1);
            // const zIndex = trackSegmentDrawDataInsertIndex(this._trackCurveManager.persistedDrawData, drawData);

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
            segmentsContainer.zIndex = index;
            this._trackDrawDataContainer.addChild(segmentsContainer);
            this._previewGraphics.push(segmentsContainer);
        });
    }

    getZIndexOf(drawDataIdentifier: { trackSegmentNumber: number, tValInterval: { start: number, end: number } }): number {
        const key = JSON.stringify(drawDataIdentifier);
        const drawData = this._drawDataSplitsMap.get(key);
        if (drawData === undefined) {
            return 0;
        }
        return drawData.zIndex;
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

const findElevationInterval = (elevation: number): { interval: [ELEVATION, ELEVATION], ratio: number } | null => {
    const elevations = Object.values(ELEVATION).filter((v): v is number => typeof v === "number");
    let left = 0;
    let right = elevations.length - 1;
    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);
        const midValue = elevations[mid];
        if (midValue * LEVEL_HEIGHT <= elevation && mid + 1 < elevations.length && elevations[mid + 1] * LEVEL_HEIGHT >= elevation) {
            return { interval: [elevations[mid], elevations[mid + 1]], ratio: (elevation - midValue * LEVEL_HEIGHT) / (elevations[mid + 1] * LEVEL_HEIGHT - midValue * LEVEL_HEIGHT) };
        } else if (elevation < midValue * LEVEL_HEIGHT) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    return null;
};

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
