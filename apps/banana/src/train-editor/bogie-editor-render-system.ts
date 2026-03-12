import { Container, Graphics } from "pixi.js";
import type { BogieEditorEngine } from "./bogie-editor-engine";
import type { Point } from "@ue-too/math";

const BOGIE_RADIUS = 0.5;
const BOGIE_FILL_COLOR = 0x3498db;
const BOGIE_STROKE_COLOR = 0x000000;

function createBogieCircle(): Graphics {
    const g = new Graphics();
    g.circle(0, 0, BOGIE_RADIUS);
    g.fill({ color: BOGIE_FILL_COLOR });
    g.stroke({ color: BOGIE_STROKE_COLOR, pixelLine: true });
    return g;
}

/**
 * Renders bogie editor bogies as filled circles into a Pixi container.
 * Subscribes to the bogie editor engine for position updates, add, and remove.
 * Does not depend on WorldRenderSystem; use a Container (e.g. app.stage or a child).
 */
export class BogieEditorRenderSystem {
    private _container: Container;
    private _engine: BogieEditorEngine;
    private _graphics: Graphics[] = [];
    private _unsubscribePosition: (() => void) | null = null;
    private _unsubscribeAdded: (() => void) | null = null;
    private _unsubscribeRemoved: (() => void) | null = null;

    constructor(engine: BogieEditorEngine) {
        this._container = new Container();
        const testGraphics = createBogieCircle();
        this._container.addChild(testGraphics);
        this._engine = engine;
    }

    get container(): Container {
        return this._container;
    }

    /**
     * Attach to the engine and sync initial bogies. Call after construction.
     */
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
        this._syncAll();
    }

    /**
     * Unsubscribe and remove all bogie drawables.
     */
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
        this._removeAllDrawables();
    }

    private _onPositionChanged(index: number, position: Point): void {
        const g = this._graphics[index];
        if (g) {
            g.position.set(position.x, position.y);
        }
    }

    private _syncAll(): void {
        this._removeAllDrawables();
        const bogies = this._engine.getBogies();
        for (let i = 0; i < bogies.length; i++) {
            const g = createBogieCircle();
            g.position.set(bogies[i].x, bogies[i].y);
            this._graphics.push(g);
            this._container.addChild(g);
        }
    }

    private _removeAllDrawables(): void {
        for (const g of this._graphics) {
            this._container.removeChild(g);
            g.destroy({ children: true });
        }
        this._graphics = [];
    }
}
