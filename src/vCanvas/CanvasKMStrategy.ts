import { vCamera } from "../vCamera";
import { PointCal } from "point2point";
import { InteractiveUIComponent, Point } from "..";


type CoordinateConversionFn = (interestPoint: Point) => Point;
export interface CanvasKMTrackpadStrategy {
    pointerdownHandler(e: PointerEvent, controlCamera: vCamera, coordinateConversionFn: CoordinateConversionFn): void;
    pointerupHandler(e: PointerEvent, controlCamera: vCamera, coordinateConversionFn: CoordinateConversionFn): void;
    pointerMoveHandler(e: PointerEvent, controlCamera: vCamera, coordinateConversionFn: CoordinateConversionFn): void;
    scrollHandler(e: WheelEvent, controlCamera: vCamera, coordinateConversionFn: CoordinateConversionFn): void;
}


// class DefaultKMTrackpadStrategy implements CanvasKMTrackpadStrategy {

//     private SCROLL_SENSATIVITY: number;
//     private isDragging: boolean;
//     private dragStartPoint: Point;
    
//     constructor(){
//         this.SCROLL_SENSATIVITY = 0.005;
//         this.isDragging = false;
//     }

//     pointerDownHandler(e: PointerEvent){
//         if(e.pointerType === "mouse" && (e.button == 1 || e.metaKey)){
//             this.isDragging = true;
//             this.dragStartPoint = {x: e.clientX, y: e.clientY};
//         }
//     }

//     pointerUpHandler(e: PointerEvent){
//         if(e.pointerType === "mouse"){
//             if (this.isDragging) {
//                 this.isDragging = false;
//             } else {
//                 this.UIComponentList.forEach((component)=>{
//                     component.raycast(this.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY}));
//                 })
//             }
//             this._canvas.style.cursor = "auto";
//         }
//     }

//     pointerMoveHandler(e: PointerEvent){
//         if (e.pointerType == "mouse" && this.isDragging){
//             this._canvas.style.cursor = "move";
//             const target = {x: e.clientX, y: e.clientY};
//             let diff = PointCal.subVector(this.dragStartPoint, target);
//             diff = {x: diff.x, y: -diff.y};
//             let diffInWorld = PointCal.rotatePoint(diff, this.camera.getRotation());
//             diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.camera.getZoomLevel());
//             this.camera.moveWithClampFromGesture(diffInWorld);
//             this.dragStartPoint = target;
//         }
//     }


//     scrollHandler(e: WheelEvent, controlCamera: vCamera, coordinateConversionFn: (interestPoint: Point) => Point){
//         const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;

//         if (!e.ctrlKey){
//             //NOTE this is panning the camera
//             console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
//             const diff = {x: e.deltaX, y: e.deltaY};
//             let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), controlCamera.getRotation());
//             diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / controlCamera.getZoomLevel());
//             controlCamera.moveWithClampFromGesture(diffInWorld);
//         } else {
//             //NOTE this is zooming the camera
//             const cursorPosition = {x: e.clientX, y: e.clientY};
//             let cursorWorldPositionPriorToZoom = coordinateConversionFn(cursorPosition);
//             controlCamera.setZoomLevelWithClampFromGesture(controlCamera.getZoomLevel() - zoomAmount * 5);
//             let cursorWorldPositionAfterZoom = coordinateConversionFn(cursorPosition);
//             let diff = PointCal.subVector(cursorWorldPositionAfterZoom, cursorWorldPositionPriorToZoom);
//             diff = PointCal.multiplyVectorByScalar(diff, -1);
//             controlCamera.moveWithClampFromGesture(diff);
        
//         }
//     }
// }