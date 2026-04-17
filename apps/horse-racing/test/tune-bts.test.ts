import {
    ARCHETYPE_NAMES,
    PARAM_RANGES,
    PERSONALITY_PARAMS,
    type Proposal,
    gaussian,
    mulberry32,
    perturb,
} from '../scripts/tune-bts';
import { mergeBtConfig } from '../src/ai/bt-jockey';

function startingProposal(): Proposal {
    return {
        stalker: {},
        'front-runner': {},
        closer: {},
        speedball: {},
        steady: {},
        drifter: {},
    } as Proposal;
}

describe('mulberry32', () => {
    it('produces deterministic, identical streams from the same seed', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        for (let i = 0; i < 5; i++) {
            expect(a()).toBe(b());
        }
    });
});

describe('gaussian', () => {
    it('is approximately N(0,1) over many samples', () => {
        const rng = mulberry32(123);
        const samples = Array.from({ length: 5000 }, () => gaussian(rng));
        const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
        const variance =
            samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
        expect(Math.abs(mean)).toBeLessThan(0.1);
        expect(Math.abs(variance - 1)).toBeLessThan(0.15);
    });
});

describe('perturb', () => {
    it('produces overrides for every archetype × every personality param', () => {
        const next = perturb(startingProposal(), 0.1, mulberry32(7));
        for (const name of ARCHETYPE_NAMES) {
            for (const param of PERSONALITY_PARAMS) {
                expect(
                    (next[name] as Record<string, number>)[param]
                ).toBeDefined();
            }
        }
    });

    it('clamps every output value to its declared range', () => {
        const next = perturb(startingProposal(), 1.0, mulberry32(7));
        for (const name of ARCHETYPE_NAMES) {
            for (const param of PERSONALITY_PARAMS) {
                const [min, max] = PARAM_RANGES[param];
                const v = (next[name] as Record<string, number>)[param];
                expect(v).toBeGreaterThanOrEqual(min);
                expect(v).toBeLessThanOrEqual(max);
            }
        }
    });

    it('with sigma=0 returns the input archetype defaults exactly', () => {
        const next = perturb(startingProposal(), 0, mulberry32(7));
        for (const name of ARCHETYPE_NAMES) {
            for (const param of PERSONALITY_PARAMS) {
                const v = (next[name] as Record<string, number>)[param];
                const expected = mergeBtConfig(name, {})[param];
                expect(v).toBeCloseTo(expected, 10);
            }
        }
    });
});
