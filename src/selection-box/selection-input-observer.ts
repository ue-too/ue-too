import { Point } from "src/index";
import { BoardCamera } from "src/board-camera";
import { SelectionBox } from "src/drawing-engine";

export class SelectionInputObserver {

    private _camera: BoardCamera;
    private _selectionBox: SelectionBox;

    get selectionBox(): SelectionBox {
        return this._selectionBox;
    }

    constructor(camera: BoardCamera, selectionBox: SelectionBox){
        this._camera = camera;
        this._selectionBox = selectionBox;
    }

    notifySelectionStartPoint(point: Point): void {
        const startPointInWorld = this._camera.convertFromViewPort2WorldSpace(point);
        this._selectionBox.startPoint = startPointInWorld;
    }

    notifySelectionEndPoint(point: Point): void {
        const endPointInWorld = this._camera.convertFromViewPort2WorldSpace(point);
        this._selectionBox.endPoint = endPointInWorld;
    }

    toggleSelectionBox(visible: boolean): void {
        if(visible){
            this._selectionBox.startSelection();
            return;
        }
        this._selectionBox.clearSelection();
    }
    
}
