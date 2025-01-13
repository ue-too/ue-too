import { Point } from "point2point";

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
    "rotate": CameraRotateEvent,
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
}

export type CameraState = {
    position: Point;
    zoomLevel: number;
    rotation: number;
}

export type CameraCommandPayload = CameraRotateCommandPayload | CameraPanCommandPayload | CameraZoomCommandPayload;

export type CameraChangeEventName = "pan" | "zoom" | "rotate";

export type CallbackList<K extends keyof CameraEvent> = ((event: CameraEvent[K], cameraState: CameraState)=>void)[];

export type ConslidateCallback = (payload: CameraCommandPayload, cameraState: CameraState) => void;

export type UnSubscribe = () => void;

/**
 * @category Camera Observer
 */
export class CameraObserver {

    private panCallbackList: CallbackList<"pan"> = [];
    private zoomCallbackList: CallbackList<"zoom"> = [];
    private rotateCallbackList: CallbackList<"rotate"> = [];
    private consolidateCallbackList: ConslidateCallback[] = [];

    constructor() {
    }

    async notifyPositionChange(delta: Point, cameraState: CameraState): Promise<void> {
        queueMicrotask(()=>{this.panCallbackList.forEach((callback) => {
            callback({ diff: delta }, cameraState);
        });});

        queueMicrotask(()=>{this.consolidateCallbackList.forEach((callback) => {
            callback({type: "pan", diff: delta}, cameraState);
        });});
    }

    async notifyZoomChange(deltaZoomAmount: number, cameraState: CameraState): Promise<void> {
        queueMicrotask(()=>{this.zoomCallbackList.forEach((callback) => {
            callback({ deltaZoomAmount: deltaZoomAmount }, cameraState);
        });});

        queueMicrotask(()=>{this.consolidateCallbackList.forEach((callback) => {
            callback({type: "zoom", deltaZoomAmount: deltaZoomAmount}, cameraState);
        });});
    }

    async notifyRotationChange(deltaRotation: number, cameraState: CameraState): Promise<void> {
        queueMicrotask(()=>{this.rotateCallbackList.forEach((callback) => {
            callback({ deltaRotation: deltaRotation }, cameraState);
        });});

        queueMicrotask(()=>{this.consolidateCallbackList.forEach((callback) => {
            callback({type: "rotate", deltaRotation: deltaRotation}, cameraState);
        });});
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

    onAllUpdate(callback: ConslidateCallback): UnSubscribe {
        this.consolidateCallbackList.push(callback);
        return ()=>{this.consolidateCallbackList = this.consolidateCallbackList.filter((cb) => cb !== callback)};
    }

    clearCallbacks(): void {
        this.panCallbackList = [];
        this.zoomCallbackList = [];
        this.rotateCallbackList = [];
    }
    
}
