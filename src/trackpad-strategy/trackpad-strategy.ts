import BoardElement from "../board-element/board-element";
import Board from "../boardify/board";
import { PointCal } from "point2point";
import { CameraObserver } from "../camera-change-command/camera-observer";

/**
 * @category Trackpad Strategy
 */
export interface BoardTrackpadStrategy {
    limitEntireViewPort: boolean;
    disabled: boolean;
    disableStrategy(): void;
    enableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}

export class TwoFingerPanPinchZoom implements BoardTrackpadStrategy {

    private cameraObserver: CameraObserver;
    private SCROLL_SENSATIVITY: number = 0.005;
    private canvas: BoardElement;
    private _disabled: boolean = false;
    private _limitEntireViewPort: boolean = true;

    constructor(canvas: BoardElement, cameraObserver: CameraObserver, limitEntireViewPort: boolean = true){
        this.canvas = canvas;
        this.cameraObserver = cameraObserver;
        this.scrollHandler = this.scrollHandler.bind(this);
        this._limitEntireViewPort = limitEntireViewPort;
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
    }

    get disabled(): boolean {
        return this._disabled;
    }

    disableStrategy(): void {
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    setUp(): void{
        this.canvas.addEventListener('wheel', this.scrollHandler);
    }

    tearDown(): void{
        this.canvas.removeEventListener('wheel', this.scrollHandler);
    }

    scrollHandler(e: WheelEvent): void {
        if(this._disabled) return;
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;
        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.canvas.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
            this.cameraObserver.panCamera(diffInWorld);
        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            const cursorPosition = {x: e.clientX, y: e.clientY};
            const anchorPoint = this.canvas.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom},cursorPosition);
            const zoomLevel = this.canvas.getCamera().getZoomLevel() - (this.canvas.getCamera().getZoomLevel() * zoomAmount * 5);
            this.cameraObserver.zoomCamera(zoomLevel, anchorPoint);
        }

    }
}

export class TwoFingerPanPinchZoomLimitEntireView implements BoardTrackpadStrategy {

    private SCROLL_SENSATIVITY: number;
    private canvas: BoardElement;
    private cameraObserver: CameraObserver;
    private _disabled: boolean = false;

    private _limitEntireViewPort: boolean = true;

    constructor(canvas: BoardElement, cameraObserver: CameraObserver, limitEntireViewPort: boolean = true){
        this.SCROLL_SENSATIVITY = 0.005;
        this.canvas = canvas;
        this.cameraObserver = cameraObserver;
        this._limitEntireViewPort = limitEntireViewPort;
        this.scrollHandler = this.scrollHandler.bind(this);
    }

    get disabled(): boolean {
        return this._disabled;
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
    }

    disableStrategy(): void {
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    setUp(): void {
        this.canvas.addEventListener('wheel', this.scrollHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('wheel', this.scrollHandler);
    }

    scrollHandler(e: WheelEvent){
        if (this._disabled) return;
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;
        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            // console.log("panning?", e.deltaMode == 0 ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.canvas.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
            if(this._limitEntireViewPort){
                this.cameraObserver.panCameraLimitEntireViewPort(diffInWorld);
            } else {
                this.cameraObserver.panCamera(diffInWorld);
            }

        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            const cursorPosition = {x: e.clientX, y: e.clientY};
            const anchorPoint = this.canvas.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom},cursorPosition);
            const zoomLevel = this.canvas.getCamera().getZoomLevel() - (this.canvas.getCamera().getZoomLevel() * zoomAmount * 5);
            if(this._limitEntireViewPort){
                this.cameraObserver.zoomCameraLimitEntireViewPort(zoomLevel, anchorPoint);
            } else {
                this.cameraObserver.zoomCamera(zoomLevel, anchorPoint);
            }
        }
    }
}

export class DefaultBoardTrackpadStrategy implements BoardTrackpadStrategy {

    private SCROLL_SENSATIVITY: number;
    private canvas: HTMLCanvasElement;
    private board: Board;
    private cameraObserver: CameraObserver;
    private _disabled: boolean = false;
    private _limitEntireViewPort: boolean = true;

    constructor(canvas: HTMLCanvasElement, board: Board, cameraObserver: CameraObserver, limitEntireViewPort: boolean = true){
        this.SCROLL_SENSATIVITY = 0.005;
        this.canvas = canvas;
        this.board = board;
        this.cameraObserver = cameraObserver;
        this._limitEntireViewPort = limitEntireViewPort;
        this.scrollHandler = this.scrollHandler.bind(this);
    }

    get disabled(): boolean {
        return this._disabled;
    }

    get limitEntireViewPort(): boolean {
        return this._limitEntireViewPort;
    }

    set limitEntireViewPort(value: boolean){
        this._limitEntireViewPort = value;
    }
    
    disableStrategy(): void {
        this._disabled = true;
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    setUp(): void {
        this.canvas.addEventListener('wheel', this.scrollHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('wheel', this.scrollHandler);
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
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.board.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.board.getCamera().getZoomLevel());
            // this.cameraObserver.executeCommand(new CameraMoveLimitEntireViewPortCommand(this.canvas.getCamera(), diffInWorld));
            if(this._limitEntireViewPort){
                this.cameraObserver.panCameraLimitEntireViewPort(diffInWorld);
            } else {
                this.cameraObserver.panCamera(diffInWorld);
            }
        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            const cursorPosition = {x: e.clientX, y: e.clientY};
            const anchorPoint = this.board.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom},cursorPosition);
            const zoomLevel = this.board.getCamera().getZoomLevel() - (this.board.getCamera().getZoomLevel() * zoomAmount * 5);
            if(this._limitEntireViewPort){
                this.cameraObserver.zoomCameraLimitEntireViewPort(zoomLevel, anchorPoint);
            } else {
                this.cameraObserver.zoomCamera(zoomLevel, anchorPoint);
            }
        }
    }
}
