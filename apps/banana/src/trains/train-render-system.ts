import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { Train, TrainPosition } from './formation';
import { TrackGraph } from './tracks/track';
import { TrackRenderSystem, type TrackTextureRenderer } from './tracks/render-system';
import { WorldRenderSystem } from '@/world-render-system';
import type { PlacedTrainEntry } from './train-manager';

const BOGIE_RADIUS = 1.067 / 2;

/** World-space width of each car rectangle (meters). */
const CAR_WIDTH = 2.5;

/** Distance from the rear of the car to the first bogie (meters). Bogies are inset from the car edges. */
const BOGIE_OFFSET_FROM_REAR = 4;
/** Distance from the second bogie to the front of the car (meters). */
const BOGIE_OFFSET_FROM_FRONT = 4;

/** Resolution of the procedural car body texture (power-of-two for crisp scaling). */
const CAR_TEX_WIDTH = 64;
const CAR_TEX_HEIGHT = 32;
/** Half the texture width — each half-car sprite maps to one half of the texture. */
const CAR_HALF_TEX_WIDTH = CAR_TEX_WIDTH / 2;

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

function carKey(trainId: number | 'preview', carIndex: number): string {
  return `__train_${trainId}_car_${carIndex}`;
}

/**
 * Car geometry: car k connects bogie 2k and bogie 2k+1. Train position is the first bogie.
 * Both bogies are inset from the car rectangle edges (offset from rear and front).
 */
type CarGeometry = {
  /** World position of the rear (back) of the car; first bogie is at rear + forward * BOGIE_OFFSET_FROM_REAR. */
  x: number;
  y: number;
  angle: number;
  /** World-space length of the car (distance between bogies + rear offset + front offset). */
  length: number;
};

/**
 * First car connects bogie 0 and 1, second car connects bogie 2 and 3, etc.
 * Car rear = first bogie - forward * BOGIE_OFFSET_FROM_REAR; front extends past second bogie by BOGIE_OFFSET_FROM_FRONT.
 */
function getCarGeometries(positions: TrainPosition[]): CarGeometry[] {
  const out: CarGeometry[] = [];
  for (let k = 0; 2 * k + 1 < positions.length; k++) {
    const b0 = positions[2 * k].point;
    const b1 = positions[2 * k + 1].point;
    const dx = b1.x - b0.x;
    const dy = b1.y - b0.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const rearX = b0.x - Math.cos(angle) * BOGIE_OFFSET_FROM_REAR;
    const rearY = b0.y - Math.sin(angle) * BOGIE_OFFSET_FROM_REAR;
    const length = distance + BOGIE_OFFSET_FROM_REAR + BOGIE_OFFSET_FROM_FRONT;
    out.push({ x: rearX, y: rearY, angle, length });
  }
  return out;
}

/**
 * Half-car geometry: each car is split into two halves so that each half can
 * be rendered at the z-index of its associated bogie. This reduces visual
 * tearing when two bogies of the same car sit on track draw data with
 * different elevations.
 */
type CarHalfGeometry = {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** Index into the bogie positions array for z-index resolution. */
  bogiePositionIndex: number;
};

/**
 * Split each car into two halves at the midpoint. Car k produces halves at
 * indices 2k (rear, associated with bogie 2k) and 2k+1 (front, associated
 * with bogie 2k+1).
 */
function getCarHalfGeometries(positions: TrainPosition[]): CarHalfGeometry[] {
  const out: CarHalfGeometry[] = [];
  for (let k = 0; 2 * k + 1 < positions.length; k++) {
    const b0 = positions[2 * k].point;
    const b1 = positions[2 * k + 1].point;
    const dx = b1.x - b0.x;
    const dy = b1.y - b0.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const fullLength = distance + BOGIE_OFFSET_FROM_REAR + BOGIE_OFFSET_FROM_FRONT;
    const halfLength = fullLength / 2;

    const rearX = b0.x - Math.cos(angle) * BOGIE_OFFSET_FROM_REAR;
    const rearY = b0.y - Math.sin(angle) * BOGIE_OFFSET_FROM_REAR;
    const midX = rearX + Math.cos(angle) * halfLength;
    const midY = rearY + Math.sin(angle) * halfLength;

    out.push({ x: rearX, y: rearY, angle, length: halfLength, bogiePositionIndex: 2 * k });
    out.push({ x: midX, y: midY, angle, length: halfLength, bogiePositionIndex: 2 * k + 1 });
  }
  return out;
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
  private _textureRenderer: TrackTextureRenderer | null;

  private _previewContainer: Container;
  private _previewGraphicsPool: Graphics[] = [];
  private _previewCarPool: Sprite[] = [];

  /** Per-train-id: pool of Graphics for actual bogies. */
  private _actualPools: Map<number, Graphics[]> = new Map();
  /** Per-train-id: number of active bogie drawables. */
  private _activeCounts: Map<number, number> = new Map();
  /** Per-train-id: pool of Sprites for actual cars (texture-based). */
  private _actualCarPools: Map<number, Sprite[]> = new Map();
  /** Per-train-id: number of active car drawables. */
  private _activeCarCounts: Map<number, number> = new Map();
  /** Train ids we had last frame (to remove drawables when a train is removed). */
  private _lastTrainIds: Set<number> = new Set();

  /** Cached procedural car body texture; created lazily when texture renderer is available. */
  private _carTexture: Texture | null = null;
  /** Rear-half sub-texture (left half of the car texture). */
  private _carTextureRear: Texture | null = null;
  /** Front-half sub-texture (right half of the car texture). */
  private _carTextureFront: Texture | null = null;

  constructor(
    worldRenderSystem: WorldRenderSystem,
    getPlacedTrains: () => readonly PlacedTrainEntry[],
    previewTrain: Train,
    trackGraph: TrackGraph,
    trackRenderSystem: TrackRenderSystem,
    textureRenderer?: TrackTextureRenderer | null,
  ) {
    this._worldRenderSystem = worldRenderSystem;
    this._getPlacedTrains = getPlacedTrains;
    this._previewTrain = previewTrain;
    this._trackGraph = trackGraph;
    this._trackRenderSystem = trackRenderSystem;
    this._textureRenderer = textureRenderer ?? null;

    this._previewContainer = new Container();
    this._previewContainer.sortableChildren = true;
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
    this._updatePreviewCars();
    this._updateActualBogies(placed);
    this._updateActualCars(placed);

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

    for (const [trainId, pool] of this._actualCarPools) {
      const count = this._activeCarCounts.get(trainId) ?? 0;
      for (let i = 0; i < count; i++) {
        const key = carKey(trainId, i);
        const removed = this._worldRenderSystem.removeDrawable(key);
        removed?.destroy({ children: true });
      }
    }
    this._actualCarPools.clear();
    this._activeCarCounts.clear();
    this._lastTrainIds.clear();

    this._worldRenderSystem.removeOverlayContainer(this._previewContainer);
    this._previewContainer.destroy({ children: true });
    this._previewGraphicsPool = [];
    this._previewCarPool = [];
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

  private _updateActualCars(placed: readonly PlacedTrainEntry[]): void {
    if (this._getOrCreateCarHalfTextures() === null) return;

    for (const { id, train } of placed) {
      const positions = train.getBogiePositions();
      if (positions === null || positions.length < 2) {
        this._hideActualCarsForTrain(id);
        continue;
      }
      const halves = getCarHalfGeometries(positions);
      this._syncActualCarPoolForTrain(id, halves.length);
      const pool = this._actualCarPools.get(id)!;

      for (let i = 0; i < halves.length; i++) {
        const sprite = pool[i];
        const h = halves[i];
        sprite.position.set(h.x, h.y);
        sprite.rotation = h.angle;
        sprite.scale.set(h.length / CAR_HALF_TEX_WIDTH, CAR_WIDTH / CAR_TEX_HEIGHT);
        sprite.visible = true;

        const bogieZ = this._resolveZIndex(positions[h.bogiePositionIndex]);
        if (bogieZ !== null) {
          this._worldRenderSystem.setDrawableZIndex(carKey(id, i), bogieZ - 1);
        }
      }
    }

    this._worldRenderSystem.sortChildren();
  }

  private _updatePreviewCars(): void {
    const texture = this._getOrCreateCarTexture();
    const positions = this._previewTrain.previewBogiePositions;
    if (texture === null || positions === null || positions.length < 2) {
      for (const s of this._previewCarPool) s.visible = false;
      return;
    }
    const geometries = getCarGeometries(positions);
    while (this._previewCarPool.length < geometries.length) {
      const sprite = createCarSprite(texture);
      sprite.zIndex = 0;
      this._previewCarPool.push(sprite);
      this._previewContainer.addChild(sprite);
    }
    for (let i = 0; i < this._previewCarPool.length; i++) {
      const sprite = this._previewCarPool[i];
      if (i < geometries.length) {
        const g = geometries[i];
        sprite.position.set(g.x, g.y);
        sprite.rotation = g.angle;
        sprite.scale.set(g.length / CAR_TEX_WIDTH, CAR_WIDTH / CAR_TEX_HEIGHT);
        sprite.visible = true;
      } else {
        sprite.visible = false;
      }
    }
  }

  private _getOrCreateCarTexture(): Texture | null {
    if (this._carTexture !== null) return this._carTexture;
    const renderer = this._textureRenderer?.renderer?.textureGenerator;
    if (renderer === undefined) return null;

    const g = new Graphics();
    g.rect(0, 0, CAR_TEX_WIDTH, CAR_TEX_HEIGHT);
    g.fill(0x3d3d3d);
    g.rect(2, 2, CAR_TEX_WIDTH - 4, CAR_TEX_HEIGHT - 4);
    g.fill(0x505050);
    g.rect(4, CAR_TEX_HEIGHT / 2 - 4, CAR_TEX_WIDTH - 8, 8);
    g.fill(0x2a2a2a);

    this._carTexture = renderer.generateTexture({ target: g });
    return this._carTexture;
  }

  private _getOrCreateCarHalfTextures(): { rear: Texture; front: Texture } | null {
    if (this._carTextureRear !== null && this._carTextureFront !== null) {
      return { rear: this._carTextureRear, front: this._carTextureFront };
    }
    const base = this._getOrCreateCarTexture();
    if (base === null) return null;

    const frame = base.frame;
    this._carTextureRear = new Texture({
      source: base.source,
      frame: new Rectangle(frame.x, frame.y, frame.width / 2, frame.height),
    });
    this._carTextureFront = new Texture({
      source: base.source,
      frame: new Rectangle(frame.x + frame.width / 2, frame.y, frame.width / 2, frame.height),
    });
    return { rear: this._carTextureRear, front: this._carTextureFront };
  }

  private _hideActualCarsForTrain(trainId: number): void {
    const pool = this._actualCarPools.get(trainId);
    const count = this._activeCarCounts.get(trainId) ?? 0;
    if (pool) {
      for (let i = 0; i < count; i++) {
        pool[i].visible = false;
      }
    }
  }

  private _syncActualCarPoolForTrain(trainId: number, count: number): void {
    const textures = this._getOrCreateCarHalfTextures();
    if (textures === null) return;

    let pool = this._actualCarPools.get(trainId);
    if (!pool) {
      pool = [];
      this._actualCarPools.set(trainId, pool);
    }
    const currentActive = this._activeCarCounts.get(trainId) ?? 0;

    while (pool.length < count) {
      const idx = pool.length;
      const texture = idx % 2 === 0 ? textures.rear : textures.front;
      const sprite = createCarSprite(texture);
      pool.push(sprite);
      this._worldRenderSystem.addDrawable(carKey(trainId, idx), sprite);
    }

    for (let i = count; i < currentActive; i++) {
      pool[i].visible = false;
    }
    this._activeCarCounts.set(trainId, Math.max(currentActive, count));
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

    const carPool = this._actualCarPools.get(trainId);
    const carCount = this._activeCarCounts.get(trainId) ?? 0;
    if (carPool) {
      for (let i = 0; i < carCount; i++) {
        const key = carKey(trainId, i);
        const removed = this._worldRenderSystem.removeDrawable(key);
        removed?.destroy({ children: true });
      }
      this._actualCarPools.delete(trainId);
    }
    this._activeCarCounts.delete(trainId);
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
      this._worldRenderSystem.addDrawable(bogieKey(trainId, idx), g);
    }

    for (let i = count; i < currentActive; i++) {
      pool[i].visible = false;
    }
    this._activeCounts.set(trainId, Math.max(currentActive, count));
  }

  private _syncPreviewPool(count: number): void {
    while (this._previewGraphicsPool.length < count) {
      const g = createBogieGraphics(PREVIEW_BOGIE_COLOR);
      g.zIndex = 1;
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

/** Creates a car body sprite with anchor at left center so position/rotation align with first bogie and line to second. */
const createCarSprite = (texture: Texture): Sprite => {
  const sprite = new Sprite({ texture });
  sprite.anchor.set(0, 0.5);
  return sprite;
};
