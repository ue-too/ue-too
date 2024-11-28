import { Point } from "point2point";

export type CameraPanEventPayload = {
    diff: Point;
}

export type CameraPanEvent = {
    diff: Point;
}

export type CameraZoomEvent = {
    deltaZoomAmount: number;
}

export type CameraRotateEvent = {
    deltaRotation: number;
}

export type CameraEvent = {
    "pan": CameraPanEvent,
    "zoom": CameraZoomEvent,
    "rotate": CameraRotateEvent
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

export type CallbackList<K extends keyof CameraEvent> = ((event: CameraEvent[K], cameraState: CameraState)=>void)[];

export type UnSubscribe = () => void;

/**
 * @category Camera Observer
 */
export class CameraObserver {

    private panCallbackList: CallbackList<"pan"> = [];
    private zoomCallbackList: CallbackList<"zoom"> = [];
    private rotateCallbackList: CallbackList<"rotate"> = [];

    constructor() {
    }

    async notifyPositionChange(delta: Point, cameraState: CameraState): Promise<void> {
        // return new Promise((resolve, reject) => {
            queueMicrotask(()=>{this.panCallbackList.forEach((callback) => {
                callback({ diff: delta }, cameraState);
            });});
        //     resolve();
        // });
    }

    async notifyZoomChange(deltaZoomAmount: number, cameraState: CameraState): Promise<void> {
        return new Promise((resolve, reject) => {
            this.zoomCallbackList.forEach((callback) => {
                callback({ deltaZoomAmount: deltaZoomAmount }, cameraState);
            });
            resolve();
        });
    }

    async notifyRotationChange(deltaRotation: number, cameraState: CameraState): Promise<void> {
        return new Promise((resolve, reject) => {
            this.rotateCallbackList.forEach((callback) => {
                callback({ deltaRotation: deltaRotation }, cameraState);
            });
            resolve();
        });
    }

    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState)=>void): UnSubscribe {
        switch (eventName){
        case "pan":
            this.panCallbackList.push(callback as (event: CameraEvent["pan"], cameraState: CameraState)=>void);
            return ()=>{this.panCallbackList = this.panCallbackList.filter((cb) => cb !== callback)};
        case "zoom":
            this.zoomCallbackList.push(callback as (event: CameraEvent["zoom"], cameraState: CameraState)=>void);
            return ()=>{this.zoomCallbackList = this.zoomCallbackList.filter((cb) => cb !== callback)};
        case "rotate":
            this.rotateCallbackList.push(callback as (event: CameraEvent["rotate"], cameraState: CameraState)=>void);
            return ()=>{this.rotateCallbackList = this.rotateCallbackList.filter((cb) => cb !== callback)};
        }
        return ()=>{};
    }

    clearCallbacks(): void {
        this.panCallbackList = [];
        this.zoomCallbackList = [];
        this.rotateCallbackList = [];
    }
    
}
