import { Point, PointCal } from "@ue-too/math";
import { BogieEditContext } from "./bogie-kmt-state-machine";
import { Canvas, convertFromCanvas2ViewPort, convertFromViewPort2Canvas, convertFromCanvas2Window, convertFromWorld2Viewport, convertFromViewport2World, convertFromWindow2Canvas, ObservableBoardCamera, SynchronousObservable, Observer, SubscriptionOptions } from "@ue-too/board";

const BOGIE_RADIUS = 0.5;

/**
 * Projects a point onto a line defined by a point and direction.
 * Returns the closest point on the line to the given point.
 */
function projectPointOnLine(point: Point, lineOrigin: Point, lineDirection: Point): Point {
    const dx = point.x - lineOrigin.x;
    const dy = point.y - lineOrigin.y;
    const dot = dx * lineDirection.x + dy * lineDirection.y;
    return {
        x: lineOrigin.x + dot * lineDirection.x,
        y: lineOrigin.y + dot * lineDirection.y,
    };
}

/**
 * Engine for the bogie editor: holds bogie positions (world space), hit-testing,
 * and observables for position changes, add, and remove.
 *
 * All bogies are constrained to a single line (the car's axis).
 * The line is defined by an origin point and a unit direction vector.
 */
export class BogieEditorEngine implements BogieEditContext {

    private _currentPosition: Point = { x: 0, y: 0 };
    private _bogies: Point[] = [];
    private _currentBogie: number | null = null;

    private _lineOrigin: Point = { x: 0, y: 0 };
    private _lineDirection: Point = { x: 1, y: 0 };

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

    get lineOrigin(): Point {
        return this._lineOrigin;
    }

    get lineDirection(): Point {
        return this._lineDirection;
    }

    /**
     * Sets the constraint line. Direction will be normalized.
     */
    setLine(origin: Point, direction: Point): void {
        const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        this._lineOrigin = { ...origin };
        this._lineDirection = mag > 0
            ? { x: direction.x / mag, y: direction.y / mag }
            : { x: 1, y: 0 };
    }

    /**
     * Projects a world-space point onto the constraint line.
     */
    projectOnLine(position: Point): Point {
        return projectPointOnLine(position, this._lineOrigin, this._lineDirection);
    }

    /**
     * Returns a readonly snapshot of current bogie positions (world coordinates).
     */
    getBogies(): readonly Point[] {
        return this._bogies;
    }

    /**
     * Hit-tests a world-space position against all bogies.
     * If a bogie is within BOGIE_RADIUS, it becomes the current selection.
     */
    projectOnBogie(position: Point): boolean {
        const res = this._bogies.findIndex(bogie => PointCal.distanceBetweenPoints(position, bogie) < BOGIE_RADIUS);
        if (res !== -1) {
            this._currentBogie = res;
            return true;
        }
        return false;
    }

    /**
     * Sets the current position (world space). If a bogie is selected,
     * projects the position onto the constraint line and moves it there.
     */
    setCurrentPosition(position: Point) {
        const projected = this.projectOnLine(position);
        if (this._currentBogie !== null && this._bogies[this._currentBogie] !== undefined) {
            this._bogies[this._currentBogie] = projected;
            this._positionObservable.notify(this._currentBogie, projected);
        }
        this._currentPosition = projected;
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
        const projected = this.projectOnLine(position);
        const index = this._bogies.length;
        this._bogies.push({ ...projected });
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

    /**
     * Computes a car definition from the current bogie positions.
     * Bogies are sorted by their projection along the constraint line.
     * Returns bogieOffsets (distances between consecutive bogies),
     * edgeToBogie (leading edge to first bogie), and bogieToEdge (last bogie to trailing edge).
     *
     * @param edgeToBogie - Distance from leading car edge to first bogie (default 2.5)
     * @param bogieToEdge - Distance from last bogie to trailing car edge (default 2.5)
     */
    exportCarDefinition(edgeToBogie: number = 2.5, bogieToEdge: number = 2.5): {
        bogieOffsets: number[];
        edgeToBogie: number;
        bogieToEdge: number;
    } | null {
        if (this._bogies.length < 2) return null;

        // Project each bogie onto the line and get the signed distance from lineOrigin
        const dir = this._lineDirection;
        const origin = this._lineOrigin;
        const projections = this._bogies.map(bogie => {
            const dx = bogie.x - origin.x;
            const dy = bogie.y - origin.y;
            return dx * dir.x + dy * dir.y;
        });

        // Sort by projection value
        const sorted = [...projections].sort((a, b) => a - b);

        // Compute distances between consecutive bogies
        const bogieOffsets: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
            bogieOffsets.push(sorted[i] - sorted[i - 1]);
        }

        return { bogieOffsets, edgeToBogie, bogieToEdge };
    }
}
