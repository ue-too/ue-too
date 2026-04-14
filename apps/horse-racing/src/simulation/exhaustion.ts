import type { CoreAttributes } from './attributes';
import type { Horse } from './types';

/** Sigmoid knee point — degradation accelerates below this stamina %. */
export const KNEE = 0.10;
/** Minimum stat ratio at 0 stamina — enough for a weak kick. */
export const FLOOR = 0.45;
/** Steepness of the sigmoid transition. */
export const K = 10;

/** Max speed degrades faster — push ceiling shrinks before cruise does. */
export const MAX_SPEED_KNEE = 0.25;
export const MAX_SPEED_FLOOR = 0.40;
export const MAX_SPEED_K = 10;

/**
 * Map stamina percentage (0-1) to stat multiplier (floor-1.0).
 *
 * Uses a sigmoid curve centered on `knee`:
 * - Above knee: stats degrade gently
 * - Below knee: stats drop steeply
 * - At 0 stamina: stats bottom out at `floor`
 */
export function effectiveRatio(
    staminaPct: number,
    knee = KNEE,
    floor = FLOOR,
    k = K,
): number {
    const raw = 1 / (1 + Math.exp(-k * (staminaPct - knee)));
    const sigAt1 = 1 / (1 + Math.exp(-k * (1 - knee)));
    const sigAt0 = 1 / (1 + Math.exp(-k * (0 - knee)));
    const normalized = (raw - sigAt0) / (sigAt1 - sigAt0);
    return floor + (1 - floor) * normalized;
}

/**
 * Compute effective attributes based on current stamina level.
 *
 * max_speed uses an aggressive curve so the push ceiling shrinks
 * faster than cruise — the late-race "kick" comes from holding pace
 * while exhausted opponents fade, not from supernatural acceleration.
 */
export function applyExhaustion(horse: Horse): CoreAttributes {
    const base = horse.baseAttributes;
    const staminaPct = base.maxStamina > 0
        ? Math.max(0, Math.min(1, horse.currentStamina / base.maxStamina))
        : 0;
    const ratio = effectiveRatio(staminaPct);
    const maxSpeedRatio = effectiveRatio(staminaPct, MAX_SPEED_KNEE, MAX_SPEED_FLOOR, MAX_SPEED_K);
    return {
        ...base,
        cruiseSpeed: base.cruiseSpeed * ratio,
        maxSpeed: base.maxSpeed * maxSpeedRatio,
        forwardAccel: base.forwardAccel * ratio,
        turnAccel: base.turnAccel * ratio,
    };
}
