import { Container, Graphics, Sprite, Texture, Assets } from "pixi.js";
import type { ImageEditorEngine, EditorImage } from "./image-editor-engine";
import type { ObservableBoardCamera, CameraState, CameraZoomEventPayload } from "@ue-too/board";

/** Screen-space radius for visual handle circles (pixels). */
const HANDLE_VISUAL_RADIUS_PX = 5;
const HANDLE_COLOR = 0x3498db;
/** Screen-space border stroke width (pixels). */
const BORDER_WIDTH_PX = 1.5;

/**
 * Renders the editor image and resize handles into a Pixi container.
 * Subscribes to ImageEditorEngine for updates.
 */
export class ImageRenderSystem {
    private _container: Container;
    private _engine: ImageEditorEngine;
    private _camera: ObservableBoardCamera;
    private _sprite: Sprite | null = null;
    private _handles: Graphics;
    private _border: Graphics;
    private _unsubscribe: (() => void) | null = null;
    private _abortController: AbortController = new AbortController();
    private _showHandles = false;
    private _zoomLevel = 1;

    constructor(engine: ImageEditorEngine, camera: ObservableBoardCamera) {
        this._container = new Container();
        this._engine = engine;
        this._camera = camera;
        this._zoomLevel = camera.zoomLevel;
        this._handles = new Graphics();
        this._border = new Graphics();
        this._container.addChild(this._border);
        this._container.addChild(this._handles);
    }

    get container(): Container {
        return this._container;
    }

    set showHandles(value: boolean) {
        this._showHandles = value;
        this._handles.visible = value;
        this._border.visible = value;
        // Redraw handles at current zoom
        const currentImage = this._engine.getImage();
        if (currentImage && value) {
            this._drawHandlesAndBorder(currentImage);
        }
    }

    setup(): void {
        this._unsubscribe = this._engine.onImageChanged(
            (image: EditorImage | null) => this._onImageChanged(image)
        );
        this._camera.on('zoom', (_event: CameraZoomEventPayload, state: CameraState) => {
            this._zoomLevel = state.zoomLevel;
            const currentImage = this._engine.getImage();
            if (currentImage && this._showHandles) {
                this._drawHandlesAndBorder(currentImage);
            }
        }, { signal: this._abortController.signal });

        const currentImage = this._engine.getImage();
        if (currentImage) {
            this._onImageChanged(currentImage);
        }
    }

    cleanup(): void {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        this._abortController.abort();
        this._abortController = new AbortController();
        if (this._sprite) {
            this._container.removeChild(this._sprite);
            this._sprite.destroy();
            this._sprite = null;
        }
    }

    private async _onImageChanged(image: EditorImage | null): Promise<void> {
        if (!image) {
            if (this._sprite) {
                this._container.removeChild(this._sprite);
                this._sprite.destroy();
                this._sprite = null;
            }
            this._handles.clear();
            this._border.clear();
            return;
        }

        if (!this._sprite || this._sprite.label !== image.src) {
            if (this._sprite) {
                this._container.removeChild(this._sprite);
                this._sprite.destroy();
            }
            const texture = await Assets.load(image.src) as Texture;
            this._sprite = new Sprite(texture);
            this._sprite.label = image.src;
            this._sprite.anchor.set(0.5, 0.5);
            this._container.addChildAt(this._sprite, 0);
        }

        this._sprite.position.set(image.position.x, image.position.y);
        this._sprite.width = image.width;
        this._sprite.height = image.height;

        this._drawHandlesAndBorder(image);
    }

    private _drawHandlesAndBorder(image: EditorImage): void {
        const halfW = image.width / 2;
        const halfH = image.height / 2;
        const x = image.position.x;
        const y = image.position.y;
        const handleRadius = HANDLE_VISUAL_RADIUS_PX / this._zoomLevel;
        const borderWidth = BORDER_WIDTH_PX / this._zoomLevel;

        this._border.clear();
        if (this._showHandles) {
            this._border.rect(x - halfW, y - halfH, image.width, image.height);
            this._border.stroke({ color: HANDLE_COLOR, width: borderWidth });
        }

        this._handles.clear();
        if (this._showHandles) {
            const corners = [
                { x: x - halfW, y: y - halfH },
                { x: x + halfW, y: y - halfH },
                { x: x - halfW, y: y + halfH },
                { x: x + halfW, y: y + halfH },
            ];
            for (const corner of corners) {
                this._handles.circle(corner.x, corner.y, handleRadius);
                this._handles.fill({ color: HANDLE_COLOR });
                this._handles.stroke({ color: 0xffffff, pixelLine: true });
            }
        }
    }
}
