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
