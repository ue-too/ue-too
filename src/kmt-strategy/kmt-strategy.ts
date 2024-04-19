import { PointCal } from "point2point";
import { Point } from "..";
import BoardCameraV1, { BoardCamera } from "src/board-camera";
import { PanHandler, PanRig } from "src/board-camera/pan";
import { ZoomHandler, ZoomRig } from "src/board-camera/zoom";

/**
 * @category Keyboard-Mouse Strategy
 */
export interface BoardKMTStrategy {
    limitEntireViewPort: boolean;
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    setUp(): void;
    tearDown(): void;
    enableStrategy(): void;
    disableStrategy(): void;
}

export interface BoardKMTStrategyV2 {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    setUp(): void;
    tearDown(): void;
    enableStrategy(): void;
    disableStrategy(): void;
}


export class DefaultBoardKMTStrategyV2 implements BoardKMTStrategyV2 {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private canvas: HTMLCanvasElement;
    private camera: BoardCamera;
    private panHandler: PanHandler;
    private zoomHandler: ZoomHandler;
    private _disabled: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    constructor(canvas: HTMLCanvasElement, camera:BoardCamera, panHandler: PanHandler, zoomHandler: ZoomHandler, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
        this.SCROLL_SENSATIVITY = 0.005;
        this.isDragging = false;
        this.canvas = canvas;
        this.camera = camera;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
        this.panHandler = panHandler;
        this.zoomHandler = zoomHandler;
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

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set panDisabled(value: boolean){
        this._panDisabled = value;
        if(value){
            this.canvas.style.cursor = "auto";
            this.isDragging = false;
            this.dragStartPoint = {x: 0, y: 0};
        }
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    set zoomDisabled(value: boolean){
        this._zoomDisabled = value;
    }

    get rotateDisabled(): boolean {
        return this._rotateDisabled;
    }

    set rotateDisabled(value: boolean){
        this._rotateDisabled = value;
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
        if(this._disabled){
            return;
        }
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey) && !this._panDisabled){
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    disableStrategy(): void {
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
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
        if (e.pointerType == "mouse" && this.isDragging && !this._panDisabled){
            if (this._debugMode) {
                this.canvas.style.cursor = "none";
            } else {
                this.canvas.style.cursor = "grabbing";
            }
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            if(!this._alignCoordinateSystem){
                diff = PointCal.flipYAxis(diff);
            }
            let diffInWorld = PointCal.rotatePoint(diff, this.camera.rotation);
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.zoomLevel);
            this.panHandler.panBy(diffInWorld);
            this.dragStartPoint = target;
        }
    }

    scrollHandler(e: WheelEvent){
        if(this._disabled) return;
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;
        if (!e.ctrlKey){
            if(this._panDisabled){
                return;
            }
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            // console.log("panning?", e.deltaMode == 0 ? "yes": "no");
            let diff = {x: e.deltaX, y: e.deltaY};
            if(!this._alignCoordinateSystem){
                diff = PointCal.flipYAxis(diff);
            }
            let diffInWorld = PointCal.rotatePoint(diff, this.camera.rotation);
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.zoomLevel);
            this.panHandler.panBy(diffInWorld);
        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            if(this._zoomDisabled){
                return;
            }
            const cursorPosition = {x: e.clientX, y: e.clientY};
            let anchorPoint = PointCal.subVector(cursorPosition, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top});
            if(!this._alignCoordinateSystem){
                anchorPoint = PointCal.subVector(cursorPosition, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom});
                anchorPoint = PointCal.flipYAxis(anchorPoint);
            }
            const zoomLevel = this.camera.zoomLevel - (this.camera.zoomLevel * zoomAmount * 5);
            this.zoomHandler.zoomToAt(zoomLevel, anchorPoint);
        }
    }

    get disabled(): boolean {
        return this._disabled;
    }
}



export class DefaultBoardKMTStrategy implements BoardKMTStrategy {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private canvas: HTMLCanvasElement;
    private camera: BoardCameraV1;
    private _disabled: boolean;
    private _limitEntireViewPort: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    constructor(canvas: HTMLCanvasElement, camera:BoardCameraV1, limitEntireViewPort: boolean = true, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
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

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set panDisabled(value: boolean){
        this._panDisabled = value;
        if(value){
            this.canvas.style.cursor = "auto";
            this.isDragging = false;
            this.dragStartPoint = {x: 0, y: 0};
        }
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    set zoomDisabled(value: boolean){
        this._zoomDisabled = value;
    }

    get rotateDisabled(): boolean {
        return this._rotateDisabled;
    }

    set rotateDisabled(value: boolean){
        this._rotateDisabled = value;
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
        if(this._disabled){
            return;
        }
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey) && !this._panDisabled){
            this.isDragging = true;
            this.dragStartPoint = {x: e.clientX, y: e.clientY};
        }
    }

    disableStrategy(): void {
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
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
        if (e.pointerType == "mouse" && this.isDragging && !this._panDisabled){
            if (this._debugMode) {
                this.canvas.style.cursor = "none";
            } else {
                this.canvas.style.cursor = "grabbing";
            }
            const target = {x: e.clientX, y: e.clientY};
            let diff = PointCal.subVector(this.dragStartPoint, target);
            if(!this._alignCoordinateSystem){
                diff = PointCal.flipYAxis(diff);
            }
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
            if(this._panDisabled){
                return;
            }
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            // console.log("panning?", e.deltaMode == 0 ? "yes": "no");
            let diff = {x: e.deltaX, y: e.deltaY};
            if(!this._alignCoordinateSystem){
                diff = PointCal.flipYAxis(diff);
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
            if(this._zoomDisabled){
                return;
            }
            const cursorPosition = {x: e.clientX, y: e.clientY};
            let anchorPoint = PointCal.subVector(cursorPosition, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().top});
            if(!this._alignCoordinateSystem){
                anchorPoint = PointCal.subVector(cursorPosition, {x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom});
                anchorPoint = PointCal.flipYAxis(anchorPoint);
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
