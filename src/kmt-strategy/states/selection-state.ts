import { BoardCamera, Point } from "src/index";
import { BoardKMTStrategy } from "../kmt-strategy";
import { KeyboardMouseInputStateTemplate } from "./state-template";
import { PointCal } from "point2point";
import { SelectionBox } from "src/drawing-engine/selection-box";

export class SelectionState extends KeyboardMouseInputStateTemplate {

    private _isDragging: boolean;
    private _camera: BoardCamera;
    private _dragStartPoint: Point;
    private _canvas: HTMLCanvasElement;
    private _selectionBox: SelectionBox;

    constructor(strategy: BoardKMTStrategy, camera: BoardCamera, canvas: HTMLCanvasElement, selectionBox: SelectionBox){
        super(strategy);
        this._isDragging = false;
        this._dragStartPoint = {x: 0, y: 0};
        this._canvas = canvas;
        this._camera = camera;
        this._selectionBox = selectionBox;
    }

    pointerDownHandler(event: PointerEvent): void {
        if(event.pointerType === 'mouse' && event.button === 1) {
            this._isDragging = true;
            const boundingBox = this._canvas.getBoundingClientRect();
            const cameraCenterInBrowserFrame = {x: boundingBox.x + boundingBox.width / 2, y: boundingBox.y + boundingBox.height / 2};
            const cursorInBrowserFrame = {x: event.clientX, y: event.clientY};
            this._selectionBox.startSelection();
            this._selectionBox.startPoint = this._camera.convertFromViewPort2WorldSpace(PointCal.subVector(cursorInBrowserFrame, cameraCenterInBrowserFrame));
        }
    }

    pointerMoveHandler(event: PointerEvent): void {
        if(!this._isDragging){
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

        this._isDragging = false;
        this._selectionBox.clearSelection();
        // TODO leaving spaces for future implementation for object batch selection

    }

    keypressHandler(event: KeyboardEvent): void {
    }

    keyupHandler(event: KeyboardEvent): void {
    }

    resetInternalStates(): void {
        this._isDragging = false;
        this._selectionBox.clearSelection();
    }

}
