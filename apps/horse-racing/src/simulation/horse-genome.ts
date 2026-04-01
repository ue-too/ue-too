import type { CoreTraitName } from './horse-attributes';
import { MODIFIER_IDS } from './modifiers';

// ---------------------------------------------------------------------------
// Gene / Allele primitives
// ---------------------------------------------------------------------------

/**
 * A single allele value in the range [0, 1].
 *
 * @group Genetics
 */
export type Allele = number;

/**
 * A gene with two alleles — one inherited from the sire, one from the dam.
 *
 * @group Genetics
 */
export type Gene = {
    sire: Allele;
    dam: Allele;
};

// ---------------------------------------------------------------------------
// Genome
// ---------------------------------------------------------------------------

/**
 * Complete genetic blueprint for a horse.
 *
 * @remarks
 * Core genes map 1:1 to {@link CoreTraitName}. Each modifier has a presence
 * gene (determines if the trait is expressed) and a strength gene (scales the
 * effect magnitude).
 *
 * @group Genetics
 */
export type HorseGenome = {
    /** One gene per core attribute. */
    core: Record<CoreTraitName, Gene>;
    /** Presence + strength gene pairs keyed by modifier id. */
    modifiers: Record<string, { presence: Gene; strength: Gene }>;
};

// ---------------------------------------------------------------------------
// Expression
// ---------------------------------------------------------------------------

/** Presence threshold — modifier is expressed if max allele ≥ this value. */
const MODIFIER_PRESENCE_THRESHOLD = 0.4;

/**
 * Blending expression: averages both alleles to produce a value in [0, 1].
 *
 * @param gene - The gene to express
 * @returns A value in [0, 1] representing the expressed phenotype
 *
 * @group Genetics
 */
export function expressGene(gene: Gene): number {
    return gene.sire * 0.5 + gene.dam * 0.5;
}

/**
 * Expresses a core trait gene into a concrete value within the given range.
 *
 * @param gene - The gene to express
 * @param min - Minimum trait value
 * @param max - Maximum trait value
 * @returns A value in [min, max]
 *
 * @group Genetics
 */
export function expressCoreTrait(gene: Gene, min: number, max: number): number {
    return min + expressGene(gene) * (max - min);
}

/**
 * Determines if a modifier trait is expressed and its strength.
 *
 * @remarks
 * A modifier is present if either allele of the presence gene exceeds
 * the threshold (partially dominant). Strength is blended from both alleles.
 *
 * @param presenceGene - Gene controlling whether the modifier is expressed
 * @param strengthGene - Gene controlling the effect magnitude
 * @returns `null` if not expressed, otherwise `{ strength }` in [0, 1]
 *
 * @group Genetics
 */
export function expressModifier(
    presenceGene: Gene,
    strengthGene: Gene,
): { strength: number } | null {
    const presenceValue = Math.max(presenceGene.sire, presenceGene.dam);
    if (presenceValue < MODIFIER_PRESENCE_THRESHOLD) return null;
    const strength = expressGene(strengthGene);
    return { strength };
}

// ---------------------------------------------------------------------------
// Breeding
// ---------------------------------------------------------------------------

/**
 * Breeds a new gene from two parent genes.
 *
 * @remarks
 * Each parent donates one allele (randomly chosen from their two).
 * A small mutation may perturb the donated allele.
 *
 * @param sireGene - Father's gene
 * @param damGene - Mother's gene
 * @param mutationRate - Probability of mutation per allele (default 0.05)
 * @param rng - Optional random function for deterministic testing
 * @returns A new gene for the offspring
 *
 * @group Genetics
 */
export function breedGene(
    sireGene: Gene,
    damGene: Gene,
    mutationRate = 0.05,
    rng: () => number = Math.random,
): Gene {
    const fromSire = rng() < 0.5 ? sireGene.sire : sireGene.dam;
    const fromDam = rng() < 0.5 ? damGene.sire : damGene.dam;

    const mutate = (v: number): number => {
        if (rng() < mutationRate) {
            return Math.max(0, Math.min(1, v + (rng() - 0.5) * 0.1));
        }
        return v;
    };

    return { sire: mutate(fromSire), dam: mutate(fromDam) };
}

/**
 * Breeds a full offspring genome from two parent genomes.
 *
 * @param sire - Father's genome
 * @param dam - Mother's genome
 * @param mutationRate - Probability of mutation per allele
 * @param rng - Optional random function for deterministic testing
 * @returns A new genome for the offspring
 *
 * @group Genetics
 */
export function breedGenome(
    sire: HorseGenome,
    dam: HorseGenome,
    mutationRate = 0.05,
    rng: () => number = Math.random,
): HorseGenome {
    const core = {} as Record<CoreTraitName, Gene>;
    for (const trait of Object.keys(sire.core) as CoreTraitName[]) {
        core[trait] = breedGene(sire.core[trait], dam.core[trait], mutationRate, rng);
    }

    const modifiers: Record<string, { presence: Gene; strength: Gene }> = {};
    for (const id of MODIFIER_IDS) {
        const sireM = sire.modifiers[id];
        const damM = dam.modifiers[id];
        if (sireM && damM) {
            modifiers[id] = {
                presence: breedGene(sireM.presence, damM.presence, mutationRate, rng),
                strength: breedGene(sireM.strength, damM.strength, mutationRate, rng),
            };
        } else {
            // If a parent lacks this modifier gene, use a zero gene
            const zero: Gene = { sire: 0, dam: 0 };
            modifiers[id] = {
                presence: breedGene(sireM?.presence ?? zero, damM?.presence ?? zero, mutationRate, rng),
                strength: breedGene(sireM?.strength ?? zero, damM?.strength ?? zero, mutationRate, rng),
            };
        }
    }

    return { core, modifiers };
}

// ---------------------------------------------------------------------------
// Genome generators
// ---------------------------------------------------------------------------

/**
 * Creates a gene with both alleles set to the same value.
 *
 * @group Genetics
 */
export function uniformGene(value: number): Gene {
    return { sire: value, dam: value };
}

/**
 * Generates a default genome where all core traits express at the midpoint
 * of their range and no modifiers are present.
 *
 * @group Genetics
 */
export function generateDefaultGenome(): HorseGenome {
    const core = {} as Record<CoreTraitName, Gene>;
    const traits: CoreTraitName[] = [
        'cruiseSpeed', 'maxSpeed', 'forwardAccel', 'turnAccel',
        'corneringGrip', 'stamina', 'staminaRecovery', 'weight',
        'pushingPower', 'pushResistance',
    ];
    for (const t of traits) {
        core[t] = uniformGene(0.5); // midpoint of range
    }

    const modifiers: Record<string, { presence: Gene; strength: Gene }> = {};
    for (const id of MODIFIER_IDS) {
        modifiers[id] = {
            presence: uniformGene(0.5), // expressed (above 0.4 threshold)
            strength: uniformGene(0.5),
        };
    }

    return { core, modifiers };
}

/**
 * Generates a random genome with varied trait alleles.
 * Produces horses with distinct physical characteristics.
 *
 * @param rng - Optional random function for deterministic testing
 *
 * @group Genetics
 */
export function generateRandomGenome(rng: () => number = Math.random): HorseGenome {
    const randomGene = (): Gene => ({ sire: rng(), dam: rng() });

    const core = {} as Record<CoreTraitName, Gene>;
    const traits: CoreTraitName[] = [
        'cruiseSpeed', 'maxSpeed', 'forwardAccel', 'turnAccel',
        'corneringGrip', 'stamina', 'staminaRecovery', 'weight',
        'pushingPower', 'pushResistance',
    ];
    for (const t of traits) {
        core[t] = randomGene();
    }

    const modifiers: Record<string, { presence: Gene; strength: Gene }> = {};
    for (const id of MODIFIER_IDS) {
        modifiers[id] = {
            presence: randomGene(),
            strength: randomGene(),
        };
    }

    return { core, modifiers };
}
