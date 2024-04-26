import { BoardCamera } from "src/board-camera";
import { PanController, PanHandler, ZoomHandler, ZoomController } from "src/board-camera";

export interface BoardCameraSubscriber {
    updateCamera(camera: BoardCamera): void;
}

export interface BoardPanHandlerSubscriber {
    updatePanHandler(panHandler: PanHandler): void;
}

export interface BoardZoomHandlerSubscriber {
    updateZoomHandler(zoomHandler: ZoomHandler): void;
}

export class BoardStateObserver {
    
    private _camera: BoardCamera;
    private _panHandler: PanController; 
    private _zoomHandler: ZoomController;

    private cameraSubscribers: BoardCameraSubscriber[] = [];
    private panHandlerSubscribers: BoardPanHandlerSubscriber[] = [];
    private zoomHandlerSubscribers: BoardZoomHandlerSubscriber[] = [];

    constructor(camera: BoardCamera){
        this._camera = camera;
    }

    subscribeToCamera(subscriber: BoardCameraSubscriber){
        this.cameraSubscribers.push(subscriber);
    }

    unsubscribeToCamera(subscriber: BoardCameraSubscriber){
        this.cameraSubscribers = this.cameraSubscribers.filter((sub) => sub !== subscriber);
    }

    subscribeToPanHandler(subscriber: BoardPanHandlerSubscriber){
        this.panHandlerSubscribers.push(subscriber);
    }

    unsubscribeToPanHandler(subscriber: BoardPanHandlerSubscriber){
        this.panHandlerSubscribers = this.panHandlerSubscribers.filter((sub) => sub !== subscriber);
    }

    subscribeToZoomHandler(subscriber: BoardZoomHandlerSubscriber){
        this.zoomHandlerSubscribers.push(subscriber);
    }

    unsubscribeToZoomHandler(subscriber: BoardZoomHandlerSubscriber){
        this.zoomHandlerSubscribers = this.zoomHandlerSubscribers.filter((sub) => sub !== subscriber);
    }

    get camera(): BoardCamera{
        return this._camera;
    }

    set camera(camera: BoardCamera){
        this._camera = camera;
        this.notifyCameraChange();
    }

    get panHandler(): PanController{
        return this._panHandler;
    }

    set panHandler(panHandler: PanController){
        this._panHandler = panHandler;
        this.notifyPanHandlerChange();
    }

    get zoomHandler(): ZoomController{
        return this._zoomHandler;
    }

    set zoomHandler(zoomHandler: ZoomController){
        this._zoomHandler = zoomHandler;
        this.notifyZoomHandlerChange();
    }

    notifyCameraChange(){
        this.cameraSubscribers.forEach((sub) => sub.updateCamera(this._camera));
    }

    notifyPanHandlerChange(){
        this.panHandlerSubscribers.forEach((sub) => sub.updatePanHandler(this._panHandler));
    }
    
    notifyZoomHandlerChange(){
        this.zoomHandlerSubscribers.forEach((sub) => sub.updateZoomHandler(this._zoomHandler));
    }
    
}
