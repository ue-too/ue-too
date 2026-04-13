import { DEFAULT_CAR_HALF_WIDTH, DEFAULT_PLATFORM_CLEARANCE } from './track-aligned-platform-types';

/** Texture size used by track rendering (must match render-system constant). */
const TRACK_TEX_SIZE = 64;

/**
 * Compute the lateral offset from track centerline to the platform's
 * track-facing edge. Mirrors the catenary pole offset logic but adds
 * clearance for rolling stock width.
 *
 * @param gauge - Track gauge in meters.
 * @param bedWidth - Total bed width in meters, or undefined if no bed.
 * @param carHalfWidth - Half the car body width (meters).
 * @param clearance - Safety gap between car edge and platform edge (meters).
 */
export function computePlatformOffset(
    gauge: number,
    bedWidth: number | undefined,
    carHalfWidth: number = DEFAULT_CAR_HALF_WIDTH,
    clearance: number = DEFAULT_PLATFORM_CLEARANCE,
): number {
    const tieOverhang = 4;
    const tieHw = (gauge / 2) * ((TRACK_TEX_SIZE + tieOverhang * 2) / TRACK_TEX_SIZE);
    const ballastHw = tieHw + 0.15;

    const trackEdge =
        bedWidth !== undefined ? Math.max(ballastHw, bedWidth / 2) : ballastHw;

    return trackEdge + clearance + carHalfWidth;
}
