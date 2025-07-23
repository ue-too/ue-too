import { Point } from "src/utils/misc";
import { DrawTask } from "./driver";

/**
 * @description The selection box. (WIP)
 * 
 * @category Drawing Engine
 */
export class SelectionBox implements DrawTask{

    private _startPoint: Point;
    private _endPoint: Point;
    private _selecting: boolean;
    private _context: CanvasRenderingContext2D;

    constructor(context: CanvasRenderingContext2D){
        this._context = context;
        this._startPoint = {x: 0, y: 0};
        this._endPoint = {x: 0, y: 0};
        this._selecting = true;
    }

    set startPoint(point: Point){
        this._startPoint = point;
        this._endPoint = point;
    }

    get startPoint(): Point {
        return this._startPoint;
    }

    set endPoint(point: Point){
        this._endPoint = point;
    }

    get endPoint(): Point {
        return this._endPoint;
    }

    draw(deltaTime: number): void {
        if(!this._selecting){
            return;
        }
        this._context.save();
        this._context.beginPath();
        this._context.rect(this._startPoint.x, this._startPoint.y, this._endPoint.x - this._startPoint.x, this._endPoint.y - this._startPoint.y);
        this._context.stroke();
        this._context.fill();
        this._context.restore();
    }

    drawWithContext(context: CanvasRenderingContext2D, deltaTime: number): void {
        if(!this._selecting){
            return;
        }
        context.save();
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.beginPath();
        context.rect(this._startPoint.x, this._startPoint.y, this._endPoint.x - this._startPoint.x, this._endPoint.y - this._startPoint.y);
        context.stroke();
        context.fill();
        context.restore();
    }

    startSelection(): void {
        this._selecting = true;
    }

    clearSelection(): void {
        this._selecting = false;
        this._startPoint = {x: 0, y: 0};
        this._endPoint = {x: 0, y: 0};
    }
}
