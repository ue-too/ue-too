import type { SerializedSignalData } from '@/signals/types';
import { StationManager } from '@/stations/station-manager';
import { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import type { SerializedTrackAlignedPlatformData } from '@/stations/track-aligned-platform-types';
import type { SerializedStationData } from '@/stations/types';
import {
    TerrainData,
    validateSerializedTerrainData,
} from '@/terrain/terrain-data';
import type { SerializedTerrainData } from '@/terrain/terrain-data';
import { TimetableManager } from '@/timetable';
import type { SerializedTimetableData } from '@/timetable/types';
import {
    JointDirectionPreferenceMap,
    type SerializedJointDirectionPreference,
} from '@/trains/tracks/joint-direction-preference-map';
import type { SerializedTrackData } from '@/trains/tracks/types';
import { validateSerializedTrackData } from '@/trains/tracks/types';
import type { SerializedTrainData } from '@/trains/train-serialization';
import {
    deserializeTrainData,
    serializeTrainData,
    validateSerializedTrainData,
} from '@/trains/train-serialization';
import { clearShadowCache } from '@/utils';
import type { BananaAppComponents } from '@/utils/init-app';

export type SerializedSceneData = {
    tracks: SerializedTrackData;
    trains: SerializedTrainData;
    stations?: SerializedStationData;
    terrain?: SerializedTerrainData;
    timetable?: SerializedTimetableData;
    signals?: SerializedSignalData;
    time?: number;
    trackAlignedPlatforms?: SerializedTrackAlignedPlatformData;
    jointDirectionPreferences?: SerializedJointDirectionPreference[];
};

export function serializeSceneData(
    app: BananaAppComponents
): SerializedSceneData {
    return {
        tracks: app.curveEngine.trackGraph.serialize(),
        trains: serializeTrainData(
            app.trainManager,
            app.formationManager,
            app.carStockManager
        ),
        stations: app.stationManager.serialize(),
        terrain: app.terrainData.serialize(),
        timetable: app.timetableManager.serialize(),
        signals: app.blockSignalManager.serialize(),
        time: app.timeManager.currentTime,
        trackAlignedPlatforms: app.trackAlignedPlatformManager.serialize(),
        jointDirectionPreferences: app.jointDirectionPreferenceMap.serialize(),
    };
}

export async function deserializeSceneData(
    app: BananaAppComponents,
    data: SerializedSceneData,
    options?: { onProgress?: (loaded: number, total: number) => void }
): Promise<void> {
    // Clear caches that reference old track geometry before replacing tracks.
    clearShadowCache();

    // Load tracks first so train positions can resolve to points (batched)
    await app.curveEngine.trackGraph.loadFromSerializedData(data.tracks, {
        onProgress: options?.onProgress,
    });
    deserializeTrainData(
        data.trains,
        app.curveEngine.trackGraph,
        app.jointDirectionManager,
        app.trainManager,
        app.formationManager,
        app.carStockManager
    );

    // Load terrain data if present
    if (data.terrain) {
        const restoredTerrain = TerrainData.deserialize(data.terrain);
        app.terrainRenderSystem.setTerrainData(restoredTerrain);
    }

    // Load timetable data if present
    if (data.timetable) {
        // Dispose the current timetable manager's subscriptions
        app.timetableManager.dispose();
        const restored = TimetableManager.deserialize(
            data.timetable,
            app.curveEngine.trackGraph,
            app.trainManager,
            app.stationManager,
            app.signalStateEngine
        );
        // Replace the timetable manager on the app components and the mutable ref
        // so the TimeManager callback uses the new instance.
        (app as { timetableManager: TimetableManager }).timetableManager =
            restored;
        app.timetableRef.current = restored;
    }

    // Restore simulation time if present
    if (data.time !== undefined) {
        app.timeManager.setCurrentTime(data.time);
    }

    // Load signal data if present
    if (data.signals) {
        app.blockSignalManager.deserialize(data.signals);
    }

    // Load stations and rebuild their render visuals (must come before
    // track-aligned platforms so that station elevation lookups succeed).
    if (data.stations) {
        const restored = StationManager.deserialize(data.stations);
        // Replace the current station manager's state
        for (const { id } of app.stationManager.getStations()) {
            app.stationRenderSystem.removeStation(id);
            app.stationManager.destroyStation(id);
        }
        for (const { id, station } of restored.getStations()) {
            app.stationManager.createStationWithId(id, station);
            app.stationRenderSystem.addStation(id);
        }
    }

    // Load track-aligned platforms if present (after stations are restored)
    if (data.trackAlignedPlatforms) {
        const restored = TrackAlignedPlatformManager.deserialize(
            data.trackAlignedPlatforms
        );
        // Remove existing platforms
        for (const {
            id,
        } of app.trackAlignedPlatformManager.getAllPlatforms()) {
            app.trackAlignedPlatformRenderSystem.removePlatform(id);
            app.trackAlignedPlatformManager.destroyPlatform(id);
        }
        // Add restored platforms
        for (const { id, platform } of restored.getAllPlatforms()) {
            app.trackAlignedPlatformManager.createPlatformWithId(id, platform);
            const elevation =
                app.stationManager.getStation(platform.stationId)?.elevation ??
                0;
            app.trackAlignedPlatformRenderSystem.addPlatform(id, elevation);
        }
    }

    // Load joint direction preferences if present
    if (data.jointDirectionPreferences) {
        app.jointDirectionPreferenceMap.clear();
        for (const entry of data.jointDirectionPreferences) {
            if (entry.tangent !== undefined) {
                app.jointDirectionPreferenceMap.set(entry.joint, 'tangent', entry.tangent);
            }
            if (entry.reverseTangent !== undefined) {
                app.jointDirectionPreferenceMap.set(entry.joint, 'reverseTangent', entry.reverseTangent);
            }
        }
    }
}

export function validateSerializedSceneData(
    data: unknown
): { valid: true } | { valid: false; error: string } {
    if (data == null || typeof data !== 'object') {
        return { valid: false, error: 'Data must be a non-null object' };
    }
    const obj = data as Record<string, unknown>;
    const tracks = obj.tracks;
    const trains = obj.trains;
    const trackRes = validateSerializedTrackData(tracks);
    if (!trackRes.valid)
        return { valid: false, error: `tracks: ${trackRes.error}` };
    const trainRes = validateSerializedTrainData(trains);
    if (!trainRes.valid)
        return { valid: false, error: `trains: ${trainRes.error}` };
    // stations is optional for backwards compatibility
    if (obj.stations !== undefined) {
        const stationRes = validateSerializedStationData(obj.stations);
        if (!stationRes.valid)
            return { valid: false, error: `stations: ${stationRes.error}` };
    }
    // terrain is optional for backwards compatibility
    if (obj.terrain !== undefined) {
        const terrainRes = validateSerializedTerrainData(obj.terrain);
        if (!terrainRes.valid)
            return { valid: false, error: `terrain: ${terrainRes.error}` };
    }
    return { valid: true };
}

function validateSerializedStationData(
    data: unknown
): { valid: true } | { valid: false; error: string } {
    if (data == null || typeof data !== 'object') {
        return { valid: false, error: 'Data must be a non-null object' };
    }
    const obj = data as Record<string, unknown>;
    if (!Array.isArray(obj.stations)) {
        return { valid: false, error: 'Missing or invalid "stations" array' };
    }
    for (let i = 0; i < obj.stations.length; i++) {
        const s = obj.stations[i] as Record<string, unknown>;
        const prefix = `stations[${i}]`;
        if (typeof s.id !== 'number') {
            return { valid: false, error: `${prefix}.id must be a number` };
        }
        if (typeof s.name !== 'string') {
            return { valid: false, error: `${prefix}.name must be a string` };
        }
        if (
            s.position == null ||
            typeof (s.position as Record<string, unknown>).x !== 'number' ||
            typeof (s.position as Record<string, unknown>).y !== 'number'
        ) {
            return { valid: false, error: `${prefix}.position must be {x, y}` };
        }
        if (typeof s.elevation !== 'number') {
            return {
                valid: false,
                error: `${prefix}.elevation must be a number`,
            };
        }
        if (!Array.isArray(s.platforms)) {
            return {
                valid: false,
                error: `${prefix}.platforms must be an array`,
            };
        }
        if (!Array.isArray(s.trackSegments)) {
            return {
                valid: false,
                error: `${prefix}.trackSegments must be a number[]`,
            };
        }
        if (!Array.isArray(s.joints)) {
            return {
                valid: false,
                error: `${prefix}.joints must be a number[]`,
            };
        }
    }
    return { valid: true };
}
