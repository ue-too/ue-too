import type { Point } from '@ue-too/math';
import type { TrackNavigator } from './track-navigator';
import type { CoreAttributes } from './attributes';

// --- Physics constants ---

/** Cruise controller proportional gain, 1/s. */
export const K_CRUISE = 2.0;
/** Linear drag coefficient, 1/s. */
export const C_DRAG = 0.1;
/** Half-width of the track in meters. Rails are at +/- this distance. */
export const TRACK_HALF_WIDTH = 10.325;
/** Physics substep frequency in Hz. */
export const PHYS_HZ = 240;
/** Number of physics substeps per game tick. */
export const PHYS_SUBSTEPS = 8;
/** Fixed physics timestep in seconds (one substep). */
export const FIXED_DT = 1 / PHYS_HZ;

// --- State shapes ---

export interface Horse {
    id: number;
    color: number;
    pos: Point;
    tangentialVel: number;
    normalVel: number;
    trackProgress: number;
    navigator: TrackNavigator;
    finished: boolean;
    finishOrder: number | null;
    baseAttributes: CoreAttributes;
    currentStamina: number;
    effectiveAttributes: CoreAttributes;
}

export interface InputState {
    tangential: -1 | 0 | 1;
    normal: -1 | 0 | 1;
}

export type RacePhase = 'gate' | 'running' | 'finished';

export interface RaceState {
    phase: RacePhase;
    horses: Horse[];
    playerHorseId: number | null;
    tick: number;
    finishOrder: number[];
}
