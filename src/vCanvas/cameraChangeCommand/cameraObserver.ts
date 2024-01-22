import { Point } from "point2point";
import { CameraChangeCommand } from ".";
import vCamera from "../../vCamera";

export interface CameraListener {
    notifyChange(cameraInfo: CameraUpdateNotification): void;
}

export class CameraLogger {
    notifyChange(cameraInfo: CameraUpdateNotification): void {
        console.log(cameraInfo);
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

    subsribe(subscriber: CameraListener): void {
        this.subscribers.push(subscriber);
    }

    unsubscribe(subscriber: CameraListener): void {
        this.subscribers = this.subscribers.filter((s) => s !== subscriber);
    }


}