import  CCamera  from "../board-camera";
import { Board } from "..";
import { PointCal } from "point2point";
import {  Point } from "..";
import { CameraObserver } from "./camera-change-command/camera-observer";
import { CameraMoveCommand, CameraZoomCommand, CameraZoomLimitEntireViewPortCommand, CameraMoveLimitEntireViewPortCommand } from "./camera-change-command";

export interface CanvasTrackpadStrategy {
    setUp(): void;
    tearDown(): void;
}

export class TwoFingerPanPinchZoom implements CanvasTrackpadStrategy {

    private cameraObserver: CameraObserver;
    private SCROLL_SENSATIVITY: number = 0.005;
    private canvas: Board;

    constructor(canvas: Board, cameraObserver: CameraObserver){
        this.canvas = canvas;
        this.cameraObserver = cameraObserver;
        this.scrollHandler = this.scrollHandler.bind(this);
    }

    setUp(): void{
        this.canvas.addEventListener('wheel', this.scrollHandler);
    }

    tearDown(): void{
        this.canvas.removeEventListener('wheel', this.scrollHandler);
    }


    scrollHandler(e: WheelEvent): void {
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;
        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.canvas.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
            this.cameraObserver.executeCommand(new CameraMoveCommand(this.canvas.getCamera(), diffInWorld));
        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            const cursorPosition = {x: e.clientX, y: e.clientY};
            const anchorPoint = this.canvas.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom},cursorPosition);
            const zoomLevel = this.canvas.getCamera().getZoomLevel() - (this.canvas.getCamera().getZoomLevel() * zoomAmount * 5);
            this.cameraObserver.executeCommand(new CameraZoomCommand(this.canvas.getCamera(), zoomLevel, anchorPoint));
        }

    }
}

export class TwoFingerPanPinchZoomLimitEntireView implements CanvasTrackpadStrategy {

    private SCROLL_SENSATIVITY: number;
    private canvas: Board;
    private cameraObserver: CameraObserver;

    constructor(canvas: Board, cameraObserver: CameraObserver){
        this.SCROLL_SENSATIVITY = 0.005;
        this.canvas = canvas;
        this.cameraObserver = cameraObserver;
        this.scrollHandler = this.scrollHandler.bind(this);
    }

    setUp(): void {
        this.canvas.addEventListener('wheel', this.scrollHandler);
    }

    tearDown(): void {
        this.canvas.removeEventListener('wheel', this.scrollHandler);
    }

    scrollHandler(e: WheelEvent){
        e.preventDefault();
        const zoomAmount = e.deltaY * this.SCROLL_SENSATIVITY;
        if (!e.ctrlKey){
            //NOTE this is panning the camera
            // console.log("panning?: ", (Math.abs(e.deltaY) % 40 !== 0 || Math.abs(e.deltaY) == 0) ? "yes": "no");
            // console.log("panning?", e.deltaMode == 0 ? "yes": "no");
            const diff = {x: e.deltaX, y: e.deltaY};
            let diffInWorld = PointCal.rotatePoint(PointCal.flipYAxis(diff), this.canvas.getCamera().getRotation());
            diffInWorld = PointCal.multiplyVectorByScalar(diffInWorld, 1 / this.canvas.getCamera().getZoomLevel());
            this.cameraObserver.executeCommand(new CameraMoveLimitEntireViewPortCommand(this.canvas.getCamera(), diffInWorld));
        } else {
            //NOTE this is zooming the camera
            // console.log("zooming");
            const cursorPosition = {x: e.clientX, y: e.clientY};
            const anchorPoint = this.canvas.convertWindowPoint2ViewPortPoint({x: this.canvas.getBoundingClientRect().left, y: this.canvas.getBoundingClientRect().bottom},cursorPosition);
            const zoomLevel = this.canvas.getCamera().getZoomLevel() - (this.canvas.getCamera().getZoomLevel() * zoomAmount * 5);
            this.cameraObserver.executeCommand(new CameraZoomLimitEntireViewPortCommand(this.canvas.getCamera(), zoomLevel, anchorPoint));
        }
    }
}