import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import {
    expressGenome,
    expressModifiers,
    resolveEffectiveAttributes,
    DEFAULT_CORE_ATTRIBUTES,
    TRAIT_RANGES,
    CORE_TRAIT_NAMES,
} from '../src/simulation/horse-attributes';
import type { CoreAttributes, ActiveModifier } from '../src/simulation/horse-attributes';
import type { RaceContext } from '../src/simulation/modifiers';
import {
    generateDefaultGenome,
    generateRandomGenome,
    uniformGene,
} from '../src/simulation/horse-genome';
import type { HorseGenome } from '../src/simulation/horse-genome';
import {
    updateStamina,
    applyExhaustion,
    corneringForceMargin,
    GRIP_FORCE_BASELINE,
} from '../src/simulation/stamina';
import { HorseRacingEngine } from '../src/simulation/horse-racing-engine';
import type { HorseAction } from '../src/simulation/horse-racing-engine';

function loadTrack(name = 'exp_track_8.json') {
    const path = join(__dirname, '../public/tracks', name);
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

function zeroActions(count: number): HorseAction[] {
    return Array.from({ length: count }, () => ({ extraTangential: 0, extraNormal: 0 }));
}

function makeRaceContext(overrides?: Partial<RaceContext>): RaceContext {
    return {
        positions: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }],
        velocities: [{ x: 13, y: 0 }, { x: 13, y: 0 }, { x: 13, y: 0 }, { x: 13, y: 0 }],
        staminaLevels: [100, 100, 100, 100],
        maxStamina: [100, 100, 100, 100],
        trackProgress: [0.5, 0.4, 0.3, 0.2],
        segmentTypes: ['STRAIGHT', 'STRAIGHT', 'STRAIGHT', 'STRAIGHT'],
        rankings: [1, 2, 3, 4],
        totalHorses: 4,
        surface: 'dry',
        ...overrides,
    };
}

// ---- Expression tests ----

describe('expressGenome', () => {
    it('default genome produces midpoint attributes', () => {
        const genome = generateDefaultGenome();
        const attrs = expressGenome(genome);
        // Midpoint of cruiseSpeed range [8, 18] = 13
        expect(attrs.cruiseSpeed).toBeCloseTo(13);
        // Midpoint of maxSpeed range [15, 25] = 20
        expect(attrs.maxSpeed).toBeCloseTo(20);
        // Midpoint of weight range [400, 600] = 500
        expect(attrs.weight).toBeCloseTo(500);
    });

    it('high-allele genome produces high attributes', () => {
        const genome = generateDefaultGenome();
        for (const trait of CORE_TRAIT_NAMES) {
            genome.core[trait] = { sire: 1.0, dam: 1.0 };
        }
        const attrs = expressGenome(genome);
        expect(attrs.cruiseSpeed).toBeCloseTo(18);
        expect(attrs.maxSpeed).toBeCloseTo(25);
        expect(attrs.weight).toBeCloseTo(600);
    });

    it('all traits fall within their ranges', () => {
        const genome = generateRandomGenome();
        const attrs = expressGenome(genome);
        for (const trait of CORE_TRAIT_NAMES) {
            const range = TRAIT_RANGES[trait];
            expect(attrs[trait]).toBeGreaterThanOrEqual(range.min);
            expect(attrs[trait]).toBeLessThanOrEqual(range.max);
        }
    });
});

// ---- Modifier resolution tests ----

describe('resolveEffectiveAttributes', () => {
    it('returns base attributes when no modifiers are active', () => {
        const base = DEFAULT_CORE_ATTRIBUTES;
        const eff = resolveEffectiveAttributes(base, [], makeRaceContext(), 0);
        for (const trait of CORE_TRAIT_NAMES) {
            expect(eff[trait]).toBeCloseTo(base[trait]);
        }
    });

    it('applies percentage bonus from frontRunner modifier', () => {
        const base = DEFAULT_CORE_ATTRIBUTES;
        const mods: ActiveModifier[] = [{ id: 'frontRunner', strength: 1.0 }];
        // Horse 0 is rank 1 (condition met)
        const ctx = makeRaceContext({ rankings: [1, 2, 3, 4] });
        const eff = resolveEffectiveAttributes(base, mods, ctx, 0);
        // frontRunner: +1.5 flat to cruiseSpeed at full strength
        expect(eff.cruiseSpeed).toBeGreaterThan(base.cruiseSpeed);
        expect(eff.cruiseSpeed).toBeCloseTo(base.cruiseSpeed + 1.5);
    });

    it('does not apply modifier when condition is not met', () => {
        const base = DEFAULT_CORE_ATTRIBUTES;
        const mods: ActiveModifier[] = [{ id: 'frontRunner', strength: 1.0 }];
        // Horse 1 is rank 2 (condition not met)
        const ctx = makeRaceContext({ rankings: [1, 2, 3, 4] });
        const eff = resolveEffectiveAttributes(base, mods, ctx, 1);
        expect(eff.cruiseSpeed).toBeCloseTo(base.cruiseSpeed);
    });

    it('clamps to trait range', () => {
        // Push cruiseSpeed above max with flat + pct bonuses
        const base: CoreAttributes = { ...DEFAULT_CORE_ATTRIBUTES, cruiseSpeed: 17.5 };
        const mods: ActiveModifier[] = [{ id: 'frontRunner', strength: 1.0 }];
        const ctx = makeRaceContext({ rankings: [1, 2, 3, 4] });
        const eff = resolveEffectiveAttributes(base, mods, ctx, 0);
        expect(eff.cruiseSpeed).toBeLessThanOrEqual(TRAIT_RANGES.cruiseSpeed.max);
    });

    it('scales effect by modifier strength', () => {
        const base = DEFAULT_CORE_ATTRIBUTES;
        const halfStrength: ActiveModifier[] = [{ id: 'frontRunner', strength: 0.5 }];
        const fullStrength: ActiveModifier[] = [{ id: 'frontRunner', strength: 1.0 }];
        const ctx = makeRaceContext({ rankings: [1, 2, 3, 4] });
        const effHalf = resolveEffectiveAttributes(base, halfStrength, ctx, 0);
        const effFull = resolveEffectiveAttributes(base, fullStrength, ctx, 0);
        // Half strength should get half the bonus
        const halfBonus = effHalf.cruiseSpeed - base.cruiseSpeed;
        const fullBonus = effFull.cruiseSpeed - base.cruiseSpeed;
        expect(halfBonus).toBeCloseTo(fullBonus / 2);
    });
});

// ---- Stamina tests ----

describe('updateStamina', () => {
    const base = DEFAULT_CORE_ATTRIBUTES;

    it('recovers when no drain sources active', () => {
        const newStamina = updateStamina(50, base, 0, base.cruiseSpeed - 1, Infinity);
        expect(newStamina).toBeGreaterThan(50);
    });

    it('drains when jockey pushes forward', () => {
        const newStamina = updateStamina(100, base, 5, 10, Infinity);
        expect(newStamina).toBeLessThan(100);
    });

    it('drains when speed exceeds cruise', () => {
        const newStamina = updateStamina(100, base, 0, base.cruiseSpeed + 3, Infinity);
        expect(newStamina).toBeLessThan(100);
    });

    it('drains on cornering beyond grip threshold', () => {
        // Need requiredForce = speed² / radius > grip * GRIP_FORCE_BASELINE
        // With grip=1.0 and baseline=150, need speed²/radius > 150
        // speed=40, radius=5 → 1600/5 = 320 > 150 ✓
        const tightTurnRadius = 5;
        const highSpeed = 40;
        const requiredForce = (highSpeed * highSpeed) / tightTurnRadius;
        const tolerated = base.corneringGrip * GRIP_FORCE_BASELINE;
        expect(requiredForce).toBeGreaterThan(tolerated);

        const newStamina = updateStamina(100, base, 0, highSpeed, tightTurnRadius);
        expect(newStamina).toBeLessThan(100);
    });

    it('does not drain cornering within grip threshold', () => {
        // Low speed, wide turn → within tolerance
        const wideTurnRadius = 200;
        const lowSpeed = 8;
        const newStamina = updateStamina(50, base, 0, lowSpeed, wideTurnRadius);
        // Should recover since no drain
        expect(newStamina).toBeGreaterThanOrEqual(50);
    });

    it('does not go below 0', () => {
        const newStamina = updateStamina(0.01, base, 10, 20, 10);
        expect(newStamina).toBeGreaterThanOrEqual(0);
    });
});

describe('applyExhaustion', () => {
    const base = DEFAULT_CORE_ATTRIBUTES;

    it('no effect when stamina is above 30%', () => {
        const eff = applyExhaustion(base, 50, 100);
        expect(eff.forwardAccel).toBeCloseTo(base.forwardAccel);
        expect(eff.maxSpeed).toBeCloseTo(base.maxSpeed);
        expect(eff.turnAccel).toBeCloseTo(base.turnAccel);
    });

    it('degrades forwardAccel below 30%', () => {
        const eff = applyExhaustion(base, 15, 100); // 15% stamina
        expect(eff.forwardAccel).toBeLessThan(base.forwardAccel);
    });

    it('degrades maxSpeed toward cruiseSpeed below 20%', () => {
        const eff = applyExhaustion(base, 10, 100); // 10% stamina
        expect(eff.maxSpeed).toBeLessThan(base.maxSpeed);
        expect(eff.maxSpeed).toBeGreaterThanOrEqual(base.cruiseSpeed);
    });

    it('degrades turnAccel below 15%', () => {
        const eff = applyExhaustion(base, 5, 100); // 5% stamina
        expect(eff.turnAccel).toBeLessThan(base.turnAccel);
    });

    it('at 0 stamina, forwardAccel drops to minimum', () => {
        const eff = applyExhaustion(base, 0, 100);
        expect(eff.forwardAccel).toBeCloseTo(TRAIT_RANGES.forwardAccel.min);
    });
});

describe('corneringForceMargin', () => {
    it('returns Infinity on straights', () => {
        expect(corneringForceMargin(1.0, 15, Infinity)).toBe(Infinity);
    });

    it('returns positive when within comfort zone', () => {
        const margin = corneringForceMargin(1.0, 5, 200); // low speed, wide turn
        expect(margin).toBeGreaterThan(0);
    });

    it('returns negative when exceeding grip', () => {
        // grip=0.5, speed=40, radius=5 → required=320, tolerated=75 → margin=-245
        const margin = corneringForceMargin(0.5, 40, 5);
        expect(margin).toBeLessThan(0);
    });
});

// ---- Engine integration tests ----

describe('Engine with attributes', () => {
    it('observations include stamina fields', () => {
        const engine = new HorseRacingEngine(loadTrack());
        const obs = engine.step(zeroActions(4));
        for (const o of obs) {
            expect(typeof o.currentStamina).toBe('number');
            expect(typeof o.maxStamina).toBe('number');
            expect(typeof o.effectiveCruiseSpeed).toBe('number');
            expect(typeof o.effectiveMaxSpeed).toBe('number');
            expect(typeof o.corneringMargin).toBe('number');
        }
    });

    it('fast horse outruns slow horse', () => {
        const segments = loadTrack();

        // Create a fast horse genome (high cruise + max speed)
        const fastGenome = generateDefaultGenome();
        fastGenome.core.cruiseSpeed = { sire: 1.0, dam: 1.0 }; // 18 cruise
        fastGenome.core.maxSpeed = { sire: 1.0, dam: 1.0 };     // 25 max

        // Create a slow horse genome
        const slowGenome = generateDefaultGenome();
        slowGenome.core.cruiseSpeed = { sire: 0.0, dam: 0.0 }; // 8 cruise
        slowGenome.core.maxSpeed = { sire: 0.0, dam: 0.0 };     // 15 max

        const engine = new HorseRacingEngine(
            segments,
            { horseCount: 2 },
            [fastGenome, slowGenome],
        );

        // Run for a while
        let obs: ReturnType<typeof engine.step> = [];
        for (let t = 0; t < 200; t++) {
            obs = engine.step(zeroActions(2));
        }

        // Fast horse should have higher tangential velocity
        expect(obs[0].tangentialVel).toBeGreaterThan(obs[1].tangentialVel);
    });

    it('pushing drains stamina over time', () => {
        const engine = new HorseRacingEngine(loadTrack());
        const pushActions: HorseAction[] = Array.from({ length: 4 }, () => ({
            extraTangential: 10,
            extraNormal: 0,
        }));

        const initial = engine.step(pushActions);
        const initialStamina = initial[0].currentStamina;

        for (let t = 0; t < 100; t++) {
            engine.step(pushActions);
        }
        const after = engine.step(pushActions);
        expect(after[0].currentStamina).toBeLessThan(initialStamina);
    });

    it('stamina recovers when coasting', () => {
        const engine = new HorseRacingEngine(loadTrack());
        // Push briefly to drain stamina but keep speed below cruise speed
        // (avoiding overdrive drain that would block recovery during coast).
        // With per-substep forces, 10 ticks of push drains ~10 stamina from
        // the extraTangential cost while speed stays below cruiseSpeed (~6.5).
        const pushActions: HorseAction[] = Array.from({ length: 4 }, () => ({
            extraTangential: 10,
            extraNormal: 0,
        }));
        for (let t = 0; t < 10; t++) {
            engine.step(pushActions);
        }
        const drained = engine.step(pushActions);
        const drainedStamina = drained[0].currentStamina;

        // Coast — speed is below cruise so drain = 0 and recovery kicks in
        for (let t = 0; t < 100; t++) {
            engine.step(zeroActions(4));
        }
        const recovered = engine.step(zeroActions(4));
        expect(recovered[0].currentStamina).toBeGreaterThan(drainedStamina);
    });
});
