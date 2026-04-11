import type { CoreAttributes, EffectiveAttributes } from './horse-attributes';

// ---------------------------------------------------------------------------
// Physics constants — redesigned stamina system.
//
// Two pools per horse:
//   * aerobic (state.currentStamina) — main fuel, slowly drained by speed
//   * burst   (state.burstPool)       — small reserve for late kicks
//
// Mechanics layered together (validated in the Python probe):
//   A. Lead penalty: frontmost horse pays extra aerobic drain proportional to
//      (speed - cruise), scaled non-linearly by stamina. Stayers get cubic relief.
//   B. Draft recovery: horses within DRAFT_DISTANCE behind another horse AND
//      at/near cruise recover aerobic at a rate scaled by drainRateMult.
//   C. Burst pool: separate reserve sized as
//      BURST_K × (max - cruise) × stamina/100. Drains on excess², refills when
//      speed < cruise - 0.5. Max speed clamps to cruise + 0.5 when empty.
//   D. Distance tax raised so cruising actually depletes without draft recovery.
//   E. Cliff collapse: at ≤5% aerobic, cruise drops to 40% and max drops to
//      cruise + 0.5 in a single tick (no gradual lerp).
//
// The drafting modifier in modifiers.ts is intentionally empty — drafting now
// provides aerobic recovery, not raw speed.
// ---------------------------------------------------------------------------

/** Stamina drain per unit of extra tangential acceleration per tick. */
export const STAMINA_DRAIN_RATE = 0.01;

/** Distance tax — drain per m/s of forward speed per tick (3× legacy). */
export const SPEED_DRAIN_RATE = 0.0042;

/** Stamina drain per unit of excess cornering force per tick. */
export const CORNERING_DRAIN_RATE = 0.002;

/**
 * Base cornering force tolerance, multiplied by `corneringGrip`.
 *
 * @remarks
 * If the required centripetal force (`tangentialVel² / turnRadius`) exceeds
 * `corneringGrip × GRIP_FORCE_BASELINE`, the excess drains stamina.
 */
export const GRIP_FORCE_BASELINE = 150.0;

/** Stamina drain per unit of extra lateral steering per tick. */
export const LATERAL_STEERING_DRAIN_RATE = 0.006;

/** Stamina drain per m/s of sustained lateral velocity per tick. */
export const LATERAL_VELOCITY_DRAIN_RATE = 0.0008;

// A. Lead penalty
export const LEAD_K = 0.025;
export const LEAD_STAMINA_REF = 100.0;
export const LEAD_STAMINA_EXP = 2.5;

// B. Draft recovery
export const DRAFT_DISTANCE = 15.0;
export const DRAFT_RECOVERY_K = 0.04;
export const DRAFT_RECOVERY_CRUISE_BUFFER = 0.5;

// C. Burst pool
export const BURST_K = 2.5;
export const BURST_DRAIN_K = 0.10;
export const BURST_RECOVERY_K = 0.015;
export const BURST_EMPTY_CLAMP = 0.5;

// E. Cliff collapse
export const CLIFF_THRESHOLD = 0.05;
export const CLIFF_CRUISE_MULT = 0.40;
export const CLIFF_ACCEL_MULT = 0.20;

// ---------------------------------------------------------------------------
// Per-horse runtime stamina state
// ---------------------------------------------------------------------------

/**
 * Mutable runtime stamina state for a single horse.
 *
 * @remarks
 * The engine populates `isFrontmost` and `isDrafting` each tick before calling
 * {@link updateStamina}. `burstPool` and `burstMax` must be initialized via
 * {@link computeBurstMax} when the horse is created.
 *
 * @group Stamina
 */
export type HorseStaminaState = {
    /** Aerobic pool — main fuel. */
    currentStamina: number;
    /** Base attributes (used for the recovery cap). */
    baseAttributes: CoreAttributes;
    /** Burst pool — kick reserve, separate from aerobic stamina. */
    burstPool: number;
    /** Burst pool size for this horse. */
    burstMax: number;
    /** Race-context flag: is this horse leading the field? Engine writes each tick. */
    isFrontmost: boolean;
    /** Race-context flag: is this horse drafting another? Engine writes each tick. */
    isDrafting: boolean;
};

/**
 * Burst pool size from a horse's attributes (band × stamina × BURST_K).
 *
 * @group Stamina
 */
export function computeBurstMax(attrs: CoreAttributes): number {
    const band = Math.max(0.1, attrs.maxSpeed - attrs.cruiseSpeed);
    return BURST_K * band * (attrs.stamina / 100.0);
}

// ---------------------------------------------------------------------------
// Stamina update
// ---------------------------------------------------------------------------

/**
 * Updates aerobic + burst stamina for a single tick.
 *
 * @remarks
 * Mutates `state.currentStamina` and `state.burstPool` in place. The engine
 * must populate `state.isFrontmost` and `state.isDrafting` before calling.
 * Returns the new aerobic value for convenience.
 *
 * @param state - Per-horse stamina state (mutated in place)
 * @param eff - Effective attributes (after modifiers, before exhaustion)
 * @param extraTangential - Actual tangential acceleration from jockey push
 *                          (raw input × forwardAccel, matching Python)
 * @param extraNormal - Actual lateral acceleration from jockey steering
 *                      (raw input × turnAccel, matching Python)
 * @param currentSpeed - Horse's velocity magnitude
 * @param tangentialVel - Horse's tangential velocity (for cornering force)
 * @param normalVel - Horse's lateral velocity (for lateral drift drain)
 * @param turnRadius - Current turn radius (Infinity on straights)
 * @returns Updated aerobic stamina value
 *
 * @group Stamina
 */
export function updateStamina(
    state: HorseStaminaState,
    eff: EffectiveAttributes,
    extraTangential: number,
    extraNormal: number,
    currentSpeed: number,
    tangentialVel: number,
    normalVel: number,
    turnRadius: number,
): number {
    let drain = 0;

    // Push cost — every unit of forward push costs aerobic, even when speed
    // is already capped at max. This makes "mash the pedal" strictly worse
    // than "push just enough to reach max."
    if (extraTangential > 0) {
        drain += extraTangential * STAMINA_DRAIN_RATE;
    }

    // Lateral steering input
    if (Math.abs(extraNormal) > 0) {
        drain += Math.abs(extraNormal) * LATERAL_STEERING_DRAIN_RATE;
    }

    // Cornering beyond grip
    if (turnRadius < 1e6) {
        const requiredForce = (tangentialVel * tangentialVel) / turnRadius;
        const toleratedForce = eff.corneringGrip * GRIP_FORCE_BASELINE;
        if (requiredForce > toleratedForce) {
            drain += (requiredForce - toleratedForce) * CORNERING_DRAIN_RATE;
        }
    }

    // Distance tax — every meter traveled costs aerobic
    drain += currentSpeed * SPEED_DRAIN_RATE;

    // Lateral drift tax
    drain += Math.abs(normalVel) * LATERAL_VELOCITY_DRAIN_RATE;

    // Per-horse efficiency
    drain *= eff.drainRateMult;

    // Lead penalty — non-linearly scaled by stamina so stayers get cubic relief
    if (state.isFrontmost && currentSpeed > eff.cruiseSpeed) {
        const excess = currentSpeed - eff.cruiseSpeed;
        const stamFactor = Math.pow(LEAD_STAMINA_REF / Math.max(1.0, eff.stamina), LEAD_STAMINA_EXP);
        drain += LEAD_K * excess * stamFactor;
    }

    state.currentStamina = Math.max(0, state.currentStamina - drain);

    // Draft recovery — only when at or near cruise (not while pushing)
    if (
        state.isDrafting &&
        currentSpeed <= eff.cruiseSpeed + DRAFT_RECOVERY_CRUISE_BUFFER
    ) {
        const recovery = DRAFT_RECOVERY_K / Math.max(0.5, eff.drainRateMult);
        const maxAerobic = state.baseAttributes.stamina;
        state.currentStamina = Math.min(maxAerobic, state.currentStamina + recovery);
    }

    // Burst pool dynamics
    if (currentSpeed > eff.cruiseSpeed) {
        const excess = currentSpeed - eff.cruiseSpeed;
        state.burstPool = Math.max(0, state.burstPool - excess * excess * BURST_DRAIN_K);
    } else if (currentSpeed < eff.cruiseSpeed - DRAFT_RECOVERY_CRUISE_BUFFER) {
        state.burstPool = Math.min(state.burstMax, state.burstPool + BURST_RECOVERY_K);
    }

    return state.currentStamina;
}

// ---------------------------------------------------------------------------
// Exhaustion
// ---------------------------------------------------------------------------

/**
 * Cliff collapse + burst-empty clamp.
 *
 * @remarks
 * Replaces the legacy progressive lerps with binary state changes:
 *   * cliff: aerobic ratio ≤ {@link CLIFF_THRESHOLD} → cruise drops to 40%, max
 *     drops to cruise + {@link BURST_EMPTY_CLAMP}, forwardAccel drops to 20%.
 *   * burst clamp: when burstPool ≤ 0, maxSpeed clamps to cruise + 0.5
 *     (no kick available). Only ratchets maxSpeed downward — never upward.
 *
 * @param eff - Effective attributes (after modifier resolution)
 * @param state - Per-horse stamina state (read only)
 * @param maxStamina - Max aerobic stamina (from base attributes)
 * @returns New effective attributes with exhaustion penalties applied
 *
 * @group Stamina
 */
export function applyExhaustion(
    eff: EffectiveAttributes,
    state: HorseStaminaState,
    maxStamina: number,
): EffectiveAttributes {
    if (maxStamina <= 0) return eff;

    const result = { ...eff };

    const ratio = state.currentStamina / maxStamina;
    if (ratio <= CLIFF_THRESHOLD) {
        result.cruiseSpeed = eff.cruiseSpeed * CLIFF_CRUISE_MULT;
        result.maxSpeed = result.cruiseSpeed + BURST_EMPTY_CLAMP;
        result.forwardAccel = eff.forwardAccel * CLIFF_ACCEL_MULT;
        return result;
    }

    if (state.burstPool <= 0) {
        const clamp = eff.cruiseSpeed + BURST_EMPTY_CLAMP;
        if (clamp < result.maxSpeed) {
            result.maxSpeed = clamp;
        }
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
    if (turnRadius >= 1e6) return Infinity;
    const required = (currentSpeed * currentSpeed) / turnRadius;
    const tolerated = corneringGrip * GRIP_FORCE_BASELINE;
    return tolerated - required;
}
