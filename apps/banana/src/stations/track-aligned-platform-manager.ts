import { Observable, SynchronousObservable, type SubscriptionOptions } from '@ue-too/board';
import { GenericEntityManager } from '@/utils';
import type {
    TrackAlignedPlatform,
    SerializedTrackAlignedPlatform,
    SerializedTrackAlignedPlatformData,
} from './track-aligned-platform-types';

export class TrackAlignedPlatformManager {
    private _manager: GenericEntityManager<TrackAlignedPlatform>;
    private _changeObservable: Observable<[]> = new SynchronousObservable<[]>();

    constructor(initialCount = 10) {
        this._manager = new GenericEntityManager<TrackAlignedPlatform>(initialCount);
    }

    /** Subscribe to notifications when platforms are created or destroyed. */
    onChange(callback: () => void, options?: SubscriptionOptions) {
        return this._changeObservable.subscribe(callback, options);
    }

    // -----------------------------------------------------------------------
    // CRUD
    // -----------------------------------------------------------------------

    createPlatformWithId(id: number, platform: Omit<TrackAlignedPlatform, 'id'>): void {
        this._manager.createEntityWithId(id, { ...platform, id } as TrackAlignedPlatform);
        this._changeObservable.notify();
    }

    getAllPlatforms(): { id: number; platform: TrackAlignedPlatform }[] {
        return this._manager
            .getLivingEntitiesWithIndex()
            .map(({ index, entity }) => ({ id: index, platform: entity }));
    }

    createPlatform(platform: Omit<TrackAlignedPlatform, 'id'>): number {
        const id = this._manager.createEntity({ ...platform, id: -1 } as TrackAlignedPlatform);
        const entity = this._manager.getEntity(id);
        if (entity) entity.id = id;
        this._changeObservable.notify();
        return id;
    }

    getPlatform(id: number): TrackAlignedPlatform | null {
        return this._manager.getEntity(id);
    }

    destroyPlatform(id: number): void {
        this._manager.destroyEntity(id);
        this._changeObservable.notify();
    }

    destroyPlatformsForStation(stationId: number): void {
        const toDestroy = this._manager
            .getLivingEntitiesWithIndex()
            .filter(({ entity }) => entity.stationId === stationId)
            .map(({ index }) => index);
        for (const id of toDestroy) {
            this._manager.destroyEntity(id);
        }
        if (toDestroy.length > 0) this._changeObservable.notify();
    }

    /** Manually trigger change notifications (e.g. after updating station references). */
    notifyChange(): void {
        this._changeObservable.notify();
    }

    // -----------------------------------------------------------------------
    // Lookups
    // -----------------------------------------------------------------------

    getPlatformsByStation(stationId: number): { id: number; platform: TrackAlignedPlatform }[] {
        return this._manager
            .getLivingEntitiesWithIndex()
            .filter(({ entity }) => entity.stationId === stationId)
            .map(({ index, entity }) => ({ id: index, platform: entity }));
    }

    getPlatformsBySegment(segmentId: number): { id: number; platform: TrackAlignedPlatform }[] {
        return this._manager
            .getLivingEntitiesWithIndex()
            .filter(({ entity }) => {
                const inSpineA = entity.spineA.some((e) => e.trackSegment === segmentId);
                const inSpineB = entity.spineB !== null && entity.spineB.some((e) => e.trackSegment === segmentId);
                return inSpineA || inSpineB;
            })
            .map(({ index, entity }) => ({ id: index, platform: entity }));
    }

    // -----------------------------------------------------------------------
    // Serialization
    // -----------------------------------------------------------------------

    serialize(): SerializedTrackAlignedPlatformData {
        const platforms: SerializedTrackAlignedPlatform[] = this._manager
            .getLivingEntitiesWithIndex()
            .map(({ index, entity }) => ({
                id: index,
                stationId: entity.stationId,
                spineA: entity.spineA.map((e) => ({
                    trackSegment: e.trackSegment,
                    tStart: e.tStart,
                    tEnd: e.tEnd,
                    side: e.side,
                })),
                spineB:
                    entity.spineB !== null
                        ? entity.spineB.map((e) => ({
                              trackSegment: e.trackSegment,
                              tStart: e.tStart,
                              tEnd: e.tEnd,
                              side: e.side,
                          }))
                        : null,
                offset: entity.offset,
                outerVertices:
                    entity.outerVertices.kind === 'single'
                        ? {
                              kind: 'single' as const,
                              vertices: entity.outerVertices.vertices.map((v) => ({ x: v.x, y: v.y })),
                          }
                        : {
                              kind: 'dual' as const,
                              capA: entity.outerVertices.capA.map((v) => ({ x: v.x, y: v.y })),
                              capB: entity.outerVertices.capB.map((v) => ({ x: v.x, y: v.y })),
                          },
                stopPositions: entity.stopPositions.map((sp) => ({ ...sp })),
            }));

        return { platforms };
    }

    static deserialize(data: SerializedTrackAlignedPlatformData): TrackAlignedPlatformManager {
        const maxId = data.platforms.reduce((max, p) => Math.max(max, p.id), -1);
        const manager = new TrackAlignedPlatformManager(Math.max(maxId + 1, 10));
        for (const p of data.platforms) {
            manager._manager.createEntityWithId(p.id, {
                id: p.id,
                stationId: p.stationId,
                spineA: p.spineA.map((e) => ({
                    trackSegment: e.trackSegment,
                    tStart: e.tStart,
                    tEnd: e.tEnd,
                    side: e.side,
                })),
                spineB:
                    p.spineB !== null
                        ? p.spineB.map((e) => ({
                              trackSegment: e.trackSegment,
                              tStart: e.tStart,
                              tEnd: e.tEnd,
                              side: e.side,
                          }))
                        : null,
                offset: p.offset,
                outerVertices:
                    p.outerVertices.kind === 'single'
                        ? {
                              kind: 'single' as const,
                              vertices: p.outerVertices.vertices.map((v) => ({ x: v.x, y: v.y })),
                          }
                        : {
                              kind: 'dual' as const,
                              capA: p.outerVertices.capA.map((v) => ({ x: v.x, y: v.y })),
                              capB: p.outerVertices.capB.map((v) => ({ x: v.x, y: v.y })),
                          },
                stopPositions: p.stopPositions.map((sp) => ({ ...sp })),
            });
        }
        return manager;
    }
}
