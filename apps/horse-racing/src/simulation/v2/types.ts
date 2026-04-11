import type { Point } from '@ue-too/math';
import type { TrackNavigator } from '../track-navigator';

// --- Physics constants ---

/** Target cruise speed in m/s. */
export const TARGET_CRUISE = 15;
/** Player tangential force cap in m/s^2. */
export const F_T_MAX = 5;
/** Player normal force cap in m/s^2. */
export const F_N_MAX = 3;
/** Cruise controller proportional gain, 1/s. */
export const K_CRUISE = 0.5;
/** Linear drag coefficient, 1/s. */
export const C_DRAG = 0.1;
/** Half-width of the track in meters. Rails are at +/- this distance. */
export const TRACK_HALF_WIDTH = 10;
/** Fixed physics timestep in seconds. */
export const FIXED_DT = 1 / 60;

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
