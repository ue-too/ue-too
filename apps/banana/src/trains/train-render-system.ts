import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { Train, TrainPosition } from './formation';
import { Car } from './cars';
import { TrackGraph } from './tracks/track';
import { TrackRenderSystem, type TrackTextureRenderer } from './tracks/render-system';
import { WorldRenderSystem } from '@/world-render-system';
import type { PlacedTrainEntry } from './train-manager';
import type { CarImageRegistry } from './car-image-registry';
import { OccupancyRegistry } from './occupancy-registry';
import { ProximityDetector } from './proximity-detector';
import type { CollisionGuard } from './collision-guard';

const BOGIE_RADIUS = 1.067 / 2;

/** World-space width of each car rectangle (meters). */
const CAR_WIDTH = 2.5;

/** Per-side gap between adjacent cars (meters). Each car edge shrinks by this amount. */
const CAR_GAP = 0.3;

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

function gangwayKey(trainId: number, index: number): string {
  return `__train_${trainId}_gangway_${index}`;
}

function couplerKey(trainId: number, index: number): string {
  return `__train_${trainId}_coupler_${index}`;
}

/** World-space width of the gangway rectangle (meters). */
const GANGWAY_WIDTH = 1.2;

/** World-space width of the coupler bar (meters). */
const COUPLER_WIDTH = 0.25;

type GangwayGeometry = {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** Bogie position index for z-order band resolution. */
  bogiePositionIndex: number;
};

/**
 * Compute gangway geometries between adjacent cars whose touching sides
 * both have gangway enabled. Derives positions from pre-computed car
 * geometries so all flip logic is handled in one place.
 *
 * Gangway flags are read directly — switchDirection() already swaps them
 * so `tailHasGangway` always refers to the current trailing side.
 *
 * When a car is flipped, getCarGeometries reverses the angle direction
 * (rearIdx = 2k+1, frontIdx = 2k), so the geometry's rear edge faces the
 * next car and the front edge faces the previous car — opposite of the
 * non-flipped case. We pick the gap-side edge accordingly.
 */
function getGangwayGeometries(
  carGeoms: CarGeometry[],
  cars: readonly Car[],
  positions: TrainPosition[],
): GangwayGeometry[] {
  const out: GangwayGeometry[] = [];
  for (let k = 0; k + 1 < cars.length; k++) {
    // switchDirection already swaps the flags, so no flip conditional needed
    if (!cars[k].tailHasGangway || !cars[k + 1].headHasGangway) continue;

    const gA = carGeoms[k];
    const gB = carGeoms[k + 1];

    // Car A's gap-side edge (facing car B):
    //   not flipped → front edge (end of sprite)
    //   flipped → rear edge (start of sprite, since angle is reversed)
    let gapAx: number, gapAy: number;
    if (cars[k].flipped) {
      gapAx = gA.x;
      gapAy = gA.y;
    } else {
      gapAx = gA.x + Math.cos(gA.angle) * gA.length;
      gapAy = gA.y + Math.sin(gA.angle) * gA.length;
    }

    // Car B's gap-side edge (facing car A):
    //   not flipped → rear edge (start of sprite)
    //   flipped → front edge (end of sprite, since angle is reversed)
    let gapBx: number, gapBy: number;
    if (cars[k + 1].flipped) {
      gapBx = gB.x + Math.cos(gB.angle) * gB.length;
      gapBy = gB.y + Math.sin(gB.angle) * gB.length;
    } else {
      gapBx = gB.x;
      gapBy = gB.y;
    }

    // Derive the gangway angle from the two bogies closest to the coupling
    // gap (bogie 2k+1 of car A and bogie 2k+2 of car B). On curves, the
    // car-edge endpoints can overshoot each other (each is extended along
    // its own car's angle), which flips the atan2 result ~180°. The bogie
    // positions always maintain proper spacing along the track, giving a
    // stable direction.
    const tailBogie = positions[2 * k + 1].point;
    const headBogie = positions[2 * (k + 1)].point;
    const angle = Math.atan2(
      headBogie.y - tailBogie.y,
      headBogie.x - tailBogie.x,
    );

    // Compute gangway length from both the car-edge distance and the
    // bogie-to-bogie distance to handle curves correctly. On curves the
    // car edges splay apart (each extends along its own car's angle), so
    // the edge-to-edge distance can grow beyond the nominal gap. At the
    // same time on tight curves the edges can converge and shrink the gap.
    // We take the max of both measurements plus CAR_GAP padding so the
    // gangway always tucks under both car bodies with no visible seams.
    const edgeDx = gapBx - gapAx;
    const edgeDy = gapBy - gapAy;
    const edgeDist = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
    const bogieDx = headBogie.x - tailBogie.x;
    const bogieDy = headBogie.y - tailBogie.y;
    const bogieDist = Math.sqrt(bogieDx * bogieDx + bogieDy * bogieDy);
    const overhangA = (cars[k].flipped ? cars[k].edgeToBogie : cars[k].bogieToEdge) - CAR_GAP;
    const overhangB = (cars[k + 1].flipped ? cars[k + 1].bogieToEdge : cars[k + 1].edgeToBogie) - CAR_GAP;
    const nominalLength = bogieDist - overhangA - overhangB;
    const gangwayLength = Math.max(edgeDist, nominalLength) + CAR_GAP;

    // Use the bogie closest to the gap for z-order band resolution
    const gapBogieIdx = 2 * k + 1;

    // Centre the gangway in the coupling gap so it stays visually balanced
    // even when the car-edge endpoints are slightly asymmetric on curves.
    out.push({
      x: (gapAx + gapBx) / 2,
      y: (gapAy + gapBy) / 2,
      angle,
      length: Math.max(gangwayLength, 0),
      bogiePositionIndex: gapBogieIdx,
    });
  }
  return out;
}

/**
 * Compute coupler geometries between adjacent cars that do NOT both have
 * gangway enabled on the touching sides. A coupler is a thin bar connecting
 * the two car edges in the coupling gap.
 */
function getCouplerGeometries(
  carGeoms: CarGeometry[],
  cars: readonly Car[],
  positions: TrainPosition[],
): GangwayGeometry[] {
  const out: GangwayGeometry[] = [];
  for (let k = 0; k + 1 < cars.length; k++) {
    // Only render couplers where gangway is NOT rendered
    if (cars[k].tailHasGangway && cars[k + 1].headHasGangway) continue;

    const gA = carGeoms[k];
    const gB = carGeoms[k + 1];

    let gapAx: number, gapAy: number;
    if (cars[k].flipped) {
      gapAx = gA.x;
      gapAy = gA.y;
    } else {
      gapAx = gA.x + Math.cos(gA.angle) * gA.length;
      gapAy = gA.y + Math.sin(gA.angle) * gA.length;
    }

    let gapBx: number, gapBy: number;
    if (cars[k + 1].flipped) {
      gapBx = gB.x + Math.cos(gB.angle) * gB.length;
      gapBy = gB.y + Math.sin(gB.angle) * gB.length;
    } else {
      gapBx = gB.x;
      gapBy = gB.y;
    }

    const tailBogie = positions[2 * k + 1].point;
    const headBogie = positions[2 * (k + 1)].point;
    const angle = Math.atan2(
      headBogie.y - tailBogie.y,
      headBogie.x - tailBogie.x,
    );

    const bogieDx = headBogie.x - tailBogie.x;
    const bogieDy = headBogie.y - tailBogie.y;
    const bogieDist = Math.sqrt(bogieDx * bogieDx + bogieDy * bogieDy);
    const overhangA = (cars[k].flipped ? cars[k].edgeToBogie : cars[k].bogieToEdge) - CAR_GAP;
    const overhangB = (cars[k + 1].flipped ? cars[k + 1].bogieToEdge : cars[k + 1].edgeToBogie) - CAR_GAP;
    const couplerLength = bogieDist - overhangA - overhangB;

    const gapBogieIdx = 2 * k + 1;

    out.push({
      x: (gapAx + gapBx) / 2,
      y: (gapAy + gapBy) / 2,
      angle,
      length: Math.max(couplerLength, 0),
      bogiePositionIndex: gapBogieIdx,
    });
  }
  return out;
}

/**
 * Car geometry: car k connects bogie 2k and bogie 2k+1. Train position is the first bogie.
 * Both bogies are inset from the car rectangle edges by the car's edgeToBogie/bogieToEdge distances.
 */
type CarGeometry = {
  /** World position of the rear (back) of the car. */
  x: number;
  y: number;
  angle: number;
  /** World-space length of the car (distance between bogies + edgeToBogie + bogieToEdge). */
  length: number;
};

/**
 * First car connects bogie 0 and 1, second car connects bogie 2 and 3, etc.
 * Car rear = first bogie - forward * edgeToBogie; front extends past second bogie by bogieToEdge.
 */
function getCarGeometries(positions: TrainPosition[], cars: readonly Car[]): CarGeometry[] {
  const out: CarGeometry[] = [];
  for (let k = 0; 2 * k + 1 < positions.length; k++) {
    const car = cars[k];
    // When the car is flipped, swap bogies so the angle stays consistent with
    // the car's original physical orientation and the texture isn't mirrored.
    const rearIdx = car.flipped ? 2 * k + 1 : 2 * k;
    const frontIdx = car.flipped ? 2 * k : 2 * k + 1;
    const edgeToBogie = (car.flipped ? car.bogieToEdge : car.edgeToBogie) - CAR_GAP;
    const bogieToEdge = (car.flipped ? car.edgeToBogie : car.bogieToEdge) - CAR_GAP;
    const b0 = positions[rearIdx].point;
    const b1 = positions[frontIdx].point;
    const dx = b1.x - b0.x;
    const dy = b1.y - b0.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const rearX = b0.x - Math.cos(angle) * edgeToBogie;
    const rearY = b0.y - Math.sin(angle) * edgeToBogie;
    const length = distance + edgeToBogie + bogieToEdge;
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
function getCarHalfGeometries(positions: TrainPosition[], cars: readonly Car[]): CarHalfGeometry[] {
  const out: CarHalfGeometry[] = [];
  for (let k = 0; 2 * k + 1 < positions.length; k++) {
    const car = cars[k];
    const rearIdx = car.flipped ? 2 * k + 1 : 2 * k;
    const frontIdx = car.flipped ? 2 * k : 2 * k + 1;
    const edgeToBogie = (car.flipped ? car.bogieToEdge : car.edgeToBogie) - CAR_GAP;
    const bogieToEdge = (car.flipped ? car.edgeToBogie : car.bogieToEdge) - CAR_GAP;
    const b0 = positions[rearIdx].point;
    const b1 = positions[frontIdx].point;
    const dx = b1.x - b0.x;
    const dy = b1.y - b0.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const fullLength = distance + edgeToBogie + bogieToEdge;
    const halfLength = fullLength / 2;

    const rearX = b0.x - Math.cos(angle) * edgeToBogie;
    const rearY = b0.y - Math.sin(angle) * edgeToBogie;
    const midX = rearX + Math.cos(angle) * halfLength;
    const midY = rearY + Math.sin(angle) * halfLength;

    out.push({ x: rearX, y: rearY, angle, length: halfLength, bogiePositionIndex: rearIdx });
    out.push({ x: midX, y: midY, angle, length: halfLength, bogiePositionIndex: frontIdx });
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
  private _getPreviewTrain: () => Train;
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
  /** Per-train-id: pool of Sprites for gangway connectors. */
  private _gangwayPools: Map<number, Sprite[]> = new Map();
  /** Per-train-id: number of active gangway drawables. */
  private _activeGangwayCounts: Map<number, number> = new Map();
  /** Cached procedural gangway texture. */
  private _gangwayTexture: Texture | null = null;
  /** Per-train-id: pool of Sprites for coupler connectors. */
  private _couplerPools: Map<number, Sprite[]> = new Map();
  /** Per-train-id: number of active coupler drawables. */
  private _activeCouplerCounts: Map<number, number> = new Map();
  /** Cached procedural coupler texture. */
  private _couplerTexture: Texture | null = null;
  /** Train ids we had last frame (to remove drawables when a train is removed). */
  private _lastTrainIds: Set<number> = new Set();

  private _occupancyRegistry: OccupancyRegistry = new OccupancyRegistry();
  private _proximityDetector: ProximityDetector = new ProximityDetector();
  private _collisionGuard: CollisionGuard | null = null;

  /** Cached procedural car body texture; created lazily when texture renderer is available. */
  private _carTexture: Texture | null = null;
  /** Rear-half sub-texture (left half of the car texture). */
  private _carTextureRear: Texture | null = null;
  /** Front-half sub-texture (right half of the car texture). */
  private _carTextureFront: Texture | null = null;

  /** Optional registry mapping car IDs to custom image data URLs. */
  private _carImageRegistry: CarImageRegistry | null = null;
  /** Cache of loaded custom car textures by car ID. */
  private _customCarTextures: Map<string, { full: Texture; rear: Texture; front: Texture }> = new Map();

  private _showBogies: boolean = true;

  constructor(
    worldRenderSystem: WorldRenderSystem,
    getPlacedTrains: () => readonly PlacedTrainEntry[],
    getPreviewTrain: () => Train,
    trackGraph: TrackGraph,
    trackRenderSystem: TrackRenderSystem,
    textureRenderer?: TrackTextureRenderer | null,
    carImageRegistry?: CarImageRegistry | null,
  ) {
    this._worldRenderSystem = worldRenderSystem;
    this._getPlacedTrains = getPlacedTrains;
    this._getPreviewTrain = getPreviewTrain;
    this._trackGraph = trackGraph;
    this._trackRenderSystem = trackRenderSystem;
    this._textureRenderer = textureRenderer ?? null;
    this._carImageRegistry = carImageRegistry ?? null;

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
    this._getPreviewTrain().update(deltaTime);

    this._occupancyRegistry.updateFromTrains(placed);
    this._proximityDetector.update(placed, this._occupancyRegistry);
    this._collisionGuard?.update(placed, this._occupancyRegistry);

    this._updatePreviewBogies();
    this._updatePreviewCars();
    this._updateActualBogies(placed);
    this._updateActualCars(placed);
    this._updateGangways(placed);
    this._updateCouplers(placed);
    this._worldRenderSystem.sortChildren();

    this._lastTrainIds.clear();
    for (const { id } of placed) this._lastTrainIds.add(id);
  }

  /** The centralized occupancy registry, updated each frame. */
  get occupancyRegistry(): OccupancyRegistry {
    return this._occupancyRegistry;
  }

  get showBogies(): boolean {
    return this._showBogies;
  }

  set showBogies(value: boolean) {
    if (this._showBogies === value) return;
    this._showBogies = value;
    if (!value) {
      for (const [trainId] of this._actualPools) {
        this._hideActualBogiesForTrain(trainId);
      }
      for (const g of this._previewGraphicsPool) {
        g.visible = false;
      }
    }
  }

  /** The proximity detector, updated each frame. */
  get proximityDetector(): ProximityDetector {
    return this._proximityDetector;
  }

  set collisionGuard(guard: CollisionGuard) {
    this._collisionGuard = guard;
  }

  /**
   * Force a one-shot graphics sync without advancing simulation.
   * Call when trains are added/removed while time is paused.
   */
  forceSync(): void {
    const placed = this._getPlacedTrains();

    this._updatePreviewBogies();
    this._updatePreviewCars();
    this._updateActualBogies(placed);
    this._updateActualCars(placed);
    this._updateGangways(placed);
    this._updateCouplers(placed);
    this._worldRenderSystem.sortChildren();

    this._lastTrainIds.clear();
    for (const { id } of placed) this._lastTrainIds.add(id);
  }

  cleanup(): void {
    for (const [trainId] of this._actualPools) {
      const count = this._activeCounts.get(trainId) ?? 0;
      for (let i = 0; i < count; i++) {
        const key = bogieKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
    }
    this._actualPools.clear();
    this._activeCounts.clear();

    for (const [trainId] of this._actualCarPools) {
      const count = this._activeCarCounts.get(trainId) ?? 0;
      for (let i = 0; i < count; i++) {
        const key = carKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
    }
    this._actualCarPools.clear();
    this._activeCarCounts.clear();

    for (const [trainId] of this._gangwayPools) {
      const count = this._activeGangwayCounts.get(trainId) ?? 0;
      for (let i = 0; i < count; i++) {
        const key = gangwayKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
    }
    this._gangwayPools.clear();
    this._activeGangwayCounts.clear();

    for (const [trainId] of this._couplerPools) {
      const count = this._activeCouplerCounts.get(trainId) ?? 0;
      for (let i = 0; i < count; i++) {
        const key = couplerKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
    }
    this._couplerPools.clear();
    this._activeCouplerCounts.clear();
    this._lastTrainIds.clear();

    for (const cached of this._customCarTextures.values()) {
      cached.full.destroy(true);
    }
    this._customCarTextures.clear();

    this._worldRenderSystem.removeOverlayContainer(this._previewContainer);
    this._previewContainer.destroy({ children: true });
    this._previewGraphicsPool = [];
    this._previewCarPool = [];
  }

  private _updatePreviewBogies(): void {
    const positions = this._getPreviewTrain().previewBogiePositions;

    if (positions === null || positions.length === 0) {
      this._previewContainer.visible = false;
      return;
    }

    this._previewContainer.visible = true;
    this._syncPreviewPool(positions.length);

    for (let i = 0; i < positions.length; i++) {
      const g = this._previewGraphicsPool[i];
      g.position.set(positions[i].point.x, positions[i].point.y);
      g.visible = this._showBogies;
    }
  }

  private _updateActualBogies(placed: readonly PlacedTrainEntry[]): void {
    // Check for removed trains by diffing against last frame's IDs.
    // Reuse _lastTrainIds (previous frame) — no need to allocate a new Set.
    if (this._lastTrainIds.size > 0) {
      for (const id of this._lastTrainIds) {
        let found = false;
        for (let i = 0; i < placed.length; i++) {
          if (placed[i].id === id) { found = true; break; }
        }
        if (!found) this._removeTrainDrawables(id);
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
      const headBand = this._resolveBandIndex(positions[0]);

      for (let i = 0; i < positions.length; i++) {
        const g = pool[i];
        const key = bogieKey(id, i);
        g.position.set(positions[i].point.x, positions[i].point.y);
        g.visible = this._showBogies;

        const bandIndex = i === 0 ? headBand : (this._resolveBandIndex(positions[i]) ?? headBand);
        if (bandIndex !== null) {
          this._worldRenderSystem.addToBand(key, g, bandIndex, 'onTrack');
          this._worldRenderSystem.setOrderInBand(key, 1);
        }
      }
    }

  }

  private _updateActualCars(placed: readonly PlacedTrainEntry[]): void {
    const defaultTextures = this._getOrCreateCarHalfTextures();
    if (defaultTextures === null) return;

    for (const { id, train } of placed) {
      const positions = train.getBogiePositions();
      if (positions === null || positions.length < 2) {
        this._hideActualCarsForTrain(id);
        continue;
      }
      const cars = train.cars;
      const halves = getCarHalfGeometries(positions, cars);
      this._syncActualCarPoolForTrain(id, halves.length);
      const pool = this._actualCarPools.get(id)!;
      for (let i = 0; i < halves.length; i++) {
        const sprite = pool[i];
        const h = halves[i];

        // Check for custom car texture
        const carIndex = Math.floor(i / 2);
        const car = cars[carIndex];
        const customTex = car ? this._getCustomCarTextures(car.id) : null;
        const isRearHalf = i % 2 === 0;
        const tex = customTex
          ? (isRearHalf ? customTex.rear : customTex.front)
          : (isRearHalf ? defaultTextures.rear : defaultTextures.front);

        if (sprite.texture !== tex) {
          sprite.texture = tex;
        }

        sprite.position.set(h.x, h.y);
        sprite.rotation = h.angle;

        const texW = tex.width || CAR_HALF_TEX_WIDTH;
        const texH = tex.height || CAR_TEX_HEIGHT;
        sprite.scale.set(h.length / texW, CAR_WIDTH / texH);
        sprite.visible = true;

        const bandIndex = this._resolveBandIndex(positions[h.bogiePositionIndex]);
        if (bandIndex !== null) {
          this._worldRenderSystem.addToBand(carKey(id, i), sprite, bandIndex, 'onTrack');
          // Car bodies draw below bogies (order 0 vs bogie order 1).
          this._worldRenderSystem.setOrderInBand(carKey(id, i), 0);
        }
      }
    }

  }

  private _getOrCreateGangwayTexture(): Texture | null {
    if (this._gangwayTexture) return this._gangwayTexture;
    const renderer = this._textureRenderer?.renderer?.textureGenerator;
    if (renderer === undefined) return null;
    const w = 16;
    const h = 16;
    const g = new Graphics();
    g.rect(0, 0, w, h);
    g.fill({ color: 0x3d3d3d });
    this._gangwayTexture = renderer.generateTexture({ target: g });
    g.destroy();
    return this._gangwayTexture;
  }

  private _updateGangways(placed: readonly PlacedTrainEntry[]): void {
    const texture = this._getOrCreateGangwayTexture();
    if (texture === null) return;

    for (const { id, train } of placed) {
      const positions = train.getBogiePositions();
      if (positions === null || positions.length < 2) {
        this._hideGangwaysForTrain(id);
        continue;
      }
      const cars = train.cars;
      const carGeoms = getCarGeometries(positions, cars);
      const geoms = getGangwayGeometries(carGeoms, cars, positions);
      this._syncGangwayPoolForTrain(id, geoms.length, texture);
      const pool = this._gangwayPools.get(id)!;

      for (let i = 0; i < geoms.length; i++) {
        const sprite = pool[i];
        const g = geoms[i];

        sprite.position.set(g.x, g.y);
        sprite.rotation = g.angle;
        sprite.scale.set(g.length / texture.width, GANGWAY_WIDTH / texture.height);
        sprite.visible = true;

        const bandIndex = this._resolveBandIndex(positions[g.bogiePositionIndex]);
        if (bandIndex !== null) {
          this._worldRenderSystem.addToBand(gangwayKey(id, i), sprite, bandIndex, 'onTrack');
          this._worldRenderSystem.setOrderInBand(gangwayKey(id, i), 0);
        }
      }

      // Hide excess sprites from previous frame and remove from band
      const prevCount = this._activeGangwayCounts.get(id) ?? 0;
      for (let i = geoms.length; i < prevCount; i++) {
        pool[i].visible = false;
        this._worldRenderSystem.removeFromBand(gangwayKey(id, i));
      }
      this._activeGangwayCounts.set(id, geoms.length);
    }
  }

  private _hideGangwaysForTrain(trainId: number): void {
    const pool = this._gangwayPools.get(trainId);
    const count = this._activeGangwayCounts.get(trainId) ?? 0;
    if (pool) {
      for (let i = 0; i < count; i++) {
        pool[i].visible = false;
      }
    }
  }

  private _syncGangwayPoolForTrain(trainId: number, count: number, texture: Texture): void {
    let pool = this._gangwayPools.get(trainId);
    if (!pool) {
      pool = [];
      this._gangwayPools.set(trainId, pool);
    }
    while (pool.length < count) {
      const sprite = new Sprite({ texture });
      sprite.anchor.set(0.5, 0.5);
      pool.push(sprite);
    }
  }

  private _getOrCreateCouplerTexture(): Texture | null {
    if (this._couplerTexture) return this._couplerTexture;
    const renderer = this._textureRenderer?.renderer?.textureGenerator;
    if (renderer === undefined) return null;
    const w = 16;
    const h = 16;
    const g = new Graphics();
    g.rect(0, 0, w, h);
    g.fill({ color: 0x555555 });
    this._couplerTexture = renderer.generateTexture({ target: g });
    g.destroy();
    return this._couplerTexture;
  }

  private _updateCouplers(placed: readonly PlacedTrainEntry[]): void {
    const texture = this._getOrCreateCouplerTexture();
    if (texture === null) return;

    for (const { id, train } of placed) {
      const positions = train.getBogiePositions();
      if (positions === null || positions.length < 2) {
        this._hideCouplerForTrain(id);
        continue;
      }
      const cars = train.cars;
      const carGeoms = getCarGeometries(positions, cars);
      const geoms = getCouplerGeometries(carGeoms, cars, positions);
      this._syncCouplerPoolForTrain(id, geoms.length, texture);
      const pool = this._couplerPools.get(id)!;

      for (let i = 0; i < geoms.length; i++) {
        const sprite = pool[i];
        const g = geoms[i];

        sprite.position.set(g.x, g.y);
        sprite.rotation = g.angle;
        sprite.scale.set(g.length / texture.width, COUPLER_WIDTH / texture.height);
        sprite.visible = true;

        const bandIndex = this._resolveBandIndex(positions[g.bogiePositionIndex]);
        if (bandIndex !== null) {
          this._worldRenderSystem.addToBand(couplerKey(id, i), sprite, bandIndex, 'onTrack');
          this._worldRenderSystem.setOrderInBand(couplerKey(id, i), 0);
        }
      }

      // Hide excess sprites from previous frame and remove from band
      const prevCount = this._activeCouplerCounts.get(id) ?? 0;
      for (let i = geoms.length; i < prevCount; i++) {
        pool[i].visible = false;
        this._worldRenderSystem.removeFromBand(couplerKey(id, i));
      }
      this._activeCouplerCounts.set(id, geoms.length);
    }
  }

  private _hideCouplerForTrain(trainId: number): void {
    const pool = this._couplerPools.get(trainId);
    const count = this._activeCouplerCounts.get(trainId) ?? 0;
    if (pool) {
      for (let i = 0; i < count; i++) {
        pool[i].visible = false;
      }
    }
  }

  private _syncCouplerPoolForTrain(trainId: number, count: number, texture: Texture): void {
    let pool = this._couplerPools.get(trainId);
    if (!pool) {
      pool = [];
      this._couplerPools.set(trainId, pool);
    }
    while (pool.length < count) {
      const sprite = new Sprite({ texture });
      sprite.anchor.set(0.5, 0.5);
      pool.push(sprite);
    }
  }

  private _updatePreviewCars(): void {
    const texture = this._getOrCreateCarTexture();
    const positions = this._getPreviewTrain().previewBogiePositions;
    if (texture === null || positions === null || positions.length < 2) {
      for (const s of this._previewCarPool) s.visible = false;
      return;
    }
    const geometries = getCarGeometries(positions, this._getPreviewTrain().cars);
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
    // Outer border
    g.rect(0, 0, CAR_TEX_WIDTH, CAR_TEX_HEIGHT);
    g.fill(0x3d3d3d);
    // Car body
    g.rect(2, 2, CAR_TEX_WIDTH - 4, CAR_TEX_HEIGHT - 4);
    g.fill(0x505050);
    // Center stripe
    g.rect(4, CAR_TEX_HEIGHT / 2 - 4, CAR_TEX_WIDTH - 8, 8);
    g.fill(0x2a2a2a);

    const bandWidth = 6;
    // Head-side band (left/rear) — green
    g.rect(2, 2, bandWidth, CAR_TEX_HEIGHT - 4);
    g.fill(0x2e8b57);
    // Tail-side band (right/front) — red
    g.rect(CAR_TEX_WIDTH - 2 - bandWidth, 2, bandWidth, CAR_TEX_HEIGHT - 4);
    g.fill(0xc0392b);

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

  private _getCustomCarTextures(carId: string): { rear: Texture; front: Texture } | null {
    const cached = this._customCarTextures.get(carId);
    if (cached) return cached;

    if (!this._carImageRegistry || !this._carImageRegistry.has(carId)) return null;

    const src = this._carImageRegistry.get(carId)!;
    // Load texture asynchronously; return null for this frame, it'll be available next frame
    Assets.load(src).then((texture: Texture) => {
      const frame = texture.frame;
      const rear = new Texture({
        source: texture.source,
        frame: new Rectangle(frame.x, frame.y, frame.width / 2, frame.height),
      });
      const front = new Texture({
        source: texture.source,
        frame: new Rectangle(frame.x + frame.width / 2, frame.y, frame.width / 2, frame.height),
      });
      this._customCarTextures.set(carId, { full: texture, rear, front });
    });
    return null;
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
      // Car will be added to the correct band in _updateActualCars.
    }

    for (let i = count; i < currentActive; i++) {
      pool[i].visible = false;
      const key = carKey(trainId, i);
      this._worldRenderSystem.removeFromBand(key);
    }
    this._activeCarCounts.set(trainId, count);
  }

  private _removeTrainDrawables(trainId: number): void {
    const pool = this._actualPools.get(trainId);
    const count = this._activeCounts.get(trainId) ?? 0;
    if (pool) {
      for (let i = 0; i < count; i++) {
        const key = bogieKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
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
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
      this._actualCarPools.delete(trainId);
    }
    this._activeCarCounts.delete(trainId);

    const gangwayPool = this._gangwayPools.get(trainId);
    const gangwayCount = this._activeGangwayCounts.get(trainId) ?? 0;
    if (gangwayPool) {
      for (let i = 0; i < gangwayCount; i++) {
        const key = gangwayKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
      this._gangwayPools.delete(trainId);
    }
    this._activeGangwayCounts.delete(trainId);

    const couplerPool = this._couplerPools.get(trainId);
    const couplerCount = this._activeCouplerCounts.get(trainId) ?? 0;
    if (couplerPool) {
      for (let i = 0; i < couplerCount; i++) {
        const key = couplerKey(trainId, i);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
      }
      this._couplerPools.delete(trainId);
    }
    this._activeCouplerCounts.delete(trainId);
  }

  private _resolveBandIndex(position: TrainPosition): number | null {
    const id = this._trackGraph.getDrawDataIdentifier(
      position.trackSegment,
      position.tValue,
    );
    if (id === null) return null;
    return this._trackRenderSystem.getTrackBandIndex(id);
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
      // Bogie will be added to the correct band in _updateActualBogies.
    }

    // Hide excess sprites and destroy+remove those beyond the pool's needs
    for (let i = count; i < currentActive; i++) {
      pool[i].visible = false;
      const key = bogieKey(trainId, i);
      this._worldRenderSystem.removeFromBand(key);
    }
    this._activeCounts.set(trainId, count);
  }

  private _syncPreviewPool(count: number): void {
    while (this._previewGraphicsPool.length < count) {
      const g = createBogieGraphics(PREVIEW_BOGIE_COLOR);
      g.zIndex = 1;
      this._previewGraphicsPool.push(g);
      this._previewContainer.addChild(g);
    }
    for (let i = 0; i < this._previewGraphicsPool.length; i++) {
      this._previewGraphicsPool[i].visible = this._showBogies && i < count;
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
