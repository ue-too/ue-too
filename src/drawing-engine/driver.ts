import { Point } from "src/util/misc";

/**
 * @description The interface for the draw task. (WIP)
 * 
 * @category Drawing Engine
 */
export interface DrawTask {
    draw(deltaTime: number): void;
    drawWithContext(context: CanvasRenderingContext2D, deltaTime: number): void;
}

/**
 * @description The container for the draw tasks. (WIP)
 * 
 * @category Drawing Engine
 */
export class Container implements DrawTask {
    private _position: Point;
    private _rotation: number;
    private _scale: number;
    private _children: DrawTask[];
    private _context: CanvasRenderingContext2D;
    
    constructor(context: CanvasRenderingContext2D){
        this._context = context;
        this._children = [];
        this._position = {x: 0, y: 0};
        this._rotation = 0;
        this._scale = 1;
    }

    set position(position: Point){
        this._position = position;
    }

    get position(): Point {
        return this._position;
    }

    addDrawTask(task: DrawTask): void {
        this._children.push(task);
    }
    
    drawWithContext(context: CanvasRenderingContext2D, deltaTime: number): void {
        context.save();
        context.translate(this._position.x, this._position.y);
        context.rotate(this._rotation);
        context.scale(this._scale, this._scale);
        for (const child of this._children) {
            child.drawWithContext(context, deltaTime);
        }
        context.restore();
    }

    draw(deltaTime: number): void {
        this._context.save();
        this._context.translate(this._position.x, this._position.y);
        this._context.rotate(this._rotation);
        this._context.scale(this._scale, this._scale);
        for (const child of this._children) {
            child.draw(deltaTime);
        }
        this._context.restore();
    }
}

