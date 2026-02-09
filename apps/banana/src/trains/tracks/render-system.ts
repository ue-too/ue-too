import { Container, FillGradient, Graphics } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve } from '@ue-too/curve';
import { Point } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';
import { ELEVATION } from './types';
import { LEVEL_HEIGHT } from './constants';

export class TrackRenderSystem {

    private _container: Container;
    private _trackCurveManager: TrackCurveManager;
    private _drawDataMap: Map<string, Container> = new Map();

    private _previewGraphics: Container[] = [];

    get container(): Container {
        return this._container;
    }

    constructor(trackCurveManager: TrackCurveManager, curveCreationEngine: CurveCreationEngine) {
        this._container = new Container();
        this._trackCurveManager = trackCurveManager;
        this._trackCurveManager.onDelete((key) => {
            const segmentsContainer = this._drawDataMap.get(key);
            if (segmentsContainer !== undefined) {
                segmentsContainer.destroy({ children: true });
                this._drawDataMap.delete(key);
                this._container.removeChild(segmentsContainer);
            }

            const drawDataOrder = this._trackCurveManager.persistedDrawData;

            drawDataOrder.forEach((drawData, index) => {
                const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
                const segmentsContainer = this._drawDataMap.get(key);
                if (segmentsContainer !== undefined) {
                    segmentsContainer.zIndex = index;
                }
            });
            this._container.sortChildren();
        });


        this._trackCurveManager.onAdd((index, drawData) => {
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
                graphics.stroke({ fill: gradient, pixelLine: true });
                segmentsContainer.addChild(graphics);
            }

            const positiveOffsetsGraphics = new Graphics();
            positiveOffsetsGraphics.moveTo(positiveOffsets[0].x, positiveOffsets[0].y);
            for (let i = 1; i < positiveOffsets.length; i++) {
                positiveOffsetsGraphics.lineTo(positiveOffsets[i].x, positiveOffsets[i].y);
            }
            positiveOffsetsGraphics.stroke({ color: 0x000000, pixelLine: true });

            const negativeOffsetsGraphics = new Graphics();
            negativeOffsetsGraphics.moveTo(negativeOffsets[0].x, negativeOffsets[0].y);
            for (let i = 1; i < negativeOffsets.length; i++) {
                negativeOffsetsGraphics.lineTo(negativeOffsets[i].x, negativeOffsets[i].y);
            }
            negativeOffsetsGraphics.stroke({ color: 0x000000, pixelLine: true });

            segmentsContainer.addChild(positiveOffsetsGraphics);
            segmentsContainer.addChild(negativeOffsetsGraphics);
            this._drawDataMap.set(key, segmentsContainer);
            this._container.addChild(segmentsContainer);

            const drawDataOrder = this._trackCurveManager.persistedDrawData;

            drawDataOrder.forEach((drawData, index) => {
                const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
                const segmentsContainer = this._drawDataMap.get(key);
                if (segmentsContainer !== undefined) {
                    segmentsContainer.zIndex = index;
                }
            });
            this._container.sortChildren();
        });

        curveCreationEngine.onPreviewDrawDataChange(drawDataList => {
            this._previewGraphics.forEach(container => {
                this._container.removeChild(container);
                container.destroy({ children: true });
            });
            this._previewGraphics = [];

            drawDataList?.forEach(({ index, drawData }) => {
                const segmentsContainer = new Container();
                const graphics = new Graphics();
                const positiveOffsetsGraphics = new Graphics();
                const negativeOffsetsGraphics = new Graphics();

                segmentsContainer.zIndex = index;

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
                this._container.addChild(segmentsContainer);
                this._previewGraphics.push(segmentsContainer);
            });
        });
    }

    getZIndexOf(drawDataIdentifier: { trackSegmentNumber: number, tValInterval: { start: number, end: number } }): number {
        const key = JSON.stringify(drawDataIdentifier);
        const drawData = this._drawDataMap.get(key);
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

const getElevationColor = (elevation: ELEVATION): number => rgbToHex(getElevationColorRgb(elevation));
