import type { Point } from '@ue-too/math';

import type { CoreAttributes } from './attributes';
import type { TrackNavigator } from './track-navigator';

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
/** Lateral velocity damping coefficient (m/s² per m/s of normal velocity). */
export const NORMAL_DAMP = 0.5;
/** Half-length of horse collision body in meters. */
export const HORSE_HALF_LENGTH = 1.0;
/** Half-width of horse collision body in meters. */
export const HORSE_HALF_WIDTH = 0.325;

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
    lastDrain: number;
}

export interface InputState {
    tangential: number;
    normal: number;
}

/** Maximum number of horses supported per race. */
export const MAX_HORSES = 24;

export type RacePhase = 'gate' | 'running' | 'finished';

export interface RaceState {
    phase: RacePhase;
    horses: Horse[];
    playerHorseId: number | null;
    tick: number;
    finishOrder: number[];
}
