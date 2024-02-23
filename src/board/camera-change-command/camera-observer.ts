import { Point } from "point2point";
import BoardCamera from "../../board-camera";

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

export interface CameraListener {
    notifyChange(cameraInfo: CameraUpdateNotification): void;
}

export class CameraLogger {
    notifyChange(cameraInfo: CameraUpdateNotification): void {
        // console.log(cameraInfo);
    }
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

    private subscribers: CameraListener[] = [];
    private camera: BoardCamera;
    private panCallbackList: CallbackList<"pan"> = [];
    private zoomCallbackList: CallbackList<"zoom"> = [];
    private rotateCallbackList: CallbackList<"rotate"> = [];

    constructor(camera: BoardCamera) {
        this.camera = camera;
    }
    
    executeCommand(command: CameraChangeCommand): void {
        const res = command.execute();
        if(!res) return;
        const payload = command.commandPayload;

        const rotation = this.camera.getRotation();
        const position = this.camera.getPosition();
        const zoomLevel = this.camera.getZoomLevel();

        switch(payload.type){
        case "pan":
            this.panCallbackList.forEach((callback) => callback(payload, {position: position, zoomLevel: zoomLevel, rotation: rotation}));
            break;
        case "zoom":
            this.zoomCallbackList.forEach((callback) => callback(payload, {position: position, zoomLevel: zoomLevel, rotation: rotation}));
            break;
        case "rotate":
            this.rotateCallbackList.forEach((callback) => callback(payload, {position: position, zoomLevel: zoomLevel, rotation: rotation}));
            break;
        }
    }
    
    subscribe(subscriber: CameraListener): void {
        this.subscribers.push(subscriber);
    }

    unsubscribe(subscriber: CameraListener): void {
        this.subscribers = this.subscribers.filter((s) => s !== subscriber);
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

export interface CameraChangeCommand {
    execute(): boolean;
    commandPayload: CameraCommandPayload;
}

export class CameraMoveCommand implements CameraChangeCommand {

    constructor(private camera: BoardCamera, private diff: Point) { }

    execute(): boolean {
        return this.camera.moveWithClampFromGesture(this.diff);
    }

    get commandPayload(): CameraPanCommandPayload {
        return {
            type: "pan",
            diff: this.diff
        }
    }
}

export class CameraMoveLimitEntireViewPortCommand implements CameraChangeCommand {
    
    constructor(private camera: BoardCamera, private diff: Point) { }

    execute(): boolean {
        return this.camera.moveWithClampEntireViewPortFromGesture(this.diff);
    }

    get commandPayload(): CameraPanCommandPayload {
        return {
            type: "pan",
            diff: this.diff
        }
    }
}

export class CameraZoomCommand implements CameraChangeCommand {
    constructor(private camera: BoardCamera, private zoomAmount: number, private anchorPoint: Point) { }

    execute(): boolean {
        return this.camera.setZoomLevelWithClampFromGestureAtAnchorPoint(this.zoomAmount, this.anchorPoint);
    }

    get commandPayload(): CameraZoomCommandPayload {
        return {
            type: "zoom",
            deltaZoomAmount: this.zoomAmount,
            anchorPoint: this.anchorPoint
        }
    }
}

export class CameraZoomLimitEntireViewPortCommand implements CameraChangeCommand {
    constructor(private camera: BoardCamera, private zoomAmount: number, private anchorPoint: Point) { }

    execute(): boolean {
        return this.camera.setZoomLevelWithClampEntireViewPortFromGestureAtAnchorPoint(this.zoomAmount, this.anchorPoint);
    }

    get commandPayload(): CameraZoomCommandPayload {
        return {
            type: "zoom",
            deltaZoomAmount: this.zoomAmount,
            anchorPoint: this.anchorPoint
        }
    }
}

export class CameraRotateCommand implements CameraChangeCommand {
    constructor(private camera: BoardCamera, private deltaRotation: number) { }

    execute(): boolean {
        return this.camera.spinFromGesture(this.deltaRotation);
    }

    get commandPayload(): CameraRotateCommandPayload {
        return {
            type: "rotate",
            deltaRotation: this.deltaRotation
        }
    }
}
