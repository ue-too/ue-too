import { Point, PointCal } from "@ue-too/math";
import { BogieContext } from "./bogie-kmt-state-machine";
import { Canvas, convertFromCanvas2ViewPort, convertFromViewPort2Canvas, convertFromCanvas2Window, convertFromWorld2Viewport, convertFromViewport2World, convertFromWindow2Canvas, ObservableBoardCamera, SynchronousObservable, Observer, SubscriptionOptions } from "@ue-too/board";

const BOGIE_RADIUS = 0.5;

/**
 * Engine for the bogie editor: holds bogie positions (world space), hit-testing,
 * and observables for position changes, add, and remove.
 */
export class BogieEditorEngine implements BogieContext {

    private _currentPosition: Point = { x: 0, y: 0 };
    private _bogies: Point[] = [];
    private _currentBogie: number | null = null;

    private _camera: ObservableBoardCamera;
    private _canvas: Canvas;
    private _positionObservable: SynchronousObservable<[number, Point]>;
    private _bogieAddedObservable: SynchronousObservable<[number, Point]>;
    private _bogieRemovedObservable: SynchronousObservable<[number]>;

    constructor(camera: ObservableBoardCamera, canvas: Canvas) {
        this._camera = camera;
        this._canvas = canvas;
        this._positionObservable = new SynchronousObservable<[number, Point]>();
        this._bogieAddedObservable = new SynchronousObservable<[number, Point]>();
        this._bogieRemovedObservable = new SynchronousObservable<[number]>();
    }

    /**
     * Returns a readonly snapshot of current bogie positions (world coordinates).
     */
    getBogies(): readonly Point[] {
        return this._bogies;
    }

    projectOnBogie(position: Point): boolean {
        const res = this._bogies.findIndex(bogie => PointCal.distanceBetweenPoints(position, bogie) < BOGIE_RADIUS);
        if (res !== -1) {
            this._currentBogie = res;
            return true;
        }
        return false;
    }

    setCurrentPosition(position: Point) {
        if (this._currentBogie !== null && this._bogies[this._currentBogie] !== undefined) {
            this._bogies[this._currentBogie] = position;
            this._positionObservable.notify(this._currentBogie, position);
        }
        this._currentPosition = position;
    }

    onBogiePositionChanged(observer: Observer<[number, Point]>, options?: SubscriptionOptions) {
        return this._positionObservable.subscribe(observer, options);
    }

    onBogieAdded(observer: Observer<[number, Point]>, options?: SubscriptionOptions) {
        return this._bogieAddedObservable.subscribe(observer, options);
    }

    onBogieRemoved(observer: Observer<[number]>, options?: SubscriptionOptions) {
        return this._bogieRemovedObservable.subscribe(observer, options);
    }

    addBogie(position: Point): number {
        const index = this._bogies.length;
        this._bogies.push({ ...position });
        this._bogieAddedObservable.notify(index, this._bogies[index]);
        return index;
    }

    removeBogie(index: number): boolean {
        if (index < 0 || index >= this._bogies.length) return false;
        this._bogies.splice(index, 1);
        if (this._currentBogie === index) {
            this._currentBogie = null;
        } else if (this._currentBogie !== null && this._currentBogie > index) {
            this._currentBogie--;
        }
        this._bogieRemovedObservable.notify(index);
        return true;
    }


    setup(): void {
    }

    cleanup(): void {
    }

    convert2WorldPosition(pointInWindow: Point): Point {
        const pointInCanvas = convertFromWindow2Canvas(pointInWindow, this._canvas);
        const pointInViewport = convertFromCanvas2ViewPort(pointInCanvas, { x: this._canvas.width / 2, y: this._canvas.height / 2 });

        return convertFromViewport2World(pointInViewport, this._camera.position, this._camera.zoomLevel, this._camera.rotation);
    }

    convert2WindowPosition(pointInWorld: Point): Point {
        const pointInViewport = convertFromWorld2Viewport(pointInWorld, this._camera.position, this._camera.zoomLevel, this._camera.rotation);
        const pointInCanvas = convertFromViewPort2Canvas(pointInViewport, { x: this._canvas.width / 2, y: this._canvas.height / 2 });
        return convertFromCanvas2Window(pointInCanvas, this._canvas);
    }

    getCurrentPosition(): Point {
        return this._currentPosition;
    }

    dropCurrentBogie() {
        this._currentBogie = null;
        this._currentPosition = { x: 0, y: 0 };
    }
}
