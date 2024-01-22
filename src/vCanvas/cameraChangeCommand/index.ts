import vCamera from "../../vCamera";
import { Point } from "point2point";

export * from "./cameraObserver";
export interface CameraChangeCommand {
    execute(): void;
}

export class CameraMoveCommand implements CameraChangeCommand {

    constructor(private camera: vCamera, private diff: Point) { }

    execute(): void {
        this.camera.moveWithClampFromGesture(this.diff);
    }
}

export class CameraMoveLimitEntireViewPortCommand implements CameraChangeCommand {
    
    constructor(private camera: vCamera, private diff: Point) { }

    execute(): void {
        this.camera.moveWithClampEntireViewPortFromGesture(this.diff);
    }
}

export class CameraZoomCommand implements CameraChangeCommand {
    constructor(private camera: vCamera, private zoomAmount: number, private anchorPoint: Point) { }

    execute(): void {
        this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.zoomAmount, this.anchorPoint);
    }
}

export class CameraZoomLimitEntireViewPortCommand implements CameraChangeCommand {
    constructor(private camera: vCamera, private zoomAmount: number, private anchorPoint: Point) { }

    execute(): void {
        this.camera.setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(this.zoomAmount, this.anchorPoint);
    }
}

export class CameraRotateCommand implements CameraChangeCommand {
    constructor(private camera: vCamera, private deltaRotation: number) { }

    execute(): void {
        this.camera.spinFromGesture(this.deltaRotation);
    }
}

