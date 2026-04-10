import type { EffectiveAttributes } from './horse-attributes';
import { TRAIT_RANGES } from './horse-attributes';

// ---------------------------------------------------------------------------
// Stamina constants (no recovery — fixed pool, drain only)
// ---------------------------------------------------------------------------

/** Stamina drain per unit of extra tangential acceleration per tick. */
export const STAMINA_DRAIN_RATE = 0.01; // reverted from 0.03

/** Stamina drain per (speed - cruise)² per tick (quadratic). */
export const OVERDRIVE_DRAIN_RATE = 0.002;

/** Stamina drain per unit of excess cornering force per tick. */
export const CORNERING_DRAIN_RATE = 0.002; // was 0.02

/** Distance tax — drain per m/s of forward speed per tick. */
export const SPEED_DRAIN_RATE = 0.0014; // was 0.014

/** Stamina drain per unit of extra lateral steering per tick. */
export const LATERAL_STEERING_DRAIN_RATE = 0.006;

/** Stamina drain per m/s of sustained lateral velocity per tick. */
export const LATERAL_VELOCITY_DRAIN_RATE = 0.0008;

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
const EXHAUSTION_TURN_ACCEL_THRESHOLD = 0.25; // was 0.15
const EXHAUSTION_CRUISE_SPEED_THRESHOLD = 0.20;

// ---------------------------------------------------------------------------
// Stamina update
// ---------------------------------------------------------------------------

/**
 * Computes stamina drain for a single tick and returns the new stamina value.
 *
 * Fixed pool — no recovery. All drain is multiplied by the horse's
 * drainRateMult attribute (lower = more efficient).
 *
 * @param currentStamina - Current stamina level
 * @param eff - Effective attributes (after modifiers, before exhaustion)
 * @param extraTangential - Actual tangential acceleration from jockey push
 *                          (raw input × forwardAccel, matching Python)
 * @param extraNormal - Actual lateral acceleration from jockey steering
 *                      (raw input × turnAccel, matching Python)
 * @param currentSpeed - Horse's velocity magnitude (for overdrive check)
 * @param tangentialVel - Horse's tangential velocity (for cornering force)
 * @param normalVel - Horse's lateral velocity (for lateral drift drain)
 * @param turnRadius - Current turn radius (Infinity on straights)
 * @returns Updated stamina value
 *
 * @group Stamina
 */
export function updateStamina(
    currentStamina: number,
    eff: EffectiveAttributes,
    extraTangential: number,
    extraNormal: number,
    currentSpeed: number,
    tangentialVel: number,
    normalVel: number,
    turnRadius: number,
): number {
    let drain = 0;

    // Drain from jockey pushing forward — capped at the force needed to
    // sustain max speed. Excess action beyond what produces useful
    // acceleration doesn't cost extra stamina.
    // extraTangential is already action × forwardAccel, so the useful
    // cap is (maxSpeed - cruiseSpeed) which is the spring deficit at max.
    if (extraTangential > 0) {
        const maxUseful = Math.max(eff.maxSpeed - eff.cruiseSpeed, 0);
        const cappedTangential = Math.min(extraTangential, maxUseful);
        drain += cappedTangential * STAMINA_DRAIN_RATE;
    }

    // Drain from jockey steering laterally
    if (Math.abs(extraNormal) > 0) {
        drain += Math.abs(extraNormal) * LATERAL_STEERING_DRAIN_RATE;
    }

    // Drain from exceeding cruise speed (quadratic — small pushes cheap, big pushes expensive)
    if (currentSpeed > eff.cruiseSpeed) {
        const overdrive = currentSpeed - eff.cruiseSpeed;
        drain += overdrive * overdrive * OVERDRIVE_DRAIN_RATE;
    }

    // Drain from cornering beyond grip threshold (uses tangential velocity)
    if (turnRadius < 1e6) {
        const requiredForce = (tangentialVel * tangentialVel) / turnRadius;
        const toleratedForce = eff.corneringGrip * GRIP_FORCE_BASELINE;
        if (requiredForce > toleratedForce) {
            drain += (requiredForce - toleratedForce) * CORNERING_DRAIN_RATE;
        }
    }

    // Distance tax — every meter traveled costs stamina
    drain += currentSpeed * SPEED_DRAIN_RATE;

    // Lateral velocity tax — sustained sideways movement costs stamina
    drain += Math.abs(normalVel) * LATERAL_VELOCITY_DRAIN_RATE;

    // Apply per-horse drain efficiency
    drain *= eff.drainRateMult;

    return Math.max(0, currentStamina - drain);
}

/**
 * Applies exhaustion penalties to effective attributes based on current
 * stamina level.
 *
 * @remarks
 * This produces the final effective attributes used by the engine.
 * Exhaustion causes gradual degradation:
 * - Below 30% stamina: `forwardAccel` scales down proportionally
 * - Below 25% stamina: `turnAccel` scales progressively (100% → 50%)
 * - Below 20% stamina: `maxSpeed` drops toward `cruiseSpeed`
 * - Below 20% stamina: `cruiseSpeed` drops to 75% at 0%
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
        // Progressive: 100% at 25% stamina → 50% at 0% stamina
        const scale = 0.5 + 0.5 * (ratio / EXHAUSTION_TURN_ACCEL_THRESHOLD);
        result.turnAccel = Math.max(
            TRAIT_RANGES.turnAccel.min,
            result.turnAccel * scale,
        );
    }

    // Cruise speed degrades when nearly empty — depleted horses slow
    // below cruise, making pacing a real advantage over full throttle.
    // 20% → 100%, 0% → 75% of base cruise speed.
    if (ratio < EXHAUSTION_CRUISE_SPEED_THRESHOLD) {
        const cruiseMult = 0.75 + 0.25 * (ratio / EXHAUSTION_CRUISE_SPEED_THRESHOLD);
        result.cruiseSpeed = Math.max(
            TRAIT_RANGES.maxSpeed.min,
            result.cruiseSpeed * cruiseMult,
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
