import { describe, it, expect, beforeEach } from 'bun:test';
import { StationManager } from '../src/stations/station-manager';
import { TrackAlignedPlatformManager } from '../src/stations/track-aligned-platform-manager';
import { ELEVATION } from '../src/trains/tracks/types';
import type { TrackAlignedPlatform } from '../src/stations/track-aligned-platform-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStation(name: string) {
    return {
        name,
        position: { x: 0, y: 0 },
        elevation: ELEVATION.GROUND,
        platforms: [],
        trackSegments: [],
        joints: [],
        trackAlignedPlatforms: [] as number[],
    };
}

function makePlatform(stationId: number, segments: number[]): Omit<TrackAlignedPlatform, 'id'> {
    return {
        stationId,
        spineA: segments.map((seg) => ({ trackSegment: seg, tStart: 0, tEnd: 1, side: 1 as const })),
        spineB: null,
        offset: 2.0,
        outerVertices: { kind: 'single', vertices: [{ x: 0, y: 5 }, { x: 10, y: 5 }] },
        stopPositions: [],
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StationManager — onDestroyStation cascade', () => {
    let stationMgr: StationManager;
    let platformMgr: TrackAlignedPlatformManager;

    beforeEach(() => {
        stationMgr = new StationManager();
        platformMgr = new TrackAlignedPlatformManager();

        stationMgr.setOnDestroyStation((stationId) => {
            const platforms = platformMgr.getPlatformsByStation(stationId);
            for (const { id } of platforms) {
                platformMgr.destroyPlatform(id);
            }
        });
    });

    it('should cascade-delete track-aligned platforms when a station is destroyed', () => {
        const stationId = stationMgr.createStation(makeStation('Test'));
        const platId = platformMgr.createPlatform(makePlatform(stationId, [10]));

        stationMgr.destroyStation(stationId);

        expect(stationMgr.getStation(stationId)).toBeNull();
        expect(platformMgr.getPlatform(platId)).toBeNull();
        expect(platformMgr.getPlatformsByStation(stationId)).toHaveLength(0);
    });

    it('should cascade-delete multiple platforms for the same station', () => {
        const stationId = stationMgr.createStation(makeStation('Test'));
        platformMgr.createPlatform(makePlatform(stationId, [10]));
        platformMgr.createPlatform(makePlatform(stationId, [11]));
        platformMgr.createPlatform(makePlatform(stationId, [12]));

        stationMgr.destroyStation(stationId);

        expect(platformMgr.getPlatformsByStation(stationId)).toHaveLength(0);
        expect(platformMgr.getAllPlatforms()).toHaveLength(0);
    });

    it('should not affect platforms belonging to other stations', () => {
        const station1 = stationMgr.createStation(makeStation('Station 1'));
        const station2 = stationMgr.createStation(makeStation('Station 2'));
        platformMgr.createPlatform(makePlatform(station1, [10]));
        const platId2 = platformMgr.createPlatform(makePlatform(station2, [11]));

        stationMgr.destroyStation(station1);

        expect(platformMgr.getPlatformsByStation(station2)).toHaveLength(1);
        expect(platformMgr.getPlatform(platId2)).not.toBeNull();
    });

    it('should clear segment lookups for cascade-deleted platforms', () => {
        const stationId = stationMgr.createStation(makeStation('Test'));
        platformMgr.createPlatform(makePlatform(stationId, [10, 11]));

        stationMgr.destroyStation(stationId);

        expect(platformMgr.getPlatformsBySegment(10)).toHaveLength(0);
        expect(platformMgr.getPlatformsBySegment(11)).toHaveLength(0);
    });

    it('should be a no-op when station has no platforms', () => {
        const stationId = stationMgr.createStation(makeStation('Empty'));
        expect(() => stationMgr.destroyStation(stationId)).not.toThrow();
    });
});

describe('StationManager — without cascade callback', () => {
    it('should still destroy station when no callback is set', () => {
        const stationMgr = new StationManager();
        const stationId = stationMgr.createStation(makeStation('Test'));
        stationMgr.destroyStation(stationId);
        expect(stationMgr.getStation(stationId)).toBeNull();
    });
});

describe('StationManager — serialization with trackAlignedPlatforms', () => {
    it('should round-trip trackAlignedPlatforms field', () => {
        const mgr = new StationManager();
        const station = makeStation('Test');
        station.trackAlignedPlatforms = [5, 10, 15];
        const id = mgr.createStation(station);

        const data = mgr.serialize();
        const restored = StationManager.deserialize(data);
        const s = restored.getStation(id);

        expect(s).not.toBeNull();
        expect(s!.trackAlignedPlatforms).toEqual([5, 10, 15]);
    });

    it('should default trackAlignedPlatforms to empty on old data', () => {
        // Simulate old serialized data without the field
        const data = {
            stations: [{
                id: 0,
                name: 'Old Station',
                position: { x: 0, y: 0 },
                elevation: ELEVATION.GROUND,
                platforms: [],
                trackSegments: [],
                joints: [],
                // trackAlignedPlatforms intentionally missing
            }],
        };

        const restored = StationManager.deserialize(data as any);
        const s = restored.getStation(0);
        expect(s).not.toBeNull();
        expect(s!.trackAlignedPlatforms).toEqual([]);
    });
});
