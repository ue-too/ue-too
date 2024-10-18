import { BoardKMTStrategy } from '../kmt-strategy';
import { InputObserver, KeyboardMouseInputState, Point, SelectionState, StateMap, StateRegistry } from "src/index";
import { PointCal } from 'point2point';
import { KeyboardMouseInputStateTemplate } from './state-template';


// Add this type helper
export type DefaultStateMap = {
    "normal": NormalState;
    "selection": SelectionState;
}

export class NormalState extends KeyboardMouseInputStateTemplate<DefaultStateMap> {

    private isDragging: boolean;
    private dragStartPoint: Point;
    private SCROLL_SENSATIVITY: number;
    private _keyController: Map<string, boolean>;
    private _panDisabled: boolean;
    private _zoomDisabled: boolean;
    private _inputObserver: InputObserver;
    private _canvas: HTMLCanvasElement;

    public debugMode: boolean = false;
    public alignCoordinateSystem: boolean = true;

    constructor(stateRegistry: StateRegistry<DefaultStateMap>, inputObserver: InputObserver, canvas: HTMLCanvasElement){
        super(stateRegistry);
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this.SCROLL_SENSATIVITY = 0.005;
        this._keyController = new Map<string, boolean>();
        this._panDisabled = false;
        this._inputObserver = inputObserver;
        this._canvas = canvas;
        this.resetInternalStates();
    }

    set panDisabled(value: boolean){
        this._panDisabled = value;
        if(value){
            this._canvas.style.cursor = "auto";
        }
    }

    get panDisabled(): boolean {
        return this._panDisabled;
    }

    set zoomDisabled(value: boolean){
        this._zoomDisabled = value;
    }

    get zoomDisabled(): boolean {
        return this._zoomDisabled;
    }

    resetInternalStates(): void {
        this._panDisabled = false;
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this._keyController.clear();
        this.setupKeyController([" "]);
    }

    setupKeyController(keys: string[]): void {
        keys.forEach((key) => {
            this._keyController.set(key, false);
        });
    }

    pointerDownHandler(event: PointerEvent): void {
        if(event.pointerType === "mouse" && (event.button == 1 || event.metaKey || this._keyController.get(" ")) && !this._panDisabled){
            this.isDragging = true;
            this.dragStartPoint = {x: event.clientX, y: event.clientY};
        }
    }

    pointerMoveHandler(event: PointerEvent): void {
        if (event.pointerType == "mouse" && this.isDragging && !this._panDisabled){
            if (this.debugMode) {
                this._canvas.style.cursor = "none";
            } else {
                this._canvas.style.cursor = "grabbing";
            }
            const target = {x: event.clientX, y: event.clientY};
            const diff = PointCal.subVector(this.dragStartPoint, target);
            if(!this.alignCoordinateSystem){
                diff.y = -diff.y;
            }
            this._inputObserver.notifyOnPan(diff);
            this.dragStartPoint = target;
        }
    }

    pointerUpHandler(event: PointerEvent): void {
        if(event.pointerType === "mouse"){
            if (this.isDragging) {
                this.isDragging = false;
            }
            if (!this.debugMode) {
                this._canvas.style.cursor = "auto";
            } else {
                this._canvas.style.cursor = "none";
            }
        }
    }

    scrollHandler(event: WheelEvent): void {
        const zoomAmount = event.deltaY * this.SCROLL_SENSATIVITY;
        if (!event.ctrlKey){
            if(this._panDisabled){
                return;
            }
            //NOTE this is panning the camera
            const diff = {x: event.deltaX, y: event.deltaY};
            if(!this.alignCoordinateSystem){
                diff.y = -diff.y;
            }
            this._inputObserver.notifyOnPan(diff);
        } else {
            //NOTE this is zooming the camera
            if(this._zoomDisabled){
                return;
            }
            const cursorPosition = {x: event.clientX, y: event.clientY};
            // anchor point is in view port space (relative to the camera position)
            const boundingRect = this._canvas.getBoundingClientRect();
            const cameraCenterInWindow = {x: boundingRect.left + (boundingRect.right - boundingRect.left) / 2, y: boundingRect.top + (boundingRect.bottom - boundingRect.top) / 2};
            const anchorPoint = PointCal.subVector(cursorPosition, cameraCenterInWindow);
            if(!this.alignCoordinateSystem){
                anchorPoint.y = -anchorPoint.y;
            }
            this._inputObserver.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
        }
    }

    keypressHandler(event: KeyboardEvent): void {
        if(this._keyController.has(event.key) && this._keyController.get(event.key) == false){
            event.preventDefault();
            this._keyController.set(event.key, true);
        }
    }

    keyupHandler(event: KeyboardEvent): void {
        if(this._keyController.has(event.key) && this._keyController.get(event.key) == true){
            event.preventDefault();
            this._keyController.set(event.key, false);
            this.isDragging = false;
            this._canvas.style.cursor = "auto";
        }
    }
}
