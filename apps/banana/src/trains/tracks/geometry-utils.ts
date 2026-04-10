import { TrackSegmentDrawData } from './types';

/** Resolution of the procedural track segment texture (power-of-two for repeat wrap). */
const TRACK_TEX_SIZE = 64;

/** Compute the ballast/slab half-width for a draw data entry. Always derived from gauge. */
export const ballastHalfWidth = (drawData: TrackSegmentDrawData): number => {
    const tieOverhang = 4;
    const tieHw = (drawData.gauge / 2) * ((TRACK_TEX_SIZE + tieOverhang * 2) / TRACK_TEX_SIZE);
    return tieHw + 0.15;
};
