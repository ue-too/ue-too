import { TouchInputStateMachine } from "../../input-interpretation/input-state-machine/touch-input-state-machine";
import { TouchInputTracker, TouchPoints } from "../../input-interpretation/input-state-machine/touch-input-context";

/**
 * @description The touch event parser.
 * This is for the interoperability between the vanilla javascript and the pixijs event system.
 * 
 * @category Event Parser
 */
export interface TouchEventParser {
    disabled: boolean;
    panDisabled: boolean;
    zoomDisabled: boolean;
    rotateDisabled: boolean;
    enableStrategy(): void;
    disableStrategy(): void;
    setUp(): void;
    tearDown(): void;
    attach(canvas: HTMLCanvasElement): void;
}

/**
 * @description The vanilla touch event parser.
 * This parser converts the raw events to events that can be used by the input state machine.
 * 
 * @category Event Parser
 */
export class VanillaTouchEventParser implements TouchEventParser {

    private _canvas: HTMLCanvasElement;
    private _disabled: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    private touchSM: TouchInputStateMachine;

    private _abortController: AbortController;

    constructor(canvas: HTMLCanvasElement, touchInputStateMachine: TouchInputStateMachine){
        this._canvas = canvas;
        this._disabled = false;
        this.touchSM = touchInputStateMachine;
        this._abortController = new AbortController();

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

    enableStrategy(): void {
        this._disabled = false;
    }

    disableStrategy(): void {
        this._disabled = true;
    }

    setUp(): void {
        this._canvas.addEventListener('touchstart', this.touchstartHandler, {signal: this._abortController.signal});
        this._canvas.addEventListener('touchend', this.touchendHandler, {signal: this._abortController.signal});
        this._canvas.addEventListener('touchcancel', this.touchcancelHandler, {signal: this._abortController.signal});
        this._canvas.addEventListener('touchmove', this.touchmoveHandler, {signal: this._abortController.signal});
    }

    tearDown(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
    }

    get disabled(): boolean {
        return this._disabled;
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
        this.touchSM.happens("touchstart", {points: pointsAdded});
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
        this.touchSM.happens("touchend", {points: pointsRemoved});
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        this.touchSM.happens("touchend", {points: pointsRemoved});
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
        this.touchSM.happens("touchmove", {points: pointsMoved});
    }

    attach(canvas: HTMLCanvasElement){
        this.tearDown();
        this._canvas = canvas;
        this.setUp();
    }
}
