import { Point } from "src/utils/misc";
import { TouchPoints } from "./touch-input-state-machine";
import { RawUserInputPublisher } from "src/input-interpretation/raw-input-publisher";
import { BaseContext } from "src/being/interfaces";
import { CanvasOperator } from "./kmt-input-context";

export interface TouchContext extends BaseContext{
    addTouchPoints: (points: TouchPoints[]) => void;
    removeTouchPoints: (idents: number[]) => void;
    getCurrentTouchPointsCount: () => number;
    getInitialTouchPointsPositions: (idents: number[]) => TouchPoints[];
    updateTouchPoints: (pointsMoved: TouchPoints[]) => void;
    notifyOnPan: (delta: Point) => void;
    notifyOnZoom: (zoomAmount: number, anchorPoint: Point) => void; 
    alignCoordinateSystem: boolean;
    canvas: CanvasOperator;
}

export class TouchInputTracker implements TouchContext {

    private _inputPublisher: RawUserInputPublisher;
    private _touchPointsMap: Map<number, TouchPoints> = new Map<number, TouchPoints>();
    private _canvas: CanvasOperator;
    private _alignCoordinateSystem: boolean;

    constructor(canvas: CanvasOperator, inputPublisher: RawUserInputPublisher) {
        this._canvas = canvas;
        this._inputPublisher = inputPublisher;
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

    notifyOnPan(delta: Point): void {
        this._inputPublisher.notifyPan(delta);
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point): void {
        this._inputPublisher.notifyZoom(zoomAmount, anchorPoint);
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(value: boolean) {
        this._alignCoordinateSystem = value;
    }

    get canvas(): CanvasOperator {
        return this._canvas;
    }

    cleanup(): void {
    }

    setup(): void {
    }
}
