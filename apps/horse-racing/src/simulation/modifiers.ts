import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import type { CoreTraitName } from './horse-attributes';

// ---------------------------------------------------------------------------
// Race context (available to modifier conditions)
// ---------------------------------------------------------------------------

/**
 * Snapshot of the race state, built each tick by the engine and passed to
 * modifier condition functions.
 *
 * @group Modifiers
 */
export type RaceContext = {
    /** World-space positions of all horses. */
    positions: Point[];
    /** World-space velocities of all horses. */
    velocities: Point[];
    /** Current stamina level per horse. */
    staminaLevels: number[];
    /** Max stamina per horse (for computing ratios). */
    maxStamina: number[];
    /** Track progress per horse in [0, 1]. */
    trackProgress: number[];
    /** Current track segment type per horse. */
    segmentTypes: ('STRAIGHT' | 'CURVE')[];
    /** Race ranking per horse (1 = first place). */
    rankings: number[];
    /** Total number of horses. */
    totalHorses: number;
    /** Track surface condition. */
    surface: 'dry' | 'wet' | 'heavy';
};

// ---------------------------------------------------------------------------
// Modifier definition types
// ---------------------------------------------------------------------------

/**
 * A single effect that a modifier applies to a core trait.
 *
 * @group Modifiers
 */
export type ModifierEffect = {
    /** Which core trait this effect targets. */
    target: CoreTraitName;
    /** Flat bonus at full strength (added to base before percentage). */
    flat?: number;
    /** Percentage bonus at full strength (applied after flat). */
    pct?: number;
};

/**
 * Definition of a modifier trait.
 *
 * @remarks
 * Each modifier has a condition function that evaluates the current race
 * state, and one or more effects on core traits. The effect magnitudes
 * are at full strength (1.0) — they get scaled by the horse's genetic
 * modifier strength.
 *
 * @group Modifiers
 */
export type ModifierDefinition = {
    id: string;
    /** Human-readable name. */
    name: string;
    /** When does this modifier activate? */
    condition: (ctx: RaceContext, horseIndex: number) => boolean;
    /** Effects at full strength. */
    effects: ModifierEffect[];
};

// ---------------------------------------------------------------------------
// Helper: distance between horses
// ---------------------------------------------------------------------------

function distanceBetween(positions: Point[], a: number, b: number): number {
    return PointCal.magnitude(PointCal.subVector(positions[a], positions[b]));
}

function countNearbyHorses(positions: Point[], horseIndex: number, radius: number): number {
    let count = 0;
    for (let i = 0; i < positions.length; i++) {
        if (i === horseIndex) continue;
        if (distanceBetween(positions, horseIndex, i) <= radius) {
            count++;
        }
    }
    return count;
}

/**
 * Checks if this horse is within `radius` units behind another horse
 * (i.e., there is a horse ahead within that distance).
 */
function isWithinBehindAnother(
    positions: Point[],
    velocities: Point[],
    horseIndex: number,
    radius: number,
): boolean {
    const pos = positions[horseIndex];
    const vel = velocities[horseIndex];
    const speed = PointCal.magnitude(vel);
    if (speed < 0.01) return false;
    const forward = PointCal.unitVector(vel);

    for (let i = 0; i < positions.length; i++) {
        if (i === horseIndex) continue;
        const toOther = PointCal.subVector(positions[i], pos);
        const dist = PointCal.magnitude(toOther);
        if (dist > radius || dist < 1e-6) continue;
        // Normalized dot: cos(angle) between forward and toOther.
        // > 0.5 means roughly ahead (within ~60° cone), matching Python.
        const dot = PointCal.dotProduct(toOther, forward) / dist;
        if (dot > 0.5) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Built-in modifier definitions
// ---------------------------------------------------------------------------

const drafting: ModifierDefinition = {
    id: 'drafting',
    name: 'Drafting',
    condition: (ctx, i) => isWithinBehindAnother(ctx.positions, ctx.velocities, i, 15),
    effects: [{ target: 'cruiseSpeed', pct: 0.08 }], // up to +8% at full strength
};

const packPressure: ModifierDefinition = {
    id: 'packPressure',
    name: 'Pack Pressure',
    condition: (ctx, i) => countNearbyHorses(ctx.positions, i, 20) >= 2,
    effects: [{ target: 'forwardAccel', pct: 0.10 }], // up to +10%
};

const packAnxiety: ModifierDefinition = {
    id: 'packAnxiety',
    name: 'Pack Anxiety',
    condition: (ctx, i) => countNearbyHorses(ctx.positions, i, 10) >= 3,
    effects: [{ target: 'turnAccel', pct: -0.15 }], // up to -15%
};

const frontRunner: ModifierDefinition = {
    id: 'frontRunner',
    name: 'Front Runner',
    condition: (ctx, i) => ctx.rankings[i] === 1,
    effects: [{ target: 'cruiseSpeed', flat: 0.7 }], // up to +0.7 flat
};

const closer: ModifierDefinition = {
    id: 'closer',
    name: 'Closer',
    condition: (ctx, i) => ctx.trackProgress[i] >= 0.75 && ctx.rankings[i] !== 1,
    effects: [{ target: 'maxSpeed', pct: 0.08 }], // up to +8%
};

const mudder: ModifierDefinition = {
    id: 'mudder',
    name: 'Mudder',
    condition: (ctx) => ctx.surface === 'wet' || ctx.surface === 'heavy',
    effects: [{ target: 'corneringGrip', pct: 0.15 }], // up to +15%
};

const gateSpeed: ModifierDefinition = {
    id: 'gateSpeed',
    name: 'Gate Speed',
    condition: (ctx, i) => ctx.trackProgress[i] < 0.10,
    effects: [{ target: 'forwardAccel', pct: 0.25 }], // up to +25%
};

const endurance: ModifierDefinition = {
    id: 'endurance',
    name: 'Endurance',
    condition: (ctx, i) =>
        ctx.maxStamina[i] > 0 && ctx.staminaLevels[i] / ctx.maxStamina[i] < 0.40,
    effects: [{ target: 'staminaRecovery', pct: 0.30 }], // up to +30%
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * All built-in modifier IDs.
 *
 * @group Modifiers
 */
export const MODIFIER_IDS: readonly string[] = [
    'drafting', 'packPressure', 'packAnxiety', 'frontRunner',
    'closer', 'mudder', 'gateSpeed', 'endurance',
] as const;

/**
 * Registry of all built-in modifier definitions, keyed by id.
 *
 * @group Modifiers
 */
export const MODIFIER_REGISTRY: Record<string, ModifierDefinition> = {
    drafting,
    packPressure,
    packAnxiety,
    frontRunner,
    closer,
    mudder,
    gateSpeed,
    endurance,
};
