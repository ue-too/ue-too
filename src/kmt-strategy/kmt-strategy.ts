import { PointCal } from "point2point";
import { Point } from "..";
import { BoardCamera } from "src/board-camera";

import { InputObserver } from "src/input-observer/input-observer";
/**
 * @category Input Strategy
 */
export interface BoardKMTStrategy {
    disabled: boolean;
    debugMode: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    camera: BoardCamera;
    canvas: HTMLCanvasElement;
    setUp(): void;
    tearDown(): void;
    enableStrategy(): void;
    disableStrategy(): void;
    updateCamera(camera: BoardCamera): void;
}

export class DefaultBoardKMTStrategy implements BoardKMTStrategy {

    private SCROLL_SENSATIVITY: number;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private _canvas: HTMLCanvasElement;
    private _camera: BoardCamera;
    private _disabled: boolean;
    private _debugMode: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;
    private _keyController: Map<string, boolean> = new Map<string, boolean>();

    private inputObserver: InputObserver;

    constructor(canvas: HTMLCanvasElement, camera:BoardCamera, inputObserver: InputObserver, debugMode: boolean = false, alignCoordinateSystem: boolean = true){
        this.SCROLL_SENSATIVITY = 0.005;
        this.isDragging = false;
        this._canvas = canvas;
        this._camera = camera;
        this._debugMode = debugMode;
        this._alignCoordinateSystem = alignCoordinateSystem;
        this.bindFunctions();
        this.inputObserver = inputObserver;
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

    get camera(): BoardCamera {
        return this._camera;
    }

    set camera(value: BoardCamera){
        this._camera = value;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    setUp(): void {
        this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.addEventListener('pointerup', this.pointerUpHandler);
        this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.addEventListener('wheel', this.scrollHandler);
        window.addEventListener('keydown', this.keypressHandler);
        window.addEventListener('keyup', this.keyupHandler);
        this.setupKeyController([" "]);
    }

    tearDown(): void {
        this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
        this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
        this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this.canvas.removeEventListener('wheel', this.scrollHandler);
        window.removeEventListener('keydown', this.keypressHandler);
        window.removeEventListener('keyup', this.keyupHandler);
    }

    bindFunctions(): void {
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.scrollHandler = this.scrollHandler.bind(this);
        this.keypressHandler = this.keypressHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
    }

    setupKeyController(keys: string[]): void {
        keys.forEach((key) => {
            this._keyController.set(key, false);
        });
    }

    pointerDownHandler(e: PointerEvent){
        if(this._disabled){
            return;
        }
        if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey || this._keyController.get(" ")) && !this._panDisabled){
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
            let diffInWorld = PointCal.rotatePoint(diff, this._camera.rotation);
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this._camera.zoomLevel);
            this.inputObserver.notifyOnPan(this._camera, diffInWorld);
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
            let diffInWorld = PointCal.rotatePoint(diff, this._camera.rotation);
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this._camera.zoomLevel);
            this.inputObserver.notifyOnPan(this._camera, diffInWorld);
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
            // const zoomLevel = this._camera.zoomLevel - (this._camera.zoomLevel * zoomAmount * 5);
            this.inputObserver.notifyOnZoom(this._camera, -(this._camera.zoomLevel * zoomAmount * 5), anchorPoint);
        }
    }

    keypressHandler(e: KeyboardEvent){
        // console.log("key pressed is spacebar", e.key == " ");
        if(this._keyController.has(e.key) && this._keyController.get(e.key) == false){
            e.preventDefault();
            this._keyController.set(e.key, true);
        }
    }

    keyupHandler(e: KeyboardEvent){
        if(this._keyController.has(e.key) && this._keyController.get(e.key) == true){
            e.preventDefault();
            this._keyController.set(e.key, false);
            this.isDragging = false;
            this.canvas.style.cursor = "auto";
        }
    }

    updateCamera(camera: BoardCamera): void {
        this._camera = camera;
    }

    get disabled(): boolean {
        return this._disabled;
    }
}
