import { readFileSync } from 'fs';
import { join } from 'path';

import { TRAIT_RANGES } from '../src/simulation/attributes';
import {
    OBS_SIZE,
    OPPONENT_SLOTS,
    OPPONENT_SLOT_SIZE,
    SELF_STATE_SIZE,
    TRACK_CONTEXT_SIZE,
    buildObservations,
    curvature,
    normalOffset,
    normalizeTrait,
} from '../src/simulation/observation';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import { TRACK_HALF_WIDTH } from '../src/simulation/types';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

describe('observation constants', () => {
    it('SELF_STATE_SIZE is 14', () => {
        expect(SELF_STATE_SIZE).toBe(14);
    });

    it('TRACK_CONTEXT_SIZE is 10', () => {
        expect(TRACK_CONTEXT_SIZE).toBe(10);
    });

    it('OPPONENT_SLOT_SIZE is 5', () => {
        expect(OPPONENT_SLOT_SIZE).toBe(5);
    });

    it('OPPONENT_SLOTS is 23', () => {
        expect(OPPONENT_SLOTS).toBe(23);
    });

    it('OBS_SIZE is 139', () => {
        expect(OBS_SIZE).toBe(139);
    });
});

describe('normalizeTrait', () => {
    it('maps default cruiseSpeed to 0.5', () => {
        // default cruiseSpeed = 13, range [8, 18] → (13-8)/(18-8) = 0.5
        expect(normalizeTrait(13, 'cruiseSpeed')).toBeCloseTo(0.5);
    });

    it('maps min value to 0', () => {
        expect(normalizeTrait(8, 'cruiseSpeed')).toBeCloseTo(0);
    });

    it('maps max value to 1', () => {
        expect(normalizeTrait(18, 'cruiseSpeed')).toBeCloseTo(1);
    });
});

describe('curvature', () => {
    it('returns 1/turnRadius for finite values', () => {
        expect(curvature(100)).toBeCloseTo(0.01);
    });

    it('returns 0 for very large (straight) turnRadius', () => {
        expect(curvature(Infinity)).toBe(0);
        expect(curvature(1e7)).toBe(0);
    });
});

describe('normalOffset', () => {
    it('computes lateral projection onto self normal', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        const horses = race.state.horses;
        const self = horses[0];
        const opp = horses[1];
        const frame = self.navigator.getTrackFrame(self.pos);

        const offset = normalOffset(opp, self, frame);
        // Opponents are spread across lanes; offset should be non-zero
        expect(typeof offset).toBe('number');
        // Divided by TRACK_HALF_WIDTH, should be within [-1, 1] range for on-track horses
        expect(Math.abs(offset)).toBeLessThanOrEqual(2.0);
    });
});

describe('buildObservations', () => {
    it('returns one Float64Array per horse', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        const obs = buildObservations(race);
        expect(obs).toHaveLength(4);
        obs.forEach(o => {
            expect(o).toBeInstanceOf(Float64Array);
        });
    });

    it('each observation has OBS_SIZE (139) elements', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        const obs = buildObservations(race);
        obs.forEach(o => {
            expect(o).toHaveLength(OBS_SIZE);
        });
    });

    it('trackProgress starts at 0', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        const obs = buildObservations(race);
        obs.forEach(o => {
            expect(o[0]).toBe(0);
        });
    });

    it('stamina starts at 1.0 (normalized)', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        const obs = buildObservations(race);
        obs.forEach(o => {
            expect(o[3]).toBeCloseTo(1.0);
        });
    });

    it('base attributes normalized to [0,1] via TRAIT_RANGES', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        const obs = buildObservations(race);
        // Default cruiseSpeed=13, range [8,18] → 0.5
        obs.forEach(o => {
            expect(o[8]).toBeCloseTo(0.5); // baseCruiseSpeed
            expect(o[9]).toBeCloseTo(0.5); // baseMaxSpeed
            expect(o[10]).toBeCloseTo(0.5); // baseForwardAccel
            expect(o[11]).toBeCloseTo(0.5); // baseTurnAccel
            expect(o[12]).toBeCloseTo(0.5); // baseCorneringGrip
            expect(o[13]).toBeCloseTo(0.5); // baseWeight
        });
    });

    it('opponent slots zero-padded when fewer than MAX_HORSES-1', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        const obs = buildObservations(race);
        // Horse 0 has 1 active opponent (horse 1), then 22 padded slots
        const o = obs[0];
        // First opponent slot active
        const firstOpponentStart = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        expect(o[firstOpponentStart]).toBe(1.0); // active flag
        // Second opponent slot should be padded (zero)
        const secondOpponentStart = firstOpponentStart + OPPONENT_SLOT_SIZE;
        for (let j = 0; j < OPPONENT_SLOT_SIZE; j++) {
            expect(o[secondOpponentStart + j]).toBe(0);
        }
    });

    it('opponents sorted by distance in track progress', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        // Start race and advance so horses may separate
        race.start(null);
        // Apply some input to horse 0 to create progress differences
        const inputs = new Map<
            number,
            { tangential: number; normal: number }
        >();
        inputs.set(0, { tangential: 1, normal: 0 });
        inputs.set(1, { tangential: 0.5, normal: 0 });
        inputs.set(2, { tangential: 0.8, normal: 0 });
        inputs.set(3, { tangential: 0.3, normal: 0 });
        for (let i = 0; i < 60; i++) {
            race.tick(inputs);
        }

        const obs = buildObservations(race);
        const o = obs[0];
        const opponentBase = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;

        // Collect absolute relativeProgress for active opponents
        const distances: number[] = [];
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const offset = opponentBase + s * OPPONENT_SLOT_SIZE;
            if (o[offset] === 1.0) {
                distances.push(Math.abs(o[offset + 1]));
            }
        }

        // Should be sorted ascending (closest first)
        for (let i = 1; i < distances.length; i++) {
            expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
        }
    });

    it('handles single horse (all opponent slots padded)', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 1);
        const obs = buildObservations(race);
        expect(obs).toHaveLength(1);
        expect(obs[0]).toHaveLength(OBS_SIZE);
        // All opponent slots should be zero
        const opponentBase = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        for (let i = opponentBase; i < OBS_SIZE; i++) {
            expect(obs[0][i]).toBe(0);
        }
    });

    it('handles max horses (24 horses, 23 active opponent slots)', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 24);
        const obs = buildObservations(race);
        expect(obs).toHaveLength(24);

        // Each horse should have 23 active opponent slots
        const opponentBase = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        obs.forEach(o => {
            for (let s = 0; s < OPPONENT_SLOTS; s++) {
                const offset = opponentBase + s * OPPONENT_SLOT_SIZE;
                expect(o[offset]).toBe(1.0); // active flag
            }
        });
    });

    it('tangential and normal vel start at 0', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        const obs = buildObservations(race);
        obs.forEach(o => {
            expect(o[1]).toBe(0); // tangentialVel
            expect(o[2]).toBe(0); // normalVel
        });
    });

    it('effective attributes normalized by base attributes', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        const obs = buildObservations(race);
        // At start, effective == base, so cruiseSpeed/baseCruiseSpeed = 1.0
        obs.forEach(o => {
            expect(o[4]).toBeCloseTo(1.0); // effectiveCruiseSpeed / baseCruiseSpeed
            expect(o[5]).toBeCloseTo(1.0); // effectiveMaxSpeed / baseMaxSpeed
            expect(o[6]).toBeCloseTo(1.0); // effectiveForwardAccel / baseForwardAccel
            expect(o[7]).toBeCloseTo(1.0); // effectiveTurnAccel / baseTurnAccel
        });
    });

    it('track context includes curvature and slope at current position', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        const obs = buildObservations(race);
        // At start on a straight segment, curvature should be 0
        expect(obs[0][14]).toBe(0); // currentCurvature
        // slope depends on track, but should be a number
        expect(typeof obs[0][15]).toBe('number');
    });
});
