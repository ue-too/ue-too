import { Point, PointCal } from "@ue-too/math";
import { Canvas, convertFromCanvas2ViewPort, convertFromViewPort2Canvas, convertFromCanvas2Window, convertFromWorld2Viewport, convertFromViewport2World, convertFromWindow2Canvas, ObservableBoardCamera, SynchronousObservable, Observer, SubscriptionOptions } from "@ue-too/board";

export interface EditorImage {
    src: string;
    position: Point;
    width: number;
    height: number;
}

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Screen-space hit radius in pixels for resize handles. */
const HANDLE_HIT_RADIUS_PX = 15;

/**
 * Engine for image editing: holds imported image data (world space),
 * hit-testing for drag and resize handles, and observables for changes.
 */
export class ImageEditorEngine {

    private _image: EditorImage | null = null;
    private _camera: ObservableBoardCamera;
    private _canvas: Canvas;
    private _imageChangedObservable: SynchronousObservable<[EditorImage | null]>;
    private _selectedHandle: ResizeHandle | null = null;
    private _isDragging = false;
    private _dragOffset: Point = { x: 0, y: 0 };
    private _resizeAnchor: Point = { x: 0, y: 0 };
    private _resizeAspectRatio = 1;
    private _resizeOriginalWidth = 0;
    private _resizeOriginalHeight = 0;

    constructor(camera: ObservableBoardCamera, canvas: Canvas) {
        this._camera = camera;
        this._canvas = canvas;
        this._imageChangedObservable = new SynchronousObservable<[EditorImage | null]>();
    }

    getImage(): EditorImage | null {
        return this._image;
    }

    setImage(src: string, width: number, height: number): void {
        this._image = {
            src,
            position: { x: 0, y: 0 },
            width,
            height,
        };
        this._imageChangedObservable.notify(this._image);
    }

    clearImage(): void {
        this._image = null;
        this._selectedHandle = null;
        this._isDragging = false;
        this._imageChangedObservable.notify(null);
    }

    onImageChanged(observer: Observer<[EditorImage | null]>, options?: SubscriptionOptions) {
        return this._imageChangedObservable.subscribe(observer, options);
    }

    /**
     * Manually notify observers of the current image state.
     * Used after restoring image position from imported data.
     */
    notifyChange(): void {
        this._imageChangedObservable.notify(this._image);
    }

    /**
     * Hit-test a world position against the image body (for dragging).
     */
    projectOnImage(worldPos: Point): boolean {
        if (!this._image) return false;
        const img = this._image;
        const halfW = img.width / 2;
        const halfH = img.height / 2;
        return (
            worldPos.x >= img.position.x - halfW &&
            worldPos.x <= img.position.x + halfW &&
            worldPos.y >= img.position.y - halfH &&
            worldPos.y <= img.position.y + halfH
        );
    }

    /**
     * Hit-test a world position against resize handles. Returns the handle if hit.
     */
    projectOnHandle(worldPos: Point): ResizeHandle | null {
        if (!this._image) return null;
        const corners = this._getCorners();
        const handleRadius = HANDLE_HIT_RADIUS_PX / this._camera.zoomLevel;
        for (const [handle, corner] of Object.entries(corners) as [ResizeHandle, Point][]) {
            if (PointCal.distanceBetweenPoints(worldPos, corner) < handleRadius) {
                return handle;
            }
        }
        return null;
    }

    startDrag(worldPos: Point): void {
        if (!this._image) return;
        this._isDragging = true;
        this._dragOffset = {
            x: worldPos.x - this._image.position.x,
            y: worldPos.y - this._image.position.y,
        };
    }

    startResize(handle: ResizeHandle, _worldPos: Point): void {
        this._selectedHandle = handle;
        if (!this._image) return;
        const corners = this._getCorners();
        const oppositeMap: Record<ResizeHandle, ResizeHandle> = {
            'top-left': 'bottom-right',
            'top-right': 'bottom-left',
            'bottom-left': 'top-right',
            'bottom-right': 'top-left',
        };
        this._resizeAnchor = corners[oppositeMap[handle]];
        this._resizeAspectRatio = this._image.width / this._image.height;
        this._resizeOriginalWidth = this._image.width;
        this._resizeOriginalHeight = this._image.height;
    }

    updateDrag(worldPos: Point): void {
        if (!this._image) return;

        if (this._isDragging) {
            this._image.position = {
                x: worldPos.x - this._dragOffset.x,
                y: worldPos.y - this._dragOffset.y,
            };
            this._imageChangedObservable.notify(this._image);
        } else if (this._selectedHandle) {
            // Resize proportionally: use the diagonal distance to determine scale
            const dx = worldPos.x - this._resizeAnchor.x;
            const dy = worldPos.y - this._resizeAnchor.y;

            // Project the mouse offset onto the diagonal direction to get a single scale factor
            const diagX = this._resizeOriginalWidth;
            const diagY = this._resizeOriginalHeight;
            const diagLen = Math.sqrt(diagX * diagX + diagY * diagY);
            if (diagLen < 0.001) return;

            // Use signed projection so dragging inward shrinks
            const signX = Math.sign(dx) || 1;
            const signY = Math.sign(dy) || 1;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Use the larger axis movement to determine scale
            const scaleFromX = absDx / this._resizeOriginalWidth;
            const scaleFromY = absDy / this._resizeOriginalHeight;
            const scale = Math.max(scaleFromX, scaleFromY);

            const newWidth = this._resizeOriginalWidth * scale;
            const newHeight = this._resizeOriginalHeight * scale;

            if (newWidth > 0.1 && newHeight > 0.1) {
                this._image.width = newWidth;
                this._image.height = newHeight;
                this._image.position = {
                    x: this._resizeAnchor.x + (signX * newWidth) / 2,
                    y: this._resizeAnchor.y + (signY * newHeight) / 2,
                };
                this._imageChangedObservable.notify(this._image);
            }
        }
    }

    endInteraction(): void {
        this._isDragging = false;
        this._selectedHandle = null;
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

    setup(): void { }
    cleanup(): void { }

    private _getCorners(): Record<ResizeHandle, Point> {
        const img = this._image!;
        const halfW = img.width / 2;
        const halfH = img.height / 2;
        return {
            'top-left': { x: img.position.x - halfW, y: img.position.y - halfH },
            'top-right': { x: img.position.x + halfW, y: img.position.y - halfH },
            'bottom-left': { x: img.position.x - halfW, y: img.position.y + halfH },
            'bottom-right': { x: img.position.x + halfW, y: img.position.y + halfH },
        };
    }
}
