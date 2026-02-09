import { Container, Graphics } from 'pixi.js';
import { TrackCurveManager } from './trackcurve-manager';
import { BCurve } from '@ue-too/curve';
import { Point } from '@ue-too/math';
import { CurveCreationEngine } from '../input-state-machine';


const PREVIEW_DRAW_DATA_KEY = 'preview-draw-data';
export class TrackRenderSystem {

    private _container: Container;
    private _trackCurveManager: TrackCurveManager;
    private _drawDataMap: Map<string, Graphics> = new Map();

    private _previewGraphics: Graphics[] = [];

    get container(): Container {
        return this._container;
    }

    constructor(trackCurveManager: TrackCurveManager, curveCreationEngine: CurveCreationEngine) {
        this._container = new Container();
        this._trackCurveManager = trackCurveManager;
        this._trackCurveManager.onDelete((key) => {
            const graphics = this._drawDataMap.get(key);
            if (graphics !== undefined) {
                graphics.destroy({ children: true });
                this._drawDataMap.delete(key);
                this._container.removeChild(graphics);
            }

            const drawDataOrder = this._trackCurveManager.persistedDrawData;

            drawDataOrder.forEach((drawData, index) => {
                const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
                const graphics = this._drawDataMap.get(key);
                if (graphics !== undefined) {
                    graphics.zIndex = index;
                }
            });
            this._container.sortChildren();
        });


        this._trackCurveManager.onAdd((index, drawData) => {
            const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
            const graphics = new Graphics();
            const segments = cutBezierCurveIntoEqualSegments(drawData.curve, 1);
            graphics.moveTo(segments[0].x, segments[0].y);
            for (let i = 1; i < segments.length; i++) {
                graphics.lineTo(segments[i].x, segments[i].y);
            }

            // bezier curve steps too big looks like straight lines connected
            // const cps = drawData.curve.getControlPoints();
            // graphics.moveTo(cps[0].x, cps[0].y);
            // if (cps.length === 3) {
            //     graphics.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
            // } else if (cps.length === 4) {
            //     graphics.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
            // }
            graphics.stroke({ color: 0x000000, pixelLine: true });
            this._drawDataMap.set(key, graphics);
            this._container.addChild(graphics);

            const drawDataOrder = this._trackCurveManager.persistedDrawData;

            drawDataOrder.forEach((drawData, index) => {
                const key = JSON.stringify({ trackSegmentNumber: drawData.originalTrackSegment.trackSegmentNumber, tValInterval: drawData.originalTrackSegment.tValInterval });
                const graphics = this._drawDataMap.get(key);
                if (graphics !== undefined) {
                    graphics.zIndex = index;
                }
            });
            this._container.sortChildren();
        });

        curveCreationEngine.onPreviewDrawDataChange(drawDataList => {
            this._previewGraphics.forEach(graphics => {
                this._container.removeChild(graphics);
                graphics.destroy({ children: true });
            });
            this._previewGraphics = [];

            drawDataList?.forEach(({ index, drawData }) => {
                const graphics = new Graphics();
                graphics.zIndex = index;

                const segments = cutBezierCurveIntoEqualSegments(drawData.curve, 1);
                graphics.moveTo(segments[0].x, segments[0].y);
                for (let i = 1; i < segments.length; i++) {
                    graphics.lineTo(segments[i].x, segments[i].y);
                }
                graphics.stroke({ color: 0x000000, pixelLine: true });
                this._container.addChild(graphics);
                this._previewGraphics.push(graphics);
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

const cutBezierCurveIntoEqualSegments = (curve: BCurve, length: number) => {
    const segments: Point[] = [];
    const cps = curve.getControlPoints();
    segments.push(cps[0]);
    let tVal = 0;
    while (tVal < 1) {
        const res = curve.advanceAtTWithLength(tVal, length);
        if (res.type === 'withinCurve') {
            segments.push(res.point);
            tVal = res.tVal;
        } else if (res.type === 'afterCurve') {
            segments.push(cps[cps.length - 1]);
            break;
        } else if (res.type === 'beforeCurve') {
            console.warn('cutting bezier curve into equal segments failed, tVal is less than 0');
            break;
        }
    }
    return segments;
}
