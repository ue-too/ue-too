import {
    expressGene,
    expressCoreTrait,
    expressModifier,
    breedGene,
    breedGenome,
    uniformGene,
    generateDefaultGenome,
    generateRandomGenome,
} from '../src/simulation/horse-genome';
import type { Gene } from '../src/simulation/horse-genome';

describe('expressGene', () => {
    it('averages both alleles', () => {
        expect(expressGene({ sire: 0.8, dam: 0.4 })).toBeCloseTo(0.6);
        expect(expressGene({ sire: 1.0, dam: 0.0 })).toBeCloseTo(0.5);
        expect(expressGene({ sire: 0.0, dam: 0.0 })).toBeCloseTo(0.0);
        expect(expressGene({ sire: 1.0, dam: 1.0 })).toBeCloseTo(1.0);
    });
});

describe('expressCoreTrait', () => {
    it('maps gene expression to trait range', () => {
        // Gene value 0.5 → midpoint of range
        expect(expressCoreTrait({ sire: 0.5, dam: 0.5 }, 8, 18)).toBeCloseTo(13);
        // Gene value 0.0 → min
        expect(expressCoreTrait({ sire: 0, dam: 0 }, 8, 18)).toBeCloseTo(8);
        // Gene value 1.0 → max
        expect(expressCoreTrait({ sire: 1, dam: 1 }, 8, 18)).toBeCloseTo(18);
    });
});

describe('expressModifier', () => {
    it('returns null when both alleles below threshold', () => {
        const presence: Gene = { sire: 0.1, dam: 0.2 };
        const strength: Gene = { sire: 0.8, dam: 0.8 };
        expect(expressModifier(presence, strength)).toBeNull();
    });

    it('expresses when either allele exceeds threshold', () => {
        const presence: Gene = { sire: 0.6, dam: 0.1 };
        const strength: Gene = { sire: 0.8, dam: 0.4 };
        const result = expressModifier(presence, strength);
        expect(result).not.toBeNull();
        expect(result!.strength).toBeCloseTo(0.6);
    });

    it('expresses when both alleles exceed threshold', () => {
        const presence: Gene = { sire: 0.9, dam: 0.7 };
        const strength: Gene = { sire: 1.0, dam: 1.0 };
        const result = expressModifier(presence, strength);
        expect(result).not.toBeNull();
        expect(result!.strength).toBeCloseTo(1.0);
    });
});

describe('breedGene', () => {
    it('offspring alleles come from parents', () => {
        const sireGene: Gene = { sire: 0.2, dam: 0.8 };
        const damGene: Gene = { sire: 0.3, dam: 0.7 };

        // Use deterministic rng with no mutation
        let callIdx = 0;
        const rng = () => {
            // Alternate: 0.3 picks sire's sire, 0.3 picks dam's sire
            return [0.3, 0.3, 1.0, 1.0, 1.0, 1.0][callIdx++] ?? 0.99;
        };
        const child = breedGene(sireGene, damGene, 0, rng);
        expect(child.sire).toBe(0.2); // from sireGene.sire
        expect(child.dam).toBe(0.3);  // from damGene.sire
    });

    it('mutation can perturb alleles', () => {
        const gene: Gene = { sire: 0.5, dam: 0.5 };
        // Force mutation: rng returns 0.3 (picks sire), 0.3 (picks sire),
        // then 0.01 (triggers mutation), 0.5 (no perturbation)
        let callIdx = 0;
        const rng = () => [0.3, 0.3, 0.01, 0.5, 0.01, 0.5][callIdx++] ?? 0.5;
        const child = breedGene(gene, gene, 0.1, rng);
        // Mutation applies (rng() - 0.5) * 0.1 = (0.5 - 0.5) * 0.1 = 0
        expect(child.sire).toBeCloseTo(0.5);
    });
});

describe('breedGenome', () => {
    it('produces a genome with all core traits and modifiers', () => {
        const sire = generateRandomGenome(() => 0.7);
        const dam = generateRandomGenome(() => 0.3);
        const child = breedGenome(sire, dam, 0);

        expect(child.core.cruiseSpeed).toBeDefined();
        expect(child.core.maxSpeed).toBeDefined();
        expect(child.core.stamina).toBeDefined();
        expect(Object.keys(child.modifiers).length).toBeGreaterThan(0);
    });
});

describe('uniformGene', () => {
    it('creates a gene with identical alleles', () => {
        const g = uniformGene(0.75);
        expect(g.sire).toBe(0.75);
        expect(g.dam).toBe(0.75);
    });
});

describe('generateDefaultGenome', () => {
    it('has midpoint alleles for all core traits', () => {
        const genome = generateDefaultGenome();
        for (const gene of Object.values(genome.core)) {
            expect(gene.sire).toBe(0.5);
            expect(gene.dam).toBe(0.5);
        }
    });

    it('has expressed modifiers at midpoint strength', () => {
        const genome = generateDefaultGenome();
        for (const mod of Object.values(genome.modifiers)) {
            expect(mod.presence.sire).toBe(0.5);
            expect(mod.presence.dam).toBe(0.5);
        }
    });
});

describe('generateRandomGenome', () => {
    it('produces alleles in [0, 1]', () => {
        const genome = generateRandomGenome();
        for (const gene of Object.values(genome.core)) {
            expect(gene.sire).toBeGreaterThanOrEqual(0);
            expect(gene.sire).toBeLessThanOrEqual(1);
            expect(gene.dam).toBeGreaterThanOrEqual(0);
            expect(gene.dam).toBeLessThanOrEqual(1);
        }
    });

    it('is deterministic with fixed rng', () => {
        let seed = 0.42;
        const rng1 = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        seed = 0.42;
        const genome1 = generateRandomGenome(rng1);

        seed = 0.42;
        const rng2 = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        seed = 0.42;
        const genome2 = generateRandomGenome(rng2);

        expect(genome1.core.cruiseSpeed.sire).toBe(genome2.core.cruiseSpeed.sire);
    });
});
