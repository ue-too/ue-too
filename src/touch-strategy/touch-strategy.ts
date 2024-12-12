import { Point } from "src";
import { InputObserver } from "src/input-observer";
import { TouchPoints, TouchSM } from "src/input-state-machine/touch-state-machine";

export interface BoardTouchStrategy {
    disabled: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}

/**
 * @category Input Strategy
 */
export class DefaultTouchStrategy implements BoardTouchStrategy {

    private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _alignCoordinateSystem: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    private inputObserver: InputObserver;

    private touchSM: TouchSM;

    private touchPointsMap: Map<number, TouchPoints> = new Map<number, TouchPoints>();

    constructor(canvas: HTMLCanvasElement, inputObserver: InputObserver,alignCoordinateSystem: boolean = true){
        this._canvas = canvas;
        this._disabled = false;
        this._alignCoordinateSystem = alignCoordinateSystem;

        this.inputObserver = inputObserver;
        this.touchSM = new TouchSM(this);

        this.bindListeners();
    }

    bindListeners(): void{
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
        this.touchcancelHandler = this.touchcancelHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
    }

    resetAttributes(): void{
        this.touchPointsMap.clear();
    }

    enableStrategy(): void {
        this._disabled = false;
    }

    disableStrategy(): void {
        this.resetAttributes();
        this._disabled = true;
    }

    setUp(): void {
        this._canvas.addEventListener('touchstart', this.touchstartHandler);
        this._canvas.addEventListener('touchend', this.touchendHandler);
        this._canvas.addEventListener('touchcancel', this.touchcancelHandler);
        this._canvas.addEventListener('touchmove', this.touchmoveHandler);
    }

    tearDown(): void {
        this.resetAttributes();
        this._canvas.removeEventListener('touchstart', this.touchstartHandler);
        this._canvas.removeEventListener('touchend', this.touchendHandler);
        this._canvas.removeEventListener('touchcancel', this.touchcancelHandler);
        this._canvas.removeEventListener('touchmove', this.touchmoveHandler);
    }

    get disabled(): boolean {
        return this._disabled;
    }

    get alignCoordinateSystem(): boolean {
        return this._alignCoordinateSystem;
    }

    set alignCoordinateSystem(alignCoordinateSystem: boolean){
        this._alignCoordinateSystem = alignCoordinateSystem;
    }

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set panDisabled(panDisabled: boolean){
        this._panDisabled = panDisabled;
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    set zoomDisabled(zoomDisabled: boolean){
        this._zoomDisabled = zoomDisabled;
    }

    get rotateDisabled(): boolean {
        return this._rotateDisabled;
    }

    set rotateDisabled(rotateDisabled: boolean){
        this._rotateDisabled = rotateDisabled;
    }

    getCurrentTouchPointsCount(): number {
        const size = this.touchPointsMap.size;
        return size;
    }

    addTouchPoints(points: TouchPoints[]): void {
        points.forEach((point)=>{
            this.touchPointsMap.set(point.ident, {...point});
        });
    }

    removeTouchPoints(identifiers: number[]): void {
        identifiers.forEach((ident)=>{
            if(this.touchPointsMap.has(ident)){
                this.touchPointsMap.delete(ident);
            }
        });
    }

    touchstartHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }

        const pointsAdded: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsAdded.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        this.touchSM.happens("touchstart", {points: pointsAdded}, this);
        e.preventDefault();
    }

    touchcancelHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        this.touchSM.happens("touchend", {points: pointsRemoved}, this);
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        this.touchSM.happens("touchend", {points: pointsRemoved}, this);
    }

    touchmoveHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        e.preventDefault();
        const pointsMoved: TouchPoints[] = [];
        for (let i = 0; i < e.targetTouches.length; i++) {
            pointsMoved.push({ident: e.targetTouches[i].identifier, x: e.targetTouches[i].clientX, y: e.targetTouches[i].clientY});
        }
        this.touchSM.happens("touchmove", {points: pointsMoved}, this);
    }

    getInitialTouchPointsPositions(idents: number[]): TouchPoints[] {
        const res: TouchPoints[] = [];
        idents.forEach((ident)=>{
            if(this.touchPointsMap.has(ident)){
                res.push(this.touchPointsMap.get(ident));
            }
        });
        return res; 
    }

    updateTouchPoints(pointsMoved: TouchPoints[]): void {
        pointsMoved.forEach((point)=>{
            if(this.touchPointsMap.has(point.ident)){
                this.touchPointsMap.set(point.ident, {...point});
            }
        });
    }

    notifyOnPan(delta: Point): void {
        this.inputObserver.notifyOnPan(delta);
    }

    notifyOnZoom(zoomAmount: number, anchorPoint: Point): void {
        this.inputObserver.notifyOnZoom(zoomAmount, anchorPoint);
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }
}
