import type { EffectiveAttributes } from './horse-attributes';
import { TRAIT_RANGES } from './horse-attributes';

// ---------------------------------------------------------------------------
// Stamina constants
// ---------------------------------------------------------------------------

/** Stamina drain per unit of extra tangential acceleration per tick. */
export const STAMINA_DRAIN_RATE = 0.1;

/** Stamina drain per unit of speed above cruise speed per tick. */
export const OVERDRIVE_DRAIN_RATE = 0.05;

/** Stamina drain per unit of excess cornering force per tick. */
export const CORNERING_DRAIN_RATE = 0.02;

/**
 * Base cornering force tolerance, multiplied by `corneringGrip`.
 *
 * @remarks
 * If the required centripetal force (`tangentialVel² / turnRadius`) exceeds
 * `corneringGrip × GRIP_FORCE_BASELINE`, the excess drains stamina.
 * Below this threshold, cornering is free.
 */
export const GRIP_FORCE_BASELINE = 150.0;

// Exhaustion thresholds (fraction of max stamina)
const EXHAUSTION_FORWARD_ACCEL_THRESHOLD = 0.30;
const EXHAUSTION_MAX_SPEED_THRESHOLD = 0.20;
const EXHAUSTION_TURN_ACCEL_THRESHOLD = 0.15;

// ---------------------------------------------------------------------------
// Stamina update
// ---------------------------------------------------------------------------

/**
 * Computes stamina drain/recovery for a single tick and returns the new
 * stamina value.
 *
 * @param currentStamina - Current stamina level
 * @param eff - Effective attributes (after modifiers, before exhaustion)
 * @param extraTangential - Jockey's tangential input this tick
 * @param currentSpeed - Horse's current tangential velocity
 * @param turnRadius - Current turn radius (Infinity on straights)
 * @returns Updated stamina value
 *
 * @group Stamina
 */
export function updateStamina(
    currentStamina: number,
    eff: EffectiveAttributes,
    extraTangential: number,
    currentSpeed: number,
    turnRadius: number,
): number {
    let drain = 0;

    // Drain from jockey pushing forward
    if (extraTangential > 0) {
        drain += extraTangential * STAMINA_DRAIN_RATE;
    }

    // Drain from exceeding cruise speed
    if (currentSpeed > eff.cruiseSpeed) {
        drain += (currentSpeed - eff.cruiseSpeed) * OVERDRIVE_DRAIN_RATE;
    }

    // Drain from cornering beyond grip threshold
    if (turnRadius < 1e6) {
        const requiredForce = (currentSpeed * currentSpeed) / turnRadius;
        const toleratedForce = eff.corneringGrip * GRIP_FORCE_BASELINE;
        if (requiredForce > toleratedForce) {
            drain += (requiredForce - toleratedForce) * CORNERING_DRAIN_RATE;
        }
    }

    // Recovery: always applies, but reduced when draining (prevents
    // binary on/off exploit where agent alternates push/coast ticks).
    if (drain > 0) {
        const net = drain - eff.staminaRecovery * 0.25;
        if (net > 0) {
            return Math.max(0, currentStamina - net);
        }
        return Math.min(eff.stamina, currentStamina - net);
    }

    return Math.min(eff.stamina, currentStamina + eff.staminaRecovery);
}

/**
 * Applies exhaustion penalties to effective attributes based on current
 * stamina level.
 *
 * @remarks
 * This produces the final effective attributes used by the engine.
 * Exhaustion causes gradual degradation, not a cliff:
 * - Below 30% stamina: `forwardAccel` scales down proportionally
 * - Below 20% stamina: `maxSpeed` drops toward `cruiseSpeed`
 * - Below 15% stamina: `turnAccel` drops by 25%
 *
 * @param eff - Effective attributes (after modifier resolution)
 * @param currentStamina - Current stamina level
 * @param maxStamina - Max stamina (from base attributes)
 * @returns New effective attributes with exhaustion penalties applied
 *
 * @group Stamina
 */
export function applyExhaustion(
    eff: EffectiveAttributes,
    currentStamina: number,
    maxStamina: number,
): EffectiveAttributes {
    if (maxStamina <= 0) return eff;

    const ratio = currentStamina / maxStamina;
    const result = { ...eff };

    if (ratio < EXHAUSTION_FORWARD_ACCEL_THRESHOLD) {
        // Gradual: at 0% stamina → 0 forward accel; at 30% → full
        const scale = ratio / EXHAUSTION_FORWARD_ACCEL_THRESHOLD;
        result.forwardAccel = Math.max(
            TRAIT_RANGES.forwardAccel.min,
            result.forwardAccel * scale,
        );
    }

    if (ratio < EXHAUSTION_MAX_SPEED_THRESHOLD) {
        // Lerp maxSpeed toward cruiseSpeed
        const scale = ratio / EXHAUSTION_MAX_SPEED_THRESHOLD;
        result.maxSpeed = result.cruiseSpeed + (result.maxSpeed - result.cruiseSpeed) * scale;
        result.maxSpeed = Math.max(TRAIT_RANGES.maxSpeed.min, result.maxSpeed);
    }

    if (ratio < EXHAUSTION_TURN_ACCEL_THRESHOLD) {
        result.turnAccel = Math.max(
            TRAIT_RANGES.turnAccel.min,
            result.turnAccel * 0.75,
        );
    }

    return result;
}

/**
 * Computes the cornering force margin for the current state.
 *
 * @remarks
 * Positive = within comfort zone (no drain). Negative = draining stamina.
 * Useful as an observation for the RL agent.
 *
 * @param corneringGrip - Horse's effective cornering grip
 * @param currentSpeed - Tangential velocity
 * @param turnRadius - Current turn radius
 * @returns Force margin (tolerated - required)
 *
 * @group Stamina
 */
export function corneringForceMargin(
    corneringGrip: number,
    currentSpeed: number,
    turnRadius: number,
): number {
    if (turnRadius >= 1e6) return Infinity; // straights always comfortable
    const required = (currentSpeed * currentSpeed) / turnRadius;
    const tolerated = corneringGrip * GRIP_FORCE_BASELINE;
    return tolerated - required;
}
