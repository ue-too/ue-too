import { Container, Graphics } from 'pixi.js';
import { Train, TrainPosition } from './formation';
import { TrackGraph } from './tracks/track';
import { TrackRenderSystem } from './tracks/render-system';
import { WorldRenderSystem } from '@/world-render-system';
import type { PlacedTrainEntry } from './train-manager';

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

function bogieKey(trainId: number | 'preview', bogieIndex: number): string {
  return `__train_${trainId}_bogie_${bogieIndex}`;
}

/**
 * Renders train bogie positions using PixiJS Graphics.
 *
 * Manages multiple placed trains plus a single preview train (during placement).
 * Placed trains use stable ids for drawable keys; preview uses 'preview'.
 *
 * Call {@link update} each frame to advance the simulation and sync graphics.
 *
 * @group Train System
 */
export class TrainRenderSystem {

  private _getPlacedTrains: () => readonly PlacedTrainEntry[];
  private _previewTrain: Train;
  private _trackGraph: TrackGraph;
  private _trackRenderSystem: TrackRenderSystem;
  private _worldRenderSystem: WorldRenderSystem;

  private _previewContainer: Container;
  private _previewGraphicsPool: Graphics[] = [];

  /** Per-train-id: pool of Graphics for actual bogies. */
  private _actualPools: Map<number, Graphics[]> = new Map();
  /** Per-train-id: number of active bogie drawables. */
  private _activeCounts: Map<number, number> = new Map();
  /** Train ids we had last frame (to remove drawables when a train is removed). */
  private _lastTrainIds: Set<number> = new Set();

  constructor(
    worldRenderSystem: WorldRenderSystem,
    getPlacedTrains: () => readonly PlacedTrainEntry[],
    previewTrain: Train,
    trackGraph: TrackGraph,
    trackRenderSystem: TrackRenderSystem,
  ) {
    this._worldRenderSystem = worldRenderSystem;
    this._getPlacedTrains = getPlacedTrains;
    this._previewTrain = previewTrain;
    this._trackGraph = trackGraph;
    this._trackRenderSystem = trackRenderSystem;

    this._previewContainer = new Container();
    worldRenderSystem.addOverlayContainer(this._previewContainer);
  }

  /**
   * Advance all trains and the preview train, then sync bogie graphics.
   *
   * @param deltaTime - Elapsed time since last frame in milliseconds
   */
  update(deltaTime: number): void {
    const placed = this._getPlacedTrains();

    for (const { train } of placed) {
      train.update(deltaTime);
    }
    this._previewTrain.update(deltaTime);

    this._updatePreviewBogies();
    this._updateActualBogies(placed);

    this._lastTrainIds.clear();
    for (const { id } of placed) this._lastTrainIds.add(id);
  }

  cleanup(): void {
    for (const [trainId, pool] of this._actualPools) {
      const count = this._activeCounts.get(trainId) ?? 0;
      for (let i = 0; i < count; i++) {
        const key = bogieKey(trainId, i);
        const removed = this._worldRenderSystem.removeDrawable(key);
        removed?.destroy({ children: true });
      }
    }
    this._actualPools.clear();
    this._activeCounts.clear();
    this._lastTrainIds.clear();

    this._worldRenderSystem.removeOverlayContainer(this._previewContainer);
    this._previewContainer.destroy({ children: true });
    this._previewGraphicsPool = [];
  }

  private _updatePreviewBogies(): void {
    const positions = this._previewTrain.previewBogiePositions;

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

  private _updateActualBogies(placed: readonly PlacedTrainEntry[]): void {
    const currentIds = new Set(placed.map(p => p.id));

    for (const id of this._lastTrainIds) {
      if (!currentIds.has(id)) {
        this._removeTrainDrawables(id);
      }
    }

    for (const { id, train } of placed) {
      const positions = train.getBogiePositions();
      if (positions === null || positions.length === 0) {
        this._hideActualBogiesForTrain(id);
        continue;
      }
      this._syncActualPoolForTrain(id, positions.length);
      const pool = this._actualPools.get(id)!;
      const headZIndex = this._resolveZIndex(positions[0]);

      for (let i = 0; i < positions.length; i++) {
        const g = pool[i];
        const key = bogieKey(id, i);
        g.position.set(positions[i].point.x, positions[i].point.y);
        g.visible = true;

        const zIndex = i === 0 ? headZIndex : (this._resolveZIndex(positions[i]) ?? headZIndex);
        if (zIndex !== null) {
          this._worldRenderSystem.setDrawableZIndex(key, zIndex);
        }
      }
    }

    this._worldRenderSystem.sortChildren();
  }

  private _removeTrainDrawables(trainId: number): void {
    const pool = this._actualPools.get(trainId);
    const count = this._activeCounts.get(trainId) ?? 0;
    if (pool) {
      for (let i = 0; i < count; i++) {
        const key = bogieKey(trainId, i);
        const removed = this._worldRenderSystem.removeDrawable(key);
        removed?.destroy({ children: true });
      }
      this._actualPools.delete(trainId);
    }
    this._activeCounts.delete(trainId);
  }

  private _resolveZIndex(position: TrainPosition): number | null {
    const id = this._trackGraph.getDrawDataIdentifier(
      position.trackSegment,
      position.tValue,
    );
    if (id === null) return null;
    return this._trackRenderSystem.getOnTrackObjectZIndex(id);
  }

  private _hideActualBogiesForTrain(trainId: number): void {
    const pool = this._actualPools.get(trainId);
    const count = this._activeCounts.get(trainId) ?? 0;
    if (pool) {
      for (let i = 0; i < count; i++) {
        pool[i].visible = false;
      }
    }
  }

  private _syncActualPoolForTrain(trainId: number, count: number): void {
    let pool = this._actualPools.get(trainId);
    if (!pool) {
      pool = [];
      this._actualPools.set(trainId, pool);
    }
    const currentActive = this._activeCounts.get(trainId) ?? 0;

    while (pool.length < count) {
      const idx = pool.length;
      const color = BOGIE_COLORS[idx % BOGIE_COLORS.length];
      const g = createBogieGraphics(color);
      pool.push(g);
      this._worldRenderSystem.addDrawable(bogieKey(trainId, idx), g, { layer: 'above' });
    }

    for (let i = count; i < currentActive; i++) {
      pool[i].visible = false;
    }
    this._activeCounts.set(trainId, Math.max(currentActive, count));
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

const createBogieGraphics = (color: number): Graphics => {
  const g = new Graphics();
  g.circle(0, 0, BOGIE_RADIUS);
  g.fill({ color });
  g.stroke({ color: 0x000000, pixelLine: true });
  return g;
};
