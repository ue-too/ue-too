import { RawUserInputPublisher } from "src/raw-input-publisher";
import { TouchPoints, TouchInputStateMachine } from "src/input-state-machine/touch-input-state-machine";
import { TouchInputTracker } from "src/input-state-machine/touch-input-context";

export interface TouchEventParser {
    disabled: boolean;
    alignCoordinateSystem: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    touchStateMachine: TouchInputStateMachine;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
}

type MininumTouchEvent = {

};

/**
 * @category Input Strategy
 */
export class VanillaTouchEventParser implements TouchEventParser {

    private _canvas: HTMLCanvasElement;
    private _touchInputTracker: TouchInputTracker;
    private _disabled: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    private touchSM: TouchInputStateMachine;

    private touchPointsMap: Map<number, TouchPoints> = new Map<number, TouchPoints>();

    constructor(canvas: HTMLCanvasElement, inputPublisher: RawUserInputPublisher, alignCoordinateSystem: boolean = true){
        this._canvas = canvas;
        this._disabled = false;
        this._touchInputTracker = new TouchInputTracker(canvas, inputPublisher);
        this._touchInputTracker.alignCoordinateSystem = alignCoordinateSystem;
        this.touchSM = new TouchInputStateMachine(this._touchInputTracker);

        this.bindListeners();
    }

    get touchStateMachine(): TouchInputStateMachine {
        return this.touchSM;
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
        return this._touchInputTracker.alignCoordinateSystem;
    }

    set alignCoordinateSystem(alignCoordinateSystem: boolean){
        this._touchInputTracker.alignCoordinateSystem = alignCoordinateSystem;
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

    touchstartHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }

        const pointsAdded: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsAdded.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        this.touchSM.happens("touchstart", {points: pointsAdded}, this._touchInputTracker);
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
        this.touchSM.happens("touchend", {points: pointsRemoved}, this._touchInputTracker);
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        this.touchSM.happens("touchend", {points: pointsRemoved}, this._touchInputTracker);
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
        this.touchSM.happens("touchmove", {points: pointsMoved}, this._touchInputTracker);
    }
}
