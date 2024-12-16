import { Point } from "src/index";
import { DrawTask } from "./driver";

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
        this._context.beginPath();
        this._context.rect(this._startPoint.x, this._startPoint.y, this._endPoint.x - this._startPoint.x, this._endPoint.y - this._startPoint.y);
        this._context.stroke();
        this._context.fill();
    }

    startSelection(): void {
        this._selecting = true;
    }

    clearSelection(): void {
        this._selecting = false;
    }
}