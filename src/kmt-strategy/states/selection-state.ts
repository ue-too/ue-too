import { BoardCamera } from "src/index";
import { StateRegistry } from "src/kmt-strategy/states";
import { KeyboardMouseInputStateTemplate } from "./state-template";
import { PointCal } from "point2point";
import { SelectionBox } from "src/drawing-engine/selection-box";
import { DefaultStateMap } from "./normal";


export class SelectionState extends KeyboardMouseInputStateTemplate<DefaultStateMap> {

    private _isSelecting: boolean;
    private _camera: BoardCamera;
    private _canvas: HTMLCanvasElement;
    private _selectionBox: SelectionBox;

    constructor(stateRegistry: StateRegistry<DefaultStateMap>, camera: BoardCamera, canvas: HTMLCanvasElement, selectionBox: SelectionBox){
        super(stateRegistry);
        this._isSelecting = false;
        this._canvas = canvas;
        this._camera = camera;
        this._selectionBox = selectionBox;
    }

    pointerDownHandler(event: PointerEvent): void {
        if(event.pointerType === 'mouse' && event.button === 1) {
            this._isSelecting = true;
            const boundingBox = this._canvas.getBoundingClientRect();
            const cameraCenterInBrowserFrame = {x: boundingBox.x + boundingBox.width / 2, y: boundingBox.y + boundingBox.height / 2};
            const cursorInBrowserFrame = {x: event.clientX, y: event.clientY};
            this._selectionBox.startSelection();
            this._selectionBox.startPoint = this._camera.convertFromViewPort2WorldSpace(PointCal.subVector(cursorInBrowserFrame, cameraCenterInBrowserFrame));
        }
    }

    pointerMoveHandler(event: PointerEvent): void {
        if(!this._isSelecting){
            return;
        }
        const boundingBox = this._canvas.getBoundingClientRect();
        const cameraCenterInBrowserFrame = {x: boundingBox.x + boundingBox.width / 2, y: boundingBox.y + boundingBox.height / 2};
        const cursorInBrowserFrame = {x: event.clientX, y: event.clientY};
        this._selectionBox.endPoint = this._camera.convertFromViewPort2WorldSpace(PointCal.subVector(cursorInBrowserFrame, cameraCenterInBrowserFrame));
    }

    pointerUpHandler(event: PointerEvent): void {
        if(event.pointerType !== 'mouse' || event.button !== 1) {
            // maybe some other unrelated button is pressed; this state is not responsible to deal with that
            return;
        }

        this._isSelecting = false;
        this._selectionBox.clearSelection();
        // TODO leaving spaces for future implementation for object batch selection

    }

    keypressHandler(event: KeyboardEvent): void {
    }

    keyupHandler(event: KeyboardEvent): void {
    }

    resetInternalStates(): void {
        this._isSelecting = false;
        this._selectionBox.clearSelection();
    }

}
