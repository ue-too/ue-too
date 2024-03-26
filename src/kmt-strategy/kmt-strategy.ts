import { PointCal } from "point2point";
import { Point } from "..";
import BoardCamera from "../board-camera/board-camera";

/**
 * @category Keyboard-Mouse Strategy
 */
export interface BoardKMTStrategy {
    limitEntireViewPort: boolean;
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    setUp(): void;
    tearDown(): void;
    enableStrategy(): void;
    disableStrategy(): void;
}



export class DefaultBoardKMTStrategy implements BoardKMTStrategy {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private canvas: HTMLCanvasElement;
    private camera: BoardCamera;
    private _disabled: boolean;
    private _limitEntireViewPort: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;

    constructor(canvas: HTMLCanvasElement, camera:BoardCamera, limitEntireViewPort: boolean = true, debugMode: boolean = false, alignCoordinateSystem: boolean = false){
        this.SCROLL_SENSATIVITY = 0.005;
        this.isDragging = false;
        this.canvas = canvas;
        this.camera = camera;
        this._limitEntireViewPort = limitEntireViewPort;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
    }

    get debugMode(): boolean {
        return this._debugMode;
    }

    set debugMode(value: boolean){
        this._debugMode = value;
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(value: boolean){
        this._alignCoordinateSystem = value;
    }

    setUp(): void {
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointerup', this.pointerUpHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.addEventListener('wheel', this.scrollHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.removeEventListener('wheel', this.scrollHandler);
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
            if (!this._debugMode) {
                this.canvas.style.cursor = "auto";
            } else {
                this.canvas.style.cursor = "none";
            }
        }
    }

    pointerMoveHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if (e.pointerType == "mouse" && this.isDragging){
            if (this._debugMode) {
                this.canvas.style.cursor = "none";
            } else {
                this.canvas.style.cursor = "grabbing";
            }
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            diff = {x: diff.x, y: -diff.y};
            let diffInWorld = PointCal.rotatePoint(diff, this.camera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
            if(this._limitEntireViewPort){
                this.camera.moveWithClampEntireViewPortFromGesture(diffInWorld);
            } else {
                this.camera.moveWithClampFromGesture(diffInWorld);
            }
            this.dragStartPoint = target;
        }
    }

    scrollHandler(e: WheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;
        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            // console.log("panning?", e.deltaMode == 0 ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            if(!this._alignCoordinateSystem){
                diff.y = -diff.y;
            }
            let diffInWorld = PointCal.rotatePoint(diff, this.camera.getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
            // this.cameraObserver.executeCommand(new CameraMoveLimitEntireViewPortCommand(this.canvas.getCamera(), diffInWorld));
            if(this._limitEntireViewPort){
                this.camera.moveWithClampEntireViewPortFromGesture(diffInWorld);
            } else {
                this.camera.moveWithClampFromGesture(diffInWorld);
            }
        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            const cursorPosition = {x: e.clientX, y: e.clientY};
            let anchorPoint = PointCal.subVector(cursorPosition, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top});
            if(!this._alignCoordinateSystem){
                anchorPoint = PointCal.subVector(cursorPosition, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom});
                anchorPoint = {x: anchorPoint.x, y: -anchorPoint.y};
            }
            const zoomLevel = this.camera.getZoomLevel() - (this.camera.getZoomLevel() * zoomAmount * 5);
            if(this._limitEntireViewPort){
                this.camera.setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(zoomLevel, anchorPoint);
            } else {
                this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(zoomLevel, anchorPoint);
            }
        }
    }

    get disabled(): boolean {
        return this._disabled;
    }
}