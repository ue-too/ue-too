import { BaseContext } from "@ue-too/being";
import { Canvas } from "./kmt-input-context";

/**
 * @description The touch points.
 *
 * @category Input State Machine
 */
export type TouchPoints = {
    ident: number,
    x: number,
    y: number,
}

export interface TouchContext extends BaseContext{
    addTouchPoints: (points: TouchPoints[]) => void;
    removeTouchPoints: (idents: number[]) => void;
    getCurrentTouchPointsCount: () => number;
    getInitialTouchPointsPositions: (idents: number[]) => TouchPoints[];
    updateTouchPoints: (pointsMoved: TouchPoints[]) => void;
    alignCoordinateSystem: boolean;
    canvas: Canvas;
}

export class TouchInputTracker implements TouchContext {

    private _touchPointsMap: Map<number, TouchPoints> = new Map<number, TouchPoints>();
    private _canvas: Canvas;
    private _alignCoordinateSystem: boolean;

    constructor(canvas: Canvas) {
        this._canvas = canvas;
        this._alignCoordinateSystem = true;
    }

    addTouchPoints(points: TouchPoints[]): void {
        points.forEach((point)=>{
            this._touchPointsMap.set(point.ident, {...point});
        });
    }

    removeTouchPoints(identifiers: number[]): void {
        identifiers.forEach((ident)=>{
            if(this._touchPointsMap.has(ident)){
                this._touchPointsMap.delete(ident);
            }
        });
    }

    getCurrentTouchPointsCount(): number {
        return this._touchPointsMap.size;
    }

    getInitialTouchPointsPositions(idents: number[]): TouchPoints[] {
        const res: TouchPoints[] = [];
        idents.forEach((ident)=>{
            if(this._touchPointsMap.has(ident)){
                const point = this._touchPointsMap.get(ident);
                if(point){
                    res.push(point);
                }
            }
        });
        return res; 
    }

    updateTouchPoints(pointsMoved: TouchPoints[]): void {
        pointsMoved.forEach((point)=>{
            if(this._touchPointsMap.has(point.ident)){
                this._touchPointsMap.set(point.ident, {...point});
            }
        });
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(value: boolean) {
        this._alignCoordinateSystem = value;
    }

    get canvas(): Canvas {
        return this._canvas;
    }

    cleanup(): void {
    }

    setup(): void {
    }
}
