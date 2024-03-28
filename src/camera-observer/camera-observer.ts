import { Point } from "point2point";

export type CameraPanEventPayload = {
    diff: Point;
}

export type CameraZoomEventPayload = {
    deltaZoomAmount: number;
    anchorPoint: Point;
}

export type CameraRotateEventPayload = {
    deltaRotation: number;
}

export type CameraEventMapping = {
    "pan": CameraPanEventPayload,
    "zoom": CameraZoomEventPayload,
    "rotate": CameraRotateEventPayload
}

export type CameraRotateCommandPayload = {
    type: "rotate",
    deltaRotation: number
}

export type CameraPanCommandPayload = {
    type: "pan",
    diff: Point
}

export type CameraZoomCommandPayload = {
    type: "zoom",
    deltaZoomAmount: number,
    anchorPoint: Point
}


export type CameraUpdateNotification = {
    position: Point;
    zoomLevel: number;
    rotation: number;
}

export type CameraState = {
    position: Point;
    zoomLevel: number;
    rotation: number;
}

export type CameraCommandPayload = CameraRotateCommandPayload | CameraPanCommandPayload | CameraZoomCommandPayload;

export type CameraChangeEventName = "pan" | "zoom" | "rotate";

export type CallbackList<K extends keyof CameraEventMapping> = ((event: CameraEventMapping[K], cameraState: CameraState)=>void)[];
export class CameraObserver {

    private panCallbackList: CallbackList<"pan"> = [];
    private zoomCallbackList: CallbackList<"zoom"> = [];
    private rotateCallbackList: CallbackList<"rotate"> = [];

    constructor() {
    }

    notifyOnPositionChange(delta: Point, cameraState: CameraState): Promise<void> {
        return new Promise((resolve, reject) => {
            this.panCallbackList.forEach((callback) => {
                callback({diff: delta}, cameraState);
            });
            resolve();
        });
    }

    notifyOnZoomChange(deltaZoomAmount: number, anchorPoint: Point, cameraState: CameraState): Promise<void> {
        return new Promise((resolve, reject) => {
            this.zoomCallbackList.forEach((callback) => {
                callback({deltaZoomAmount: deltaZoomAmount, anchorPoint: anchorPoint}, cameraState);
            });
            resolve();
        });
    }

    notifyOnRotationChange(deltaRotation: number, cameraState: CameraState): Promise<void> {
        return new Promise((resolve, reject) => {
            this.rotateCallbackList.forEach((callback) => {
                callback({deltaRotation: deltaRotation}, cameraState);
            });
            resolve();
        });
    }

    on<K extends keyof CameraEventMapping>(eventName: K, callback: (event: CameraEventMapping[K], cameraState: CameraState)=>void): void {
        switch (eventName){
        case "pan":
            this.panCallbackList.push(callback as (event: CameraEventMapping["pan"], cameraState: CameraState)=>void);
            break;
        case "zoom":
            this.zoomCallbackList.push(callback as (event: CameraEventMapping["zoom"], cameraState: CameraState)=>void);
            break;
        case "rotate":
            this.rotateCallbackList.push(callback as (event: CameraEventMapping["rotate"], cameraState: CameraState)=>void);
            break;
        }
    }

    clearCallbacks(): void {
        this.panCallbackList = [];
        this.zoomCallbackList = [];
        this.rotateCallbackList = [];
    }
    
}
