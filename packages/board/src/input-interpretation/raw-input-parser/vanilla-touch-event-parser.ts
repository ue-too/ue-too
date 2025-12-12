import { TouchInputStateMachine } from "../../input-interpretation/input-state-machine/touch-input-state-machine";
import { TouchInputTracker, TouchPoints } from "../../input-interpretation/input-state-machine/touch-input-context";
import type { InputOrchestrator } from "../input-orchestrator";

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
    setUp(): void;
    tearDown(): void;
    attach(canvas: HTMLCanvasElement): void;
    stateMachine: TouchInputStateMachine;
    orchestrator: InputOrchestrator;
}

/**
 * @description The vanilla touch event parser.
 * This parser converts the raw events to events that can be used by the input state machine.
 * The parser has a direct dependency on the state machine and requires an orchestrator for consistency.
 *
 * @category Event Parser
 */
export class VanillaTouchEventParser implements TouchEventParser {

    private _canvas?: HTMLCanvasElement;
    private _disabled: boolean;
    private _panDisabled: boolean = false;
    private _zoomDisabled: boolean = false;
    private _rotateDisabled: boolean = false;

    private _stateMachine: TouchInputStateMachine;
    private _orchestrator: InputOrchestrator;

    private _abortController: AbortController;

    constructor(touchInputStateMachine: TouchInputStateMachine, orchestrator: InputOrchestrator, canvas?: HTMLCanvasElement){
        this._canvas = canvas;
        this._disabled = false;
        this._stateMachine = touchInputStateMachine;
        this._orchestrator = orchestrator;
        this._abortController = new AbortController();

        this.bindListeners();
    }

    get stateMachine(): TouchInputStateMachine {
        return this._stateMachine;
    }

    get orchestrator(): InputOrchestrator {
        return this._orchestrator;
    }

    get touchStateMachine(): TouchInputStateMachine {
        return this._stateMachine;
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
        if(this._canvas == undefined){
            return;
        }
        if(this._abortController.signal.aborted){
            this._abortController = new AbortController();
        }
        this._canvas.addEventListener('touchstart', this.touchstartHandler, {signal: this._abortController.signal});
        this._canvas.addEventListener('touchend', this.touchendHandler, {signal: this._abortController.signal});
        this._canvas.addEventListener('touchcancel', this.touchcancelHandler, {signal: this._abortController.signal});
        this._canvas.addEventListener('touchmove', this.touchmoveHandler, {signal: this._abortController.signal});
    }

    tearDown(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
        this._canvas = undefined;
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
        const result = this._stateMachine.happens("touchstart", {points: pointsAdded});
        if(result.handled && 'output' in result && result.output){
            this._orchestrator.processOutput(result.output);
        }
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
        const result = this._stateMachine.happens("touchend", {points: pointsRemoved});
        if(result.handled && 'output' in result && result.output){
            this._orchestrator.processOutput(result.output);
        }
    }

    touchendHandler(e: TouchEvent){
        if(this._disabled) {
            return;
        }
        const pointsRemoved: TouchPoints[] = [];
        for (let i = 0; i < e.changedTouches.length; i++) {
            pointsRemoved.push({ident: e.changedTouches[i].identifier, x: e.changedTouches[i].clientX, y: e.changedTouches[i].clientY});
        }
        const result = this._stateMachine.happens("touchend", {points: pointsRemoved});
        if(result.handled && 'output' in result && result.output){
            this._orchestrator.processOutput(result.output);
        }
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
        const result = this._stateMachine.happens("touchmove", {points: pointsMoved});
        if(result.handled && 'output' in result && result.output){
            this._orchestrator.processOutput(result.output);
        }
    }

    attach(canvas: HTMLCanvasElement){
        this.tearDown();
        this._canvas = canvas;
        this.setUp();
    }
}
