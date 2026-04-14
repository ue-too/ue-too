export {
    V2Sim,
    attachV2Sim,
    type V2SimHandle,
    type PhaseChangeCallback,
    type RaceRecording,
} from './sim';
export type { Horse, InputState, RacePhase, RaceState } from './types';
export { MAX_HORSES } from './types';
export type { CoreAttributes } from './attributes';
export { createDefaultAttributes, TRAIT_RANGES } from './attributes';
export { Race } from './race';
export {
    buildObservations,
    OBS_SIZE,
    SELF_STATE_SIZE,
    TRACK_CONTEXT_SIZE,
    OPPONENT_SLOT_SIZE,
    OPPONENT_SLOTS,
} from './observation';
