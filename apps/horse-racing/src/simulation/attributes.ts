export interface CoreAttributes {
    cruiseSpeed: number;
    maxSpeed: number;
    forwardAccel: number;
    turnAccel: number;
    corneringGrip: number;
    maxStamina: number;
    drainRateMult: number;
    weight: number;
}

export const TRAIT_RANGES: Record<keyof CoreAttributes, [min: number, max: number]> = {
    cruiseSpeed: [8, 18],
    maxSpeed: [15, 25],
    forwardAccel: [0.5, 1.5],
    turnAccel: [0.5, 1.5],
    corneringGrip: [0.5, 1.5],
    maxStamina: [50, 150],
    drainRateMult: [0.7, 1.3],
    weight: [400, 600],
};

/** Base tangential force cap in m/s^2 (scaled by forwardAccel). */
export const F_T_MAX = 5;
/** Base normal force cap in m/s^2 (scaled by turnAccel). */
export const F_N_MAX = 3;

export function createDefaultAttributes(): CoreAttributes {
    return {
        cruiseSpeed: 13,
        maxSpeed: 20,
        forwardAccel: 1.0,
        turnAccel: 1.0,
        corneringGrip: 1.0,
        maxStamina: 100,
        drainRateMult: 1.0,
        weight: 500,
    };
}

/**
 * Sample attributes in TRAIT_RANGES for batch tuning (deterministic if `rng` is).
 * Weight stays at 500 so the physics world mass stays consistent with spawn.
 */
export function createRandomizedAttributes(rng: () => number): CoreAttributes {
    const r = (range: [number, number]): number =>
        range[0] + rng() * (range[1] - range[0]);
    return {
        cruiseSpeed: r(TRAIT_RANGES.cruiseSpeed),
        maxSpeed: r(TRAIT_RANGES.maxSpeed),
        forwardAccel: r(TRAIT_RANGES.forwardAccel),
        turnAccel: r(TRAIT_RANGES.turnAccel),
        corneringGrip: r(TRAIT_RANGES.corneringGrip),
        maxStamina: r(TRAIT_RANGES.maxStamina),
        drainRateMult: r(TRAIT_RANGES.drainRateMult),
        weight: 500,
    };
}
