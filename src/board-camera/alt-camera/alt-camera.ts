import { PointCal } from "point2point";
import { Point } from "src/index";
import { BoardCamera } from "../interface";
import { CameraEvent, CameraObserver, CameraState, UnSubscribe } from "src/camera-observer";
import { Boundaries, withinBoundaries } from "../utils/position";
import { ZoomLevelLimits, zoomLevelWithinLimits } from "../utils/zoom";
import { RotationLimits, rotationWithinLimits } from "../utils/rotation";

type Transform = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

export class ContextCentricCamera implements BoardCamera {

    private _contextPosition: Point;
    private _contextRotation: number;
    private _zoomLevel: number;
    private _viewPortWidth: number;
    private _viewPortHeight: number;
    private _observer: CameraObserver;
    private _boundaries: Boundaries;
    private _zoomBoundaries: ZoomLevelLimits;
    private _rotationBoundaries: RotationLimits;

    constructor(position: Point = {x: 0, y: 0}, rotation: number = 0, zoomLevel: number = 1, viewPortWidth: number = 1000, viewPortHeight: number = 1000, observer: CameraObserver = new CameraObserver(), boundaries: Boundaries = {min: {x: -10000, y: -10000}, max: {x: 10000, y: 10000}}, zoomLevelBoundaries: ZoomLevelLimits = {min: 0.1, max: 10}, rotationBoundaries: RotationLimits = {start: 0, end: 2 * Math.PI, ccw: true, startAsTieBreaker: false}){
        this._contextRotation = -rotation;
        this._zoomLevel = zoomLevel;
        this._contextPosition  = PointCal.subVector({x: viewPortWidth / 2, y: viewPortHeight / 2}, PointCal.multiplyVectorByScalar(PointCal.rotatePoint(position, -rotation), zoomLevel))
        this._viewPortWidth = viewPortWidth;
        this._viewPortHeight = viewPortHeight;
        this._observer = observer;
        this._boundaries = boundaries;
        this._rotationBoundaries = rotationBoundaries;
        this._zoomBoundaries = zoomLevelBoundaries;
    }

    get position(): Point {
        const x = (this._viewPortWidth / 2 - this._contextPosition.x) / this._zoomLevel;
        const y = (this._viewPortHeight / 2 - this._contextPosition.y) / this._zoomLevel;
        return PointCal.rotatePoint({x, y}, -this._contextRotation);
    }

    get contextTransform() {
        return {
            position: this._contextPosition,
            rotation: this._contextRotation,
            zoomLevel: this._zoomLevel
        }
    }

    setPosition(destination: Point): void {
        if(withinBoundaries(destination, this._boundaries)){
            const destinationInAbsoluteCoordinate  = PointCal.subVector({x: this._viewPortWidth / 2, y: this._viewPortHeight / 2}, PointCal.multiplyVectorByScalar(PointCal.rotatePoint(destination, -this.rotation), this._zoomLevel))
            this._contextPosition = destinationInAbsoluteCoordinate;
            this._observer.notifyPositionChange(PointCal.subVector(destinationInAbsoluteCoordinate, this._contextPosition), {position: this.position, rotation: this.rotation, zoomLevel: this.zoomLevel})
        }
    }

    // delta is in world "stage/context" space
    setPositionByDelta(delta: Point): void {
        const destination = PointCal.addVector(this.position, delta);
        this.setPosition(destination);
    }

    setPositionWithUserInputDelta(delta: Point): void {
        this._contextPosition = PointCal.addVector(this._contextPosition, delta);
    }

    getCameraOriginInWindow(centerInWindow: Point): Point{
        return {x: centerInWindow.x - this._viewPortWidth / 2, y: centerInWindow.y - this._viewPortHeight / 2};
    }

    // the point is relative to the center of the view port
    convertFromViewPort2WorldSpace(point: Point): Point {
        const convertedPoint = {x: point.x + this._viewPortWidth / 2, y: point.y + this._viewPortHeight / 2};
        return PointCal.multiplyVectorByScalar(PointCal.rotatePoint(PointCal.subVector(convertedPoint, this._contextPosition), -this._contextRotation), 1 / this._zoomLevel);
    }

    setZoomLevel(zoomLevel: number): void {
        if(zoomLevelWithinLimits(zoomLevel, this._zoomBoundaries)){
            const deltaZoom = zoomLevel - this._zoomLevel;
            this._zoomLevel = zoomLevel;
            this._observer.notifyZoomChange(deltaZoom, {position: this.position, zoomLevel: this._zoomLevel, rotation: this._contextRotation});
        }
    }

    setRotation(rotation: number): void {
        const destination = -rotation;
        if(rotationWithinLimits(destination, this._rotationBoundaries)){
            this._contextRotation = destination;
            this._observer.notifyRotationChange(rotation - this._contextRotation, {position: this.position, rotation: rotation, zoomLevel: this.zoomLevel});
        }
    }

    get observer(): CameraObserver {
        return this._observer;
    }

    get zoomLevel(): number {
        return this._zoomLevel;
    }

    get rotation(): number {
        return -this._contextRotation;
    }

    getTransform(canvasWidth: number, canvasHeight: number, devicePixelRatio: number, alignCoorindate: boolean): Transform {
        const e = this._contextPosition.x * devicePixelRatio;
        const f = this._contextPosition.y * devicePixelRatio;
        const c = -Math.sin(this._contextRotation) * this._zoomLevel * devicePixelRatio;
        const a = this._zoomLevel * Math.cos(this._contextRotation) * devicePixelRatio;
        const b = Math.sin(this._contextRotation) * this._zoomLevel * devicePixelRatio;
        const d = this._zoomLevel * Math.cos(this._contextRotation) * devicePixelRatio;
        return {a, b, c, d, e, f};
    }

    get viewPortWidth(): number {
        return this._viewPortWidth;
    }

    get viewPortHeight(): number {
        return this._viewPortHeight;
    }

    set viewportWidth(width: number){
        this._viewPortWidth = width;
    }

    set viewportHeight(height: number){
        this._viewPortHeight = height;
    }

    get zoomBoundaries(): ZoomLevelLimits {
        return this._zoomBoundaries;
    }

    get rotationBoundaries(): RotationLimits {
        return this._rotationBoundaries;
    }

    viewPortDelta2WorldDelta(delta: Point): Point {
        return delta;
    }

    setMinZoomLevel(minZoomLevel: number): boolean {
        if(this._zoomBoundaries == undefined){
            this._zoomBoundaries = {min: undefined, max: undefined};
        }
        if((this._zoomBoundaries.max != undefined && this._zoomBoundaries.max < minZoomLevel)){
            return false;
        }
        this._zoomBoundaries.min = minZoomLevel;
        if(this._zoomLevel < minZoomLevel){
            this._zoomLevel = minZoomLevel;
        }
        this._zoomBoundaries.min = minZoomLevel;
        return true;
    }

    setHorizontalBoundaries(min: number, max: number): void {
        this._boundaries.min.x = min;
        this._boundaries.max.x = max;
    }

    setVerticalBoundaries(min: number, max: number): void {
        this._boundaries.min.y = min;
        this._boundaries.max.y = max;
    }

    on<K extends keyof CameraEvent>(eventName: K, callback: (event: CameraEvent[K], cameraState: CameraState) => void): UnSubscribe {
        return this._observer.on(eventName, callback);
    }

    set viewPortWidth(width: number){
        this._viewPortWidth = width;
    }

    set viewPortHeight(height: number){
        this._viewPortHeight = height;
    }
}
