import { Point } from "point2point";
import { Observable, Observer } from "../util/observable";

export type CameraPanEventPayload = {
    diff: Point;
}

export type CameraZoomEventPayload = {
    deltaZoomAmount: number;
}

export type CameraRotateEventPayload = {
    deltaRotation: number;
}

export type CameraEventMap = {
    "pan": CameraPanEventPayload,
    "zoom": CameraZoomEventPayload,
    "rotate": CameraRotateEventPayload,
    "all": CameraEvent,
}

export type CameraRotateEvent = {
    type: "rotate",
} & CameraRotateEventPayload;

export type CameraPanEvent = {
    type: "pan",
} & CameraPanEventPayload;

export type CameraZoomEvent = {
    type: "zoom",
} & CameraZoomEventPayload;

export type CameraState = {
    position: Point;
    zoomLevel: number;
    rotation: number;
}

export type CameraEvent = CameraRotateEvent | CameraPanEvent | CameraZoomEvent;

export type CameraChangeEventName = "pan" | "zoom" | "rotate" | "all";

export type Callback<K extends keyof CameraEventMap> = (event: CameraEventMap[K], cameraState: CameraState)=>void;

export type ConslidateCallback = (payload: CameraEvent, cameraState: CameraState) => void;

export type UnSubscribe = () => void;

export type PanObserver = Callback<"pan">;

export type ZoomObserver = Callback<"zoom">;

export type RotateObserver = Callback<"rotate">;

export type AllObserver = Callback<"all">;

export class CameraObservable {

    private pan: Observable<Parameters<Callback<"pan">>>;
    private zoom: Observable<Parameters<Callback<"zoom">>>;
    private rotate: Observable<Parameters<Callback<"rotate">>>;
    private all: Observable<Parameters<Callback<"all">>>;

    constructor() {
        this.pan = new Observable<Parameters<Callback<"pan">>>();
        this.zoom = new Observable<Parameters<Callback<"zoom">>>();
        this.rotate = new Observable<Parameters<Callback<"rotate">>>();
        this.all = new Observable<Parameters<Callback<"all">>>();
    }

    notifyPan(event: CameraEventMap["pan"], cameraState: CameraState): void {
        this.pan.notify(event, cameraState);
        this.all.notify({type: "pan", diff: event.diff}, cameraState);
    }

    notifyZoom(event: CameraEventMap["zoom"], cameraState: CameraState): void {
        this.zoom.notify(event, cameraState);
        this.all.notify({type: "zoom", deltaZoomAmount: event.deltaZoomAmount}, cameraState);
    }

    notifyRotate(event: CameraEventMap["rotate"], cameraState: CameraState): void {
        this.rotate.notify(event, cameraState);
        this.all.notify({type: "rotate", deltaRotation: event.deltaRotation}, cameraState);
    }
    
    on<K extends keyof CameraEventMap>(eventName: K, callback: (event: CameraEventMap[K], cameraState: CameraState)=>void): UnSubscribe {
        switch (eventName){
        case "pan":
            return this.pan.subscribe(callback as Observer<Parameters<Callback<"pan">>>);
        case "zoom":
            return this.zoom.subscribe(callback as Observer<Parameters<Callback<"zoom">>>);
        case "rotate":
            return this.rotate.subscribe(callback as Observer<Parameters<Callback<"rotate">>>);
        case "all":
            return this.all.subscribe(callback as Observer<Parameters<Callback<"all">>>);
        default:
            throw new Error(`Invalid event name: ${eventName}`);
        }
    }
}
