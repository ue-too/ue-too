import { Container, Graphics, Text } from "pixi.js";
import type { BogieEditorEngine } from "./bogie-editor-engine";
import type { Point } from "@ue-too/math";
import { PointCal } from "@ue-too/math";
import type { ObservableBoardCamera, CameraState, CameraZoomEventPayload } from "@ue-too/board";

const BOGIE_RADIUS = 0.5;
const BOGIE_FILL_COLOR = 0x3498db;
const BOGIE_STROKE_COLOR = 0x000000;
const LINE_COLOR = 0x888888;
const LINE_HALF_LENGTH = 500;
const LABEL_FONT_SIZE = 12;
const LABEL_OFFSET_Y = -14;
const DISTANCE_FONT_SIZE = 11;
const DISTANCE_OFFSET_Y = 14;

function createBogieCircle(): Graphics {
    const g = new Graphics();
    g.circle(0, 0, BOGIE_RADIUS);
    g.fill({ color: BOGIE_FILL_COLOR });
    g.stroke({ color: BOGIE_STROKE_COLOR, pixelLine: true });
    return g;
}

function createBogieLabel(index: number): Text {
    const text = new Text({
        text: `${index}`,
        style: {
            fontFamily: 'sans-serif',
            fontSize: LABEL_FONT_SIZE,
            fill: 0x333333,
            fontWeight: 'bold',
        },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(0, LABEL_OFFSET_Y);
    return text;
}

function createDistanceLabel(dist: number): Text {
    const text = new Text({
        text: dist.toFixed(1),
        style: {
            fontFamily: 'sans-serif',
            fontSize: DISTANCE_FONT_SIZE,
            fill: 0x666666,
        },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(0, DISTANCE_OFFSET_Y);
    return text;
}

/**
 * Renders bogie editor bogies as filled circles with number labels,
 * distance annotations between adjacent bogies, and the constraint line.
 */
export class BogieEditorRenderSystem {
    private _container: Container;
    private _engine: BogieEditorEngine;
    private _camera: ObservableBoardCamera;
    /** Each entry: a container holding the circle graphic + label text */
    private _bogieContainers: Container[] = [];
    /** Distance labels placed between adjacent bogies */
    private _distanceContainers: Container[] = [];
    private _lineGraphics: Graphics;
    private _unsubscribePosition: (() => void) | null = null;
    private _unsubscribeAdded: (() => void) | null = null;
    private _unsubscribeRemoved: (() => void) | null = null;
    private _abortController: AbortController = new AbortController();
    private _zoomLevel = 1;

    constructor(engine: BogieEditorEngine, camera: ObservableBoardCamera) {
        this._container = new Container();
        this._engine = engine;
        this._camera = camera;
        this._zoomLevel = camera.zoomLevel;
        this._lineGraphics = new Graphics();
        this._container.addChild(this._lineGraphics);
        this._drawLine();
    }

    get container(): Container {
        return this._container;
    }

    setup(): void {
        this._unsubscribePosition = this._engine.onBogiePositionChanged(
            (index: number, position: Point) => this._onPositionChanged(index, position)
        );
        this._unsubscribeAdded = this._engine.onBogieAdded(
            () => this._syncAll()
        );
        this._unsubscribeRemoved = this._engine.onBogieRemoved(
            () => this._syncAll()
        );
        this._camera.on('zoom', (_event: CameraZoomEventPayload, state: CameraState) => {
            this._zoomLevel = state.zoomLevel;
            this._updateScales();
        }, { signal: this._abortController.signal });
        this._syncAll();
    }

    updateLine(): void {
        this._drawLine();
    }

    cleanup(): void {
        if (this._unsubscribePosition) {
            this._unsubscribePosition();
            this._unsubscribePosition = null;
        }
        if (this._unsubscribeAdded) {
            this._unsubscribeAdded();
            this._unsubscribeAdded = null;
        }
        if (this._unsubscribeRemoved) {
            this._unsubscribeRemoved();
            this._unsubscribeRemoved = null;
        }
        this._abortController.abort();
        this._abortController = new AbortController();
        this._removeAllDrawables();
    }

    private _drawLine(): void {
        const origin = this._engine.lineOrigin;
        const dir = this._engine.lineDirection;
        const lineWidth = 1.5 / this._zoomLevel;
        this._lineGraphics.clear();
        this._lineGraphics.moveTo(
            origin.x - dir.x * LINE_HALF_LENGTH,
            origin.y - dir.y * LINE_HALF_LENGTH
        );
        this._lineGraphics.lineTo(
            origin.x + dir.x * LINE_HALF_LENGTH,
            origin.y + dir.y * LINE_HALF_LENGTH
        );
        this._lineGraphics.stroke({ color: LINE_COLOR, width: lineWidth });
    }

    private _onPositionChanged(index: number, position: Point): void {
        const bc = this._bogieContainers[index];
        if (bc) {
            bc.position.set(position.x, position.y);
        }
        this._updateDistanceLabels();
    }

    private _syncAll(): void {
        this._removeAllDrawables();
        const bogies = this._engine.getBogies();
        const scale = 1 / this._zoomLevel;

        for (let i = 0; i < bogies.length; i++) {
            const bc = new Container();
            bc.position.set(bogies[i].x, bogies[i].y);

            const circle = createBogieCircle();
            bc.addChild(circle);

            const label = createBogieLabel(i);
            bc.addChild(label);

            // Scale the label (not the circle) so it stays a constant screen size
            label.scale.set(scale);

            this._bogieContainers.push(bc);
            this._container.addChild(bc);
        }

        this._updateDistanceLabels();
    }

    private _updateDistanceLabels(): void {
        // Remove old distance labels
        for (const dc of this._distanceContainers) {
            this._container.removeChild(dc);
            dc.destroy({ children: true });
        }
        this._distanceContainers = [];

        const bogies = this._engine.getBogies();
        if (bogies.length < 2) return;

        const scale = 1 / this._zoomLevel;

        for (let i = 0; i < bogies.length - 1; i++) {
            const a = bogies[i];
            const b = bogies[i + 1];
            const dist = PointCal.distanceBetweenPoints(a, b);
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;

            const dc = new Container();
            dc.position.set(midX, midY);

            const distLabel = createDistanceLabel(dist);
            dc.addChild(distLabel);
            dc.scale.set(scale);

            this._distanceContainers.push(dc);
            this._container.addChild(dc);
        }
    }

    private _updateScales(): void {
        const scale = 1 / this._zoomLevel;
        for (const bc of this._bogieContainers) {
            // Label is the second child (index 1)
            const label = bc.children[1];
            if (label) {
                label.scale.set(scale);
            }
        }
        for (const dc of this._distanceContainers) {
            dc.scale.set(scale);
        }
        this._drawLine();
    }

    private _removeAllDrawables(): void {
        for (const bc of this._bogieContainers) {
            this._container.removeChild(bc);
            bc.destroy({ children: true });
        }
        this._bogieContainers = [];

        for (const dc of this._distanceContainers) {
            this._container.removeChild(dc);
            dc.destroy({ children: true });
        }
        this._distanceContainers = [];
    }
}
