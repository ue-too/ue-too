import type { CoreAttributes } from './attributes';
import type { Horse } from './types';

/**
 * Per-tick decay factor when stamina = 0.
 * At 60 ticks/sec: ~95% of the gap closes in 1 second,
 * effectively at floor by 2 seconds.
 */
export const EXHAUSTION_DECAY = 0.95;

/** Floor: maxSpeed drops to 55% of cruiseSpeed. */
const MAX_SPEED_FLOOR_RATIO = 0.55;
/** Floor: forwardAccel drops to 15% of base. */
const FORWARD_ACCEL_FLOOR_RATIO = 0.15;
/** Floor: turnAccel drops to 30% of base. */
const TURN_ACCEL_FLOOR_RATIO = 0.3;

/**
 * Resolve effective attributes based on stamina state.
 *
 * - Above 0% stamina: returns base attributes (no penalty).
 * - At 0% stamina: exponentially decays effective attributes toward
 *   floor values. Mutates `horse.effectiveAttributes` to track the
 *   decaying state across ticks.
 */
export function applyExhaustion(horse: Horse): CoreAttributes {
    const base = horse.baseAttributes;

    // Above 0: no penalty, snap to base
    if (horse.currentStamina > 0) {
        return { ...base };
    }

    // At 0: decay toward floor values
    const eff = horse.effectiveAttributes;
    const floorMaxSpeed = base.cruiseSpeed * MAX_SPEED_FLOOR_RATIO;
    const floorForwardAccel = base.forwardAccel * FORWARD_ACCEL_FLOOR_RATIO;
    const floorTurnAccel = base.turnAccel * TURN_ACCEL_FLOOR_RATIO;

    return {
        ...base,
        maxSpeed: floorMaxSpeed + (eff.maxSpeed - floorMaxSpeed) * EXHAUSTION_DECAY,
        forwardAccel: floorForwardAccel + (eff.forwardAccel - floorForwardAccel) * EXHAUSTION_DECAY,
        turnAccel: floorTurnAccel + (eff.turnAccel - floorTurnAccel) * EXHAUSTION_DECAY,
    };
}
