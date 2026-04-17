import { readFileSync } from 'fs';
import { join } from 'path';

import {
    ARCHETYPE_NAMES,
    PARAM_RANGES,
    PERSONALITY_PARAMS,
    type Proposal,
    enforceAnchors,
    gaussian,
    mulberry32,
    perturb,
    runRace,
} from '../scripts/tune-bts';
import { mergeBtConfig } from '../src/ai/bt-jockey';
import { parseTrackJson } from '../src/simulation/track-from-json';

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

describe('enforceAnchors', () => {
    it('clamps front-runner kickPhase down to 0.72', () => {
        const p: Proposal = {
            ...startingProposal(),
            'front-runner': { kickPhase: 0.85, cruiseHigh: 0.85 },
        };
        const out = enforceAnchors(p);
        expect(out['front-runner'].kickPhase).toBe(0.72);
    });

    it('clamps front-runner cruiseHigh up to 0.78', () => {
        const p: Proposal = {
            ...startingProposal(),
            'front-runner': { kickPhase: 0.65, cruiseHigh: 0.6 },
        };
        const out = enforceAnchors(p);
        expect(out['front-runner'].cruiseHigh).toBe(0.78);
    });

    it('clamps closer kickPhase up to 0.78 and wKick up to 1.2', () => {
        const p: Proposal = {
            ...startingProposal(),
            closer: { kickPhase: 0.6, wKick: 0.5 },
        };
        const out = enforceAnchors(p);
        expect(out.closer.kickPhase).toBe(0.78);
        expect(out.closer.wKick).toBe(1.2);
    });

    it('clamps speedball wPass up to 1.2', () => {
        const p: Proposal = {
            ...startingProposal(),
            speedball: { wPass: 0.4 },
        };
        const out = enforceAnchors(p);
        expect(out.speedball.wPass).toBe(1.2);
    });

    it('clamps stalker wDraft up to 1.0', () => {
        const p: Proposal = {
            ...startingProposal(),
            stalker: { wDraft: 0.5 },
        };
        const out = enforceAnchors(p);
        expect(out.stalker.wDraft).toBe(1.0);
    });

    it('clamps steady wPass down to 0.8', () => {
        const p: Proposal = {
            ...startingProposal(),
            steady: { wPass: 1.5 },
        };
        const out = enforceAnchors(p);
        expect(out.steady.wPass).toBe(0.8);
    });

    it('does not clamp values that satisfy the anchor', () => {
        const p: Proposal = {
            ...startingProposal(),
            'front-runner': { kickPhase: 0.65, cruiseHigh: 0.85 },
            closer: { kickPhase: 0.85, wKick: 1.5 },
        };
        const out = enforceAnchors(p);
        expect(out['front-runner'].kickPhase).toBe(0.65);
        expect(out['front-runner'].cruiseHigh).toBe(0.85);
        expect(out.closer.kickPhase).toBe(0.85);
        expect(out.closer.wKick).toBe(1.5);
    });

    it('leaves drifter unconstrained', () => {
        const p: Proposal = {
            ...startingProposal(),
            drifter: { kickPhase: 0.55, wPass: 0.1, wKick: 0.1, wDraft: 0.1 },
        };
        const out = enforceAnchors(p);
        expect(out.drifter.kickPhase).toBe(0.55);
        expect(out.drifter.wPass).toBe(0.1);
        expect(out.drifter.wKick).toBe(0.1);
        expect(out.drifter.wDraft).toBe(0.1);
    });
});

function loadTestTrack(name: string) {
    const path = join(__dirname, '..', 'public', 'tracks', `${name}.json`);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')));
}

describe('runRace (smoke)', () => {
    it('finishes a race on test_oval with the starting archetype configs', async () => {
        const segments = loadTestTrack('test_oval');
        const out = await runRace(segments, startingProposal(), 1);
        expect(out.finished).toBe(true);
        expect(out.finishOrder).toHaveLength(6);
        expect(new Set(out.finishOrder).size).toBe(6); // all unique
        expect(out.archetypeBySlot).toHaveLength(6);
    }, 60_000);
});
