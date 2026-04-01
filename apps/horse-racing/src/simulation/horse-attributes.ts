import type { HorseGenome } from './horse-genome';
import { expressCoreTrait, expressModifier } from './horse-genome';
import type { RaceContext, ModifierDefinition } from './modifiers';
import { MODIFIER_REGISTRY } from './modifiers';

// ---------------------------------------------------------------------------
// Core trait names & ranges
// ---------------------------------------------------------------------------

/**
 * Names of the 8 core attributes that the simulation engine reads per horse.
 *
 * @group Attributes
 */
export type CoreTraitName =
    | 'cruiseSpeed'
    | 'maxSpeed'
    | 'forwardAccel'
    | 'turnAccel'
    | 'corneringGrip'
    | 'stamina'
    | 'staminaRecovery'
    | 'weight'
    | 'pushingPower'
    | 'pushResistance';

/**
 * Min/max range for each core trait.
 *
 * @group Attributes
 */
export const TRAIT_RANGES: Record<CoreTraitName, { min: number; max: number }> = {
    cruiseSpeed:     { min: 12,  max: 16.5 },
    maxSpeed:        { min: 16,  max: 20 },
    forwardAccel:    { min: 0.5, max: 1.5 },
    turnAccel:       { min: 0.5, max: 1.5 },
    corneringGrip:   { min: 0.5, max: 1.5 },
    stamina:         { min: 50,  max: 150 },
    staminaRecovery: { min: 0.5, max: 2.0 },
    weight:          { min: 430, max: 550 },
    pushingPower:    { min: 0,   max: 1.0 },
    pushResistance:  { min: 0,   max: 1.0 },
};

/** All core trait names as an array for iteration. */
export const CORE_TRAIT_NAMES: CoreTraitName[] = [
    'cruiseSpeed', 'maxSpeed', 'forwardAccel', 'turnAccel',
    'corneringGrip', 'stamina', 'staminaRecovery', 'weight',
    'pushingPower', 'pushResistance',
];

// ---------------------------------------------------------------------------
// Attribute types
// ---------------------------------------------------------------------------

/**
 * Base attribute values for a horse, derived from its genome.
 * These are static for the horse's lifetime.
 *
 * @group Attributes
 */
export type CoreAttributes = {
    cruiseSpeed: number;
    maxSpeed: number;
    forwardAccel: number;
    turnAccel: number;
    corneringGrip: number;
    stamina: number;
    staminaRecovery: number;
    weight: number;
    pushingPower: number;
    pushResistance: number;
};

/**
 * Same shape as {@link CoreAttributes} but with modifier effects applied.
 * This is what the engine reads each tick.
 *
 * @group Attributes
 */
export type EffectiveAttributes = CoreAttributes;

/**
 * A modifier that is active on a horse, with its genetic strength.
 *
 * @group Attributes
 */
export type ActiveModifier = {
    id: string;
    strength: number; // [0, 1]
};

// ---------------------------------------------------------------------------
// Expression: Genome → Base Attributes
// ---------------------------------------------------------------------------

/**
 * Expresses a genome into base core attributes.
 *
 * @param genome - The horse's genome
 * @returns Static core attribute values
 *
 * @group Attributes
 */
export function expressGenome(genome: HorseGenome): CoreAttributes {
    const attrs = {} as Record<CoreTraitName, number>;
    const defaultGene = { sire: 0.5, dam: 0.5 };
    for (const trait of CORE_TRAIT_NAMES) {
        const range = TRAIT_RANGES[trait];
        const gene = genome.core[trait] ?? defaultGene;
        attrs[trait] = expressCoreTrait(gene, range.min, range.max);
    }
    return attrs as CoreAttributes;
}

/**
 * Determines which modifiers a horse has (from its genome) and their strengths.
 *
 * @param genome - The horse's genome
 * @returns Array of active modifiers with strengths
 *
 * @group Attributes
 */
export function expressModifiers(genome: HorseGenome): ActiveModifier[] {
    const active: ActiveModifier[] = [];
    for (const [id, genes] of Object.entries(genome.modifiers)) {
        const result = expressModifier(genes.presence, genes.strength);
        if (result) {
            active.push({ id, strength: result.strength });
        }
    }
    return active;
}

// ---------------------------------------------------------------------------
// Modifier resolution: Base + Modifiers → Effective
// ---------------------------------------------------------------------------

/**
 * Resolves effective attributes from base attributes and active modifiers.
 *
 * @remarks
 * Resolution order: `effective = clamp((base + Σ flat) × (1 + Σ pct), min, max)`
 *
 * Only modifiers whose conditions are met (given the current race context)
 * contribute to the result.
 *
 * @param base - The horse's base attributes (from genome expression)
 * @param activeModifiers - Modifiers this horse has (from genome)
 * @param ctx - Current race state for evaluating conditions
 * @param horseIndex - Index of this horse in the race
 * @returns Effective attributes for this tick
 *
 * @group Attributes
 */
export function resolveEffectiveAttributes(
    base: CoreAttributes,
    activeModifiers: ActiveModifier[],
    ctx: RaceContext,
    horseIndex: number,
): EffectiveAttributes {
    // Accumulate flat and percentage bonuses per trait
    const flatBonuses: Record<string, number> = {};
    const pctBonuses: Record<string, number> = {};

    for (const trait of CORE_TRAIT_NAMES) {
        flatBonuses[trait] = 0;
        pctBonuses[trait] = 0;
    }

    for (const mod of activeModifiers) {
        const defn: ModifierDefinition | undefined = MODIFIER_REGISTRY[mod.id];
        if (!defn) continue;

        // Check condition
        if (!defn.condition(ctx, horseIndex)) continue;

        // Apply effects scaled by modifier strength
        for (const effect of defn.effects) {
            if (effect.flat !== undefined) {
                flatBonuses[effect.target] += effect.flat * mod.strength;
            }
            if (effect.pct !== undefined) {
                pctBonuses[effect.target] += effect.pct * mod.strength;
            }
        }
    }

    // Resolve: (base + flat) × (1 + pct), clamped
    const result = {} as Record<CoreTraitName, number>;
    for (const trait of CORE_TRAIT_NAMES) {
        const baseVal = base[trait];
        const range = TRAIT_RANGES[trait];
        const effective = (baseVal + flatBonuses[trait]) * (1 + pctBonuses[trait]);
        result[trait] = Math.max(range.min, Math.min(range.max, effective));
    }

    return result as EffectiveAttributes;
}

/**
 * Returns the set of modifier IDs whose conditions are met this tick.
 *
 * @param activeModifiers - Modifiers this horse has (from genome)
 * @param ctx - Current race state for evaluating conditions
 * @param horseIndex - Index of this horse in the race
 * @returns Set of modifier ID strings that are active this tick
 *
 * @group Attributes
 */
export function evaluateModifierConditions(
    activeModifiers: ActiveModifier[],
    ctx: RaceContext,
    horseIndex: number,
): Set<string> {
    const fired = new Set<string>();
    for (const mod of activeModifiers) {
        const defn: ModifierDefinition | undefined = MODIFIER_REGISTRY[mod.id];
        if (!defn) continue;
        if (defn.condition(ctx, horseIndex)) {
            fired.add(mod.id);
        }
    }
    return fired;
}

// ---------------------------------------------------------------------------
// Default attributes (for backwards compatibility / testing)
// ---------------------------------------------------------------------------

/**
 * Default core attributes matching the original global simulation constants.
 *
 * @group Attributes
 */
export const DEFAULT_CORE_ATTRIBUTES: CoreAttributes = {
    cruiseSpeed: 14.25,
    maxSpeed: 18,
    forwardAccel: 1.0,
    turnAccel: 1.0,
    corneringGrip: 1.0,
    stamina: 100,
    staminaRecovery: 1.0,
    weight: 490,
    pushingPower: 0.5,
    pushResistance: 0.5,
};
