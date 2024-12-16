import { Point } from "src/index";
export interface DrawTask {
    draw(deltaTime: number): void;
}

export class Container implements DrawTask {
    private _position: Point;
    private _rotation: number;
    private _scale: number;
    private _children: DrawTask[];
    private _context: CanvasRenderingContext2D;
    
    constructor(context: CanvasRenderingContext2D){
        this._context = context;
    }

    draw(deltaTime: number): void {
        this._context.translate(this._position.x, this._position.y);
        this._context.rotate(this._rotation);
        this._context.scale(this._scale, this._scale);
        for (const child of this._children) {
            child.draw(deltaTime);
        }
    }
}

