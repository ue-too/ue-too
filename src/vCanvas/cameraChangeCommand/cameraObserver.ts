import { Point } from "point2point";
import vCamera from "../../vCamera";
export interface CameraListener {
    notifyChange(cameraInfo: CameraUpdateNotification): void;
}

export class CameraLogger {
    notifyChange(cameraInfo: CameraUpdateNotification): void {
        // console.log(cameraInfo);
    }
}

export type CameraRotateEvent = {
    type: "rotate",
    deltaRotation: number
}

export type CameraMoveEvent = {
    type: "move",
    diff: Point
}

export type CameraZoomEvent = {
    type: "zoom",
    zoomAmount: number,
    anchorPoint: Point
}

export type CameraUpdateNotification = {
    position: Point;
    zoomLevel: number;
    rotation: number;
}

export type CameraChangeEvent = CameraRotateEvent | CameraMoveEvent | CameraZoomEvent;

export class CameraObserver {

    private subscribers: CameraListener[] = [];
    private camera: vCamera;

    constructor(camera: vCamera) {
        this.camera = camera;
    }
    
    executeCommand(command: CameraChangeCommand): void {
        command.execute();
        const rotation = this.camera.getRotation();
        const position = this.camera.getPosition();
        const zoomLevel = this.camera.getZoomLevel();
        this.subscribers.forEach((subscriber) => {
            subscriber.notifyChange({position, zoomLevel, rotation});
        });
    }

    subscribe(subscriber: CameraListener): void {
        this.subscribers.push(subscriber);
    }

    unsubscribe(subscriber: CameraListener): void {
        this.subscribers = this.subscribers.filter((s) => s !== subscriber);
    }

}
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
