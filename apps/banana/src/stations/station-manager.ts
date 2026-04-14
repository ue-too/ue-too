import { GenericEntityManager } from '@/utils';
import type {
  Station,
  SerializedStation,
  SerializedStationData,
} from './types';

export class StationManager {
  private _manager: GenericEntityManager<Station>;
  private _onDestroyStation: ((id: number) => void) | null = null;

  constructor(initialCount = 10) {
    this._manager = new GenericEntityManager<Station>(initialCount);
  }

  /**
   * Register a callback that runs before a station is destroyed.
   * Used to cascade-delete track-aligned platforms.
   */
  setOnDestroyStation(cb: (id: number) => void): void {
    this._onDestroyStation = cb;
  }

  createStation(station: Omit<Station, 'id'>): number {
    const id = this._manager.createEntity({ ...station, id: -1 } as Station);
    // Patch the id to match the entity number assigned by the manager.
    const entity = this._manager.getEntity(id);
    if (entity) entity.id = id;
    return id;
  }

  getStation(id: number): Station | null {
    return this._manager.getEntity(id);
  }

  getStations(): { id: number; station: Station }[] {
    return this._manager
      .getLivingEntitiesWithIndex()
      .map(({ index, entity }) => ({ id: index, station: entity }));
  }

  createStationWithId(id: number, station: Station): void {
    this._manager.createEntityWithId(id, { ...station, id });
  }

  destroyStation(id: number): void {
    this._onDestroyStation?.(id);
    this._manager.destroyEntity(id);
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  serialize(): SerializedStationData {
    const stations: SerializedStation[] = this._manager
      .getLivingEntitiesWithIndex()
      .map(({ index, entity }) => ({
        id: index,
        name: entity.name,
        position: { x: entity.position.x, y: entity.position.y },
        elevation: entity.elevation,
        platforms: entity.platforms.map((p) => ({
          id: p.id,
          track: p.track,
          width: p.width,
          offset: p.offset,
          side: p.side,
          stopPositions: p.stopPositions.map((sp) => ({ ...sp })),
        })),
        trackSegments: [...entity.trackSegments],
        joints: [...entity.joints],
        trackAlignedPlatforms: [...entity.trackAlignedPlatforms],
      }));

    return { stations };
  }

  static deserialize(data: SerializedStationData): StationManager {
    const maxId = data.stations.reduce((max, s) => Math.max(max, s.id), -1);
    const manager = new StationManager(Math.max(maxId + 1, 10));
    for (const s of data.stations) {
      manager._manager.createEntityWithId(s.id, {
        id: s.id,
        name: s.name,
        position: { x: s.position.x, y: s.position.y },
        elevation: s.elevation,
        platforms: s.platforms.map((p) => ({
          id: p.id,
          track: p.track,
          width: p.width,
          offset: p.offset,
          side: p.side as 1 | -1,
          stopPositions: p.stopPositions.map((sp) => ({ ...sp })),
        })),
        trackSegments: [...s.trackSegments],
        joints: [...s.joints],
        trackAlignedPlatforms: [...(s.trackAlignedPlatforms ?? [])],
      });
    }
    return manager;
  }
}
