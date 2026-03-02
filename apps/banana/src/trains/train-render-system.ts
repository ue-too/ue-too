import { Container, Graphics } from 'pixi.js';
import { Train, TrainPosition } from './formation';
import { TrackGraph } from './tracks/track';
import { TrackRenderSystem } from './tracks/render-system';
import { WorldRenderSystem } from '@/world-render-system';

const BOGIE_RADIUS = 1.067 / 2;

const BOGIE_COLORS: number[] = [
  0xFF0000,
  0x00FF00,
  0x0000FF,
  0xFFFF00,
  0x800080,
  0xFFA500,
  0xFFC0CB,
  0xA52A2A,
  0x808080,
  0x000000,
  0xFFFFFF,
];

const PREVIEW_BOGIE_COLOR = 0x00FF00;

/**
 * Renders train bogie positions using PixiJS Graphics.
 *
 * Manages two groups of visuals:
 * - **Preview bogies**: shown during train placement (green circles), rendered as an overlay
 * - **Actual bogies**: shown after the train is placed (color-cycled circles),
 *   registered as drawables in the {@link WorldRenderSystem} with z-indices
 *   derived from the track draw order so they sort correctly with elevation
 *
 * Call {@link update} each frame to advance the train simulation
 * and synchronize the graphics.
 *
 * @group Train System
 */
export class TrainRenderSystem {

  private _train: Train;
  private _trackGraph: TrackGraph;
  private _trackRenderSystem: TrackRenderSystem;
  private _worldRenderSystem: WorldRenderSystem;

  private _previewContainer: Container;
  private _previewGraphicsPool: Graphics[] = [];

  private _actualGraphicsPool: Graphics[] = [];
  /** Number of actual bogies currently registered as drawables. */
  private _activeActualCount = 0;

  constructor(
    worldRenderSystem: WorldRenderSystem,
    train: Train,
    trackGraph: TrackGraph,
    trackRenderSystem: TrackRenderSystem,
  ) {
    this._train = train;
    this._trackGraph = trackGraph;
    this._trackRenderSystem = trackRenderSystem;
    this._worldRenderSystem = worldRenderSystem;

    this._previewContainer = new Container();
    worldRenderSystem.addOverlayContainer(this._previewContainer);
  }

  /**
   * Advance the train simulation and update all bogie graphics.
   *
   * @param deltaTime - Elapsed time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    this._train.update(deltaTime);
    this._updatePreviewBogies();
    this._updateActualBogies();
  }

  cleanup(): void {
    for (let i = 0; i < this._activeActualCount; i++) {
      const key = bogieKey(i);
      const removed = this._worldRenderSystem.removeDrawable(key);
      removed?.destroy({ children: true });
    }
    this._actualGraphicsPool = [];
    this._activeActualCount = 0;

    this._worldRenderSystem.removeOverlayContainer(this._previewContainer);
    this._previewContainer.destroy({ children: true });
    this._previewGraphicsPool = [];
  }

  private _updatePreviewBogies(): void {
    const positions = this._train.previewBogiePositions;

    if (positions === null || positions.length === 0) {
      this._previewContainer.visible = false;
      return;
    }

    this._previewContainer.visible = true;
    this._syncPreviewPool(positions.length);

    for (let i = 0; i < positions.length; i++) {
      const g = this._previewGraphicsPool[i];
      g.position.set(positions[i].point.x, positions[i].point.y);
    }
  }

  private _updateActualBogies(): void {
    const positions = this._train.getBogiePositions();

    if (positions === null || positions.length === 0) {
      this._hideActualBogies();
      return;
    }

    this._syncActualPool(positions.length);

    const headZIndex = this._resolveZIndex(positions[0]);

    for (let i = 0; i < positions.length; i++) {
      const g = this._actualGraphicsPool[i];
      const key = bogieKey(i);
      g.position.set(positions[i].point.x, positions[i].point.y);
      g.visible = true;

      const zIndex = i === 0 ? headZIndex : (this._resolveZIndex(positions[i]) ?? headZIndex);
      if (zIndex !== null) {
        this._worldRenderSystem.setDrawableZIndex(key, zIndex);
      }
    }

    this._worldRenderSystem.sortChildren();
  }

  /**
   * Resolve a z-index for a bogie that is above every track drawable in
   * the same elevation band. This prevents track segments at the same
   * elevation (e.g. at a junction) from covering the bogie.
   */
  private _resolveZIndex(position: TrainPosition): number | null {
    const id = this._trackGraph.getDrawDataIdentifier(
      position.trackSegment,
      position.tValue,
    );
    if (id === null) return null;
    return this._trackRenderSystem.getOnTrackObjectZIndex(id);
  }

  private _hideActualBogies(): void {
    for (let i = 0; i < this._activeActualCount; i++) {
      this._actualGraphicsPool[i].visible = false;
    }
  }

  /**
   * Grow or shrink the pool of actual-bogie drawables registered in
   * the WorldRenderSystem.
   */
  private _syncActualPool(count: number): void {
    while (this._actualGraphicsPool.length < count) {
      const idx = this._actualGraphicsPool.length;
      const color = BOGIE_COLORS[idx % BOGIE_COLORS.length];
      const g = createBogieGraphics(color);
      this._actualGraphicsPool.push(g);
      this._worldRenderSystem.addDrawable(bogieKey(idx), g);
    }

    for (let i = count; i < this._activeActualCount; i++) {
      this._actualGraphicsPool[i].visible = false;
    }

    this._activeActualCount = Math.max(this._activeActualCount, count);
  }

  private _syncPreviewPool(count: number): void {
    while (this._previewGraphicsPool.length < count) {
      const g = createBogieGraphics(PREVIEW_BOGIE_COLOR);
      this._previewGraphicsPool.push(g);
      this._previewContainer.addChild(g);
    }
    for (let i = 0; i < this._previewGraphicsPool.length; i++) {
      this._previewGraphicsPool[i].visible = i < count;
    }
  }
}

const bogieKey = (index: number): string => `__train_bogie__${index}`;

const createBogieGraphics = (color: number): Graphics => {
  const g = new Graphics();
  g.circle(0, 0, BOGIE_RADIUS);
  g.fill({ color });
  g.stroke({ color: 0x000000, pixelLine: true });
  return g;
};
