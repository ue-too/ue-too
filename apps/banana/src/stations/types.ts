import type { Point } from '@ue-too/math';
import type { ELEVATION } from '@/trains/tracks/types';

/** Direction a train can travel along a track segment. */
export type TrackDirection = 'tangent' | 'reverseTangent';

/** Defines where a train stops on a particular platform. */
export type StopPosition = {
  trackSegmentId: number;
  direction: TrackDirection;
  tValue: number;
};

/** An island platform sitting between two tracks. */
export type Platform = {
  id: number;
  /** The track segment ID this platform serves. */
  track: number;
  /** Platform width in world units (meters). */
  width: number;
  /** Lateral offset from track centerline to the near edge of the platform (meters). */
  offset: number;
  /**
   * Which side of the track the platform extends toward.
   *  1 = positive-normal direction (left of track tangent),
   * -1 = negative-normal direction (right of track tangent).
   */
  side: 1 | -1;
  stopPositions: StopPosition[];
};

/** A station groups platforms and the track infrastructure they use. */
export type Station = {
  id: number;
  name: string;
  /** World-space position of the station, set at placement time. */
  position: Point;
  elevation: ELEVATION;
  platforms: Platform[];
  /** IDs of track segments owned by this station. */
  trackSegments: number[];
  /** IDs of track joints owned by this station. */
  joints: number[];
  trackAlignedPlatforms: number[];
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export type SerializedStopPosition = StopPosition;

export type SerializedPlatform = {
  id: number;
  track: number;
  width: number;
  offset: number;
  side: 1 | -1;
  stopPositions: SerializedStopPosition[];
};

export type SerializedStation = {
  id: number;
  name: string;
  position: { x: number; y: number };
  elevation: ELEVATION;
  platforms: SerializedPlatform[];
  trackSegments: number[];
  joints: number[];
  trackAlignedPlatforms: number[];
};

export type SerializedStationData = {
  stations: SerializedStation[];
};
