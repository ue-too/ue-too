import type { Point } from '@ue-too/math';
import { Observable, SubscriptionOptions, SynchronousObservable } from '@ue-too/board';
import { ELEVATION } from '@/trains/tracks/types';
import { GenericEntityManager } from '@/utils';
import { BUILDING_PRESETS, type BuildingData, type BuildingPreset } from './types';

/**
 * Manages building entity lifecycle (create / delete) and exposes
 * observable events so render systems can react.
 *
 * @group Building System
 */
export class BuildingManager {

  private _entities: GenericEntityManager<BuildingData>;

  private _addObservable: Observable<[number, BuildingData]> =
    new SynchronousObservable<[number, BuildingData]>();
  private _deleteObservable: Observable<[number]> =
    new SynchronousObservable<[number]>();
  private _updateObservable: Observable<[number, BuildingData]> =
    new SynchronousObservable<[number, BuildingData]>();

  constructor(initialCount: number = 64) {
    this._entities = new GenericEntityManager<BuildingData>(initialCount);
  }

  /**
   * Place a new building and notify listeners.
   *
   * @param position - World-space centre of the building
   * @param preset - Shape preset name
   * @param elevation - Elevation level
   * @param height - Visual height in world units (default 4)
   * @returns The entity id assigned to the building
   */
  addBuilding(position: Point, preset: BuildingPreset, elevation: ELEVATION, height: number = 1): number {
    const relativeVerts = BUILDING_PRESETS[preset];
    const vertices: Point[] = relativeVerts.map(v => ({
      x: v.x + position.x,
      y: v.y + position.y,
    }));

    const data: BuildingData = { position, preset, elevation, height, vertices };
    const id = this._entities.createEntity(data);
    this._addObservable.notify(id, data);
    return id;
  }

  /**
   * Change the height of an existing building and notify listeners.
   */
  updateBuildingHeight(id: number, height: number): void {
    const entity = this._entities.getEntity(id);
    if (entity === null) return;
    entity.height = height;
    this._updateObservable.notify(id, entity);
  }

  /**
   * Remove a building by id and notify listeners.
   */
  removeBuilding(id: number): void {
    const entity = this._entities.getEntity(id);
    if (entity === null) return;
    this._entities.destroyEntity(id);
    this._deleteObservable.notify(id);
  }

  /**
   * Point-in-polygon hit test across all living buildings.
   *
   * @returns The entity id of the first building whose footprint contains
   *          `position`, or `null` if none match.
   */
  getBuildingAt(position: Point): number | null {
    const living = this._entities.getLivingEntitiesWithIndex();
    for (const { index, entity } of living) {
      if (pointInPolygon(position, entity.vertices)) {
        return index;
      }
    }
    return null;
  }

  getBuilding(id: number): BuildingData | null {
    return this._entities.getEntity(id);
  }

  onAdd(callback: (id: number, data: BuildingData) => void, options?: SubscriptionOptions) {
    return this._addObservable.subscribe(callback, options);
  }

  onDelete(callback: (id: number) => void, options?: SubscriptionOptions) {
    return this._deleteObservable.subscribe(callback, options);
  }

  onUpdate(callback: (id: number, data: BuildingData) => void, options?: SubscriptionOptions) {
    return this._updateObservable.subscribe(callback, options);
  }
}

/**
 * Winding-number point-in-polygon test.
 * Returns true when `point` is strictly inside or on the boundary of `polygon`.
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let winding = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    if (a.y <= point.y) {
      if (b.y > point.y && cross(a, b, point) > 0) {
        winding++;
      }
    } else {
      if (b.y <= point.y && cross(a, b, point) < 0) {
        winding--;
      }
    }
  }
  return winding !== 0;
}

/** 2D cross product of vectors (b-a) and (p-a). */
function cross(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
}
