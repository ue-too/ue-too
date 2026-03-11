import type { SerializedTrackData } from '@/trains/tracks/types';
import { validateSerializedTrackData } from '@/trains/tracks/types';
import type { SerializedTrainData } from '@/trains/train-serialization';
import {
  deserializeTrainData,
  serializeTrainData,
  validateSerializedTrainData,
} from '@/trains/train-serialization';
import type { BananaAppComponents } from '@/utils/init-app';

export type SerializedSceneData = {
  tracks: SerializedTrackData;
  trains: SerializedTrainData;
};

export function serializeSceneData(app: BananaAppComponents): SerializedSceneData {
  return {
    tracks: app.curveEngine.trackGraph.serialize(),
    trains: serializeTrainData(app.trainManager, app.formationManager, app.carStockManager),
  };
}

export function deserializeSceneData(app: BananaAppComponents, data: SerializedSceneData): void {
  // Load tracks first so train positions can resolve to points
  app.curveEngine.trackGraph.loadFromSerializedData(data.tracks);
  deserializeTrainData(
    data.trains,
    app.curveEngine.trackGraph,
    app.jointDirectionManager,
    app.trainManager,
    app.formationManager,
    app.carStockManager,
  );
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
  if (!trackRes.valid) return { valid: false, error: `tracks: ${trackRes.error}` };
  const trainRes = validateSerializedTrainData(trains);
  if (!trainRes.valid) return { valid: false, error: `trains: ${trainRes.error}` };
  return { valid: true };
}

