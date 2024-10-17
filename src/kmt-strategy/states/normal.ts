import { KeyboardMouseInputState } from './index';
import { BoardKMTStrategy } from '../kmt-strategy';
import { Point } from "src/index";
import { PointCal } from 'point2point';

export class NormalState implements KeyboardMouseInputState {

    private _strategy: BoardKMTStrategy;
    private isDragging: boolean;
    private dragStartPoint: Point;
    private SCROLL_SENSATIVITY: number;
    private _keyController: Map<string, boolean>;
    private _panDisabled: boolean; 
    private _zoomDisabled: boolean;

    constructor(strategy: BoardKMTStrategy){
        this._strategy = strategy;
        this.isDragging = false;
        this.dragStartPoint = {x: 0, y: 0};
        this.SCROLL_SENSATIVITY = 0.005;
        this._keyController = new Map<string, boolean>();
        this._panDisabled = false;
        this.resetInternalStates();
    }

    set panDisabled(value: boolean){
        this._panDisabled = value;
        if(value){
            this._strategy.canvas.style.cursor = "auto";
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
            if (this._strategy.debugMode) {
                this._strategy.canvas.style.cursor = "none";
            } else {
                this._strategy.canvas.style.cursor = "grabbing";
            }
            const target = {x: event.clientX, y: event.clientY};
            const diff = PointCal.subVector(this.dragStartPoint, target);
            if(!this._strategy.alignCoordinateSystem){
                diff.y = -diff.y;
            }
            this._strategy.inputObserver.notifyOnPan(diff);
            this.dragStartPoint = target;
        }
    }

    pointerUpHandler(event: PointerEvent): void {
        if(event.pointerType === "mouse"){
            if (this.isDragging) {
                this.isDragging = false;
            }
            if (!this._strategy.debugMode) {
                this._strategy.canvas.style.cursor = "auto";
            } else {
                this._strategy.canvas.style.cursor = "none";
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
            if(!this._strategy.alignCoordinateSystem){
                diff.y = -diff.y;
            }
            this._strategy.inputObserver.notifyOnPan(diff);
        } else {
            //NOTE this is zooming the camera
            if(this._zoomDisabled){
                return;
            }
            const cursorPosition = {x: event.clientX, y: event.clientY};
            // anchor point is in view port space (relative to the camera position)
            const boundingRect = this._strategy.canvas.getBoundingClientRect();
            const cameraCenterInWindow = {x: boundingRect.left + (boundingRect.right - boundingRect.left) / 2, y: boundingRect.top + (boundingRect.bottom - boundingRect.top) / 2};
            const anchorPoint = PointCal.subVector(cursorPosition, cameraCenterInWindow);
            if(!this._strategy.alignCoordinateSystem){
                anchorPoint.y = -anchorPoint.y;
            }
            console.log('anchor point', anchorPoint);
            this._strategy.inputObserver.notifyOnZoom(-(zoomAmount * 5), anchorPoint);
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
            this._strategy.canvas.style.cursor = "auto";
        }
    }
}
