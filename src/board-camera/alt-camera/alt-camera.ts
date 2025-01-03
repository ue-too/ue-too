import { PointCal } from "point2point";
import { Board, Point } from "src/index";
import { BoardCamera } from "../interface";

type Transform = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

export class AltCamera  {

    private _position: Point;
    private _rotation: number;
    private _zoomLevel: number;
    private _viewPortWidth: number;
    private _viewPortHeight: number;

    constructor(position: Point, rotation: number, zoomLevel: number, viewPortWidth: number, viewPortHeight: number){
        console.log(this._position);
        this._rotation = -rotation;
        this._zoomLevel = zoomLevel;
        this._position  = PointCal.subVector({x: viewPortWidth / 2, y: viewPortHeight / 2}, PointCal.multiplyVectorByScalar(PointCal.rotatePoint(position, rotation), zoomLevel))
        this._viewPortWidth = viewPortWidth;
        this._viewPortHeight = viewPortHeight;
    }

    get position(): Point {
        const x = (this._viewPortWidth / 2 - this._position.x) / this._zoomLevel;
        const y = (this._viewPortHeight / 2 - this._position.y) / this._zoomLevel;
        return PointCal.rotatePoint({x, y}, -this._rotation);
    }

    get zoomLevel(): number {
        return this._zoomLevel;
    }

    get rotation(): number {
        return -this._rotation;
    }

    get transform(): Transform {
        const e = this._position.x;
        const f = this._position.y;
        const c = -Math.sin(this._rotation);
        const a = this._zoomLevel * Math.cos(this._rotation);
        const b = Math.sin(this._rotation);
        const d = this._zoomLevel * Math.cos(this._rotation);
        return {a, b, c, d, e, f};
    }

    

}
