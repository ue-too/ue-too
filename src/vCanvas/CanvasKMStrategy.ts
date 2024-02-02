import vCamera  from "../vCamera";
import { PointCal } from "point2point";
import { Point, vCanvas } from "..";
import { CameraObserver } from "./cameraChangeCommand/cameraObserver";
import { CameraMoveCommand } from "./cameraChangeCommand";


type CoordinateConversionFn = (interestPoint: Point) => Point;
export interface CanvasKMStrategy {
    disabled: boolean;
    setUp(): void;
    tearDown(): void;
    enableStrategy(): void;
    disableStrategy(): void;
}


export class DefaultCanvasKMStrategy implements CanvasKMStrategy {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private canvas: vCanvas;
    private cameraObserver: CameraObserver;
    private _disabled: boolean;

    constructor(canvas: vCanvas, cameraObserver: CameraObserver){
        this.SCROLL_SENSATIVITY = 0.005;
        this.isDragging = false;
        this.canvas = canvas;
        this.cameraObserver = cameraObserver;
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
    }

    setUp(): void {
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointerup', this.pointerUpHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    }

    pointerDownHandler(e: PointerEvent){
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey)){
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    disableStrategy(): void {
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    pointerUpHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if(e.pointerType === "mouse"){
            if (this.isDragging) {
                this.isDragging = false;
            }
            if (!this.canvas.debugMode) {
                this.canvas.getInternalCanvas().style.cursor = "auto";
            } else {
                this.canvas.getInternalCanvas().style.cursor = "none";
            }
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if (e.pointerType == "mouse" && this.isDragging){
            this.canvas.getInternalCanvas().style.cursor = "grabbing";
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            diff = {x: diff.x, y: -diff.y};
            let diffInWorld = PointCal.rotatePoint(diff, this.canvas.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
            this.cameraObserver.executeCommand(new CameraMoveCommand(this.canvas.getCamera(), diffInWorld));
            this.dragStartPoint = target;
        }
    }
    get disabled(): boolean {
        return this._disabled;
    }
}