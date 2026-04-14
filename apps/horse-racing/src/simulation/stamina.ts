import type { CoreAttributes } from './attributes';
import type { Horse, InputState } from './types';
import { FIXED_DT, PHYS_SUBSTEPS } from './types';
import type { TrackFrame } from './track-navigator';

// --- Drain rate constants (initial values, to be tuned via integration tests) ---

export const OVERDRIVE_DRAIN_RATE = 0.01;
export const STAMINA_DRAIN_RATE = 0.015;
export const LATERAL_STEERING_DRAIN_RATE = 0.006;
export const CORNERING_DRAIN_RATE = 0.002;
export const SPEED_DRAIN_RATE = 0.002;
export const LATERAL_VELOCITY_DRAIN_RATE = 0.0008;
export const GRIP_FORCE_BASELINE = 2.0;

/** Reference cruise ticks calibrated from test_oval at cruise speed. */
export const REFERENCE_CRUISE_TICKS = 2000;

/**
 * Compute drain normalization factor so cruise-effort stamina usage
 * is consistent across tracks of different lengths.
 */
export function computeDrainScale(
    trackTotalLength: number,
    cruiseSpeed: number,
): number {
    const dtPerTick = FIXED_DT * PHYS_SUBSTEPS;
    const estimatedTicks = trackTotalLength / (cruiseSpeed * dtPerTick);
    if (estimatedTicks < 1e-6) return 1;
    return REFERENCE_CRUISE_TICKS / estimatedTicks;
}

/**
 * Drain stamina based on the horse's current effort.
 * Mutates `horse.currentStamina` and `horse.lastDrain`.
 *
 * Called once per game tick (not per substep), after physics.
 */
export function drainStamina(
    horse: Horse,
    attrs: CoreAttributes,
    input: InputState,
    frame: TrackFrame,
    drainScale = 1.0,
): void {
    let drain = 0;

    // Overdrive: cost of running above cruise speed
    if (horse.tangentialVel > attrs.cruiseSpeed) {
        drain += (horse.tangentialVel - attrs.cruiseSpeed) * OVERDRIVE_DRAIN_RATE;
    }

    // Jockey push: cost of forward input
    if (input.tangential > 0) {
        drain += Math.abs(input.tangential) * STAMINA_DRAIN_RATE;
    }

    // Lateral steering: cost of steering input
    if (input.normal !== 0) {
        drain += Math.abs(input.normal) * LATERAL_STEERING_DRAIN_RATE;
    }

    // Cornering: cost of exceeding grip threshold on curves
    if (frame.turnRadius < 1e6 && horse.tangentialVel > 0) {
        const requiredForce = (horse.tangentialVel ** 2) / frame.turnRadius;
        const toleratedForce = attrs.corneringGrip * GRIP_FORCE_BASELINE;
        if (requiredForce > toleratedForce) {
            drain += (requiredForce - toleratedForce) * CORNERING_DRAIN_RATE;
        }
    }

    // Speed tax: baseline cost of moving
    drain += Math.abs(horse.tangentialVel) * SPEED_DRAIN_RATE;

    // Lateral velocity tax
    drain += Math.abs(horse.normalVel) * LATERAL_VELOCITY_DRAIN_RATE;

    // Apply per-horse efficiency and track-length normalization
    drain *= attrs.drainRateMult;
    drain *= drainScale;

    horse.lastDrain = drain;
    horse.currentStamina = Math.max(0, horse.currentStamina - drain);
}
