import { Container, Graphics } from 'pixi.js';
import { TrackSegmentDrawData } from './types';
import { TrackGraph } from './track';
import { TrackCurveManager } from './trackcurve-manager';

export class TrackRenderSystem {

    private _container: Container;
    private _trackCurveManager: TrackCurveManager;
    private _drawDataMap: Map<string, Graphics> = new Map();

    get container(): Container {
        return this._container;
    }

    constructor(trackCurveManager: TrackCurveManager) {
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
            const cps = drawData.curve.getControlPoints();
            graphics.moveTo(cps[0].x, cps[0].y);
            if (cps.length === 3) {
                graphics.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
            } else if (cps.length === 4) {
                graphics.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
            }
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
    }
}
