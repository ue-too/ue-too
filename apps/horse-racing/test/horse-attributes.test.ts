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
        // Midpoint of cruiseSpeed range [12, 16.5] = 14.25
        expect(attrs.cruiseSpeed).toBeCloseTo(14.25);
        // Midpoint of maxSpeed range [16, 20] = 18
        expect(attrs.maxSpeed).toBeCloseTo(18);
        // Midpoint of weight range [430, 550] = 490
        expect(attrs.weight).toBeCloseTo(490);
    });

    it('high-allele genome produces high attributes', () => {
        const genome = generateDefaultGenome();
        for (const trait of CORE_TRAIT_NAMES) {
            genome.core[trait] = { sire: 1.0, dam: 1.0 };
        }
        const attrs = expressGenome(genome);
        expect(attrs.cruiseSpeed).toBeCloseTo(16.5);
        expect(attrs.maxSpeed).toBeCloseTo(20);
        expect(attrs.weight).toBeCloseTo(550);
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
        // frontRunner: +0.7 flat to cruiseSpeed at full strength
        expect(eff.cruiseSpeed).toBeGreaterThan(base.cruiseSpeed);
        expect(eff.cruiseSpeed).toBeCloseTo(base.cruiseSpeed + 0.7);
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

    it('never increases (no recovery)', () => {
        // At cruise speed with no actions, stamina should only decrease
        const newStamina = updateStamina(50, base, 0, 0, base.cruiseSpeed - 1, base.cruiseSpeed - 1, 0, Infinity);
        expect(newStamina).toBeLessThanOrEqual(50);
    });

    it('no drain at zero speed and no actions', () => {
        const newStamina = updateStamina(100, base, 0, 0, 0, 0, 0, Infinity);
        expect(newStamina).toBe(100);
    });

    it('drains when jockey pushes forward', () => {
        const newStamina = updateStamina(100, base, 5, 0, 10, 10, 0, Infinity);
        expect(newStamina).toBeLessThan(100);
    });

    it('drains when jockey steers laterally', () => {
        const noSteer = updateStamina(100, base, 0, 0, 14, 14, 0, Infinity);
        const steer = updateStamina(100, base, 0, 3, 14, 14, 0, Infinity);
        expect(steer).toBeLessThan(noSteer);
    });

    it('drains from sustained lateral velocity', () => {
        const noDrift = updateStamina(100, base, 0, 0, 14, 14, 0, Infinity);
        const drift = updateStamina(100, base, 0, 0, 14, 14, 2, Infinity);
        expect(drift).toBeLessThan(noDrift);
    });

    it('drains when speed exceeds cruise', () => {
        const newStamina = updateStamina(100, base, 0, 0, base.cruiseSpeed + 6, base.cruiseSpeed + 6, 0, Infinity);
        expect(newStamina).toBeLessThan(100);
    });

    it('drains on cornering beyond grip threshold', () => {
        const tightTurnRadius = 5;
        const highSpeed = 40;
        const requiredForce = (highSpeed * highSpeed) / tightTurnRadius;
        const tolerated = base.corneringGrip * GRIP_FORCE_BASELINE;
        expect(requiredForce).toBeGreaterThan(tolerated);

        const newStamina = updateStamina(100, base, 0, 0, highSpeed, highSpeed, 0, tightTurnRadius);
        expect(newStamina).toBeLessThan(100);
    });

    it('does not go below 0', () => {
        const newStamina = updateStamina(0.01, base, 10, 5, 20, 20, 3, 10);
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

    it('degrades turnAccel progressively below 25%', () => {
        const at25 = applyExhaustion(base, 25, 100);
        expect(at25.turnAccel).toBeCloseTo(base.turnAccel); // threshold boundary

        const at12 = applyExhaustion(base, 12.5, 100); // ~75%
        expect(at12.turnAccel).toBeLessThan(base.turnAccel);
        expect(at12.turnAccel).toBeCloseTo(base.turnAccel * 0.75);

        const at0 = applyExhaustion(base, 0, 100); // ~50%
        expect(at0.turnAccel).toBeCloseTo(base.turnAccel * 0.5);
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

    it('stamina never recovers (fixed pool)', () => {
        const engine = new HorseRacingEngine(loadTrack());
        // Push briefly to drain stamina
        const pushActions: HorseAction[] = Array.from({ length: 4 }, () => ({
            extraTangential: 10,
            extraNormal: 0,
        }));
        for (let t = 0; t < 10; t++) {
            engine.step(pushActions);
        }
        const drained = engine.step(pushActions);
        const drainedStamina = drained[0].currentStamina;

        // Coast — stamina should not recover, only continue to drain (distance tax)
        for (let t = 0; t < 100; t++) {
            engine.step(zeroActions(4));
        }
        const after = engine.step(zeroActions(4));
        expect(after[0].currentStamina).toBeLessThanOrEqual(drainedStamina);
    });
});
