import { readFileSync } from 'fs';
import { join } from 'path';

import {
    ARCHETYPES,
    BTJockey,
    BT_ARCHETYPE_IDS,
    BUILTIN_ARCHETYPE_NAMES,
    DEFAULT_CONFIG,
    mergeBtConfig,
    registerArchetype,
    removeArchetype,
} from '../src/ai/bt-jockey';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

describe('mergeBtConfig', () => {
    it('returns DEFAULT_CONFIG when archetype is unknown', () => {
        const merged = mergeBtConfig('does-not-exist');
        expect(merged).toEqual(DEFAULT_CONFIG);
    });

    it('overlays archetype on top of defaults', () => {
        const merged = mergeBtConfig('front-runner');
        expect(merged.cruiseHigh).toBe(0.85);
        // Field NOT overridden by front-runner falls through to default.
        expect(merged.conserveThreshold).toBe(DEFAULT_CONFIG.conserveThreshold);
    });

    it('overrides win over both archetype and defaults', () => {
        const merged = mergeBtConfig('front-runner', { cruiseHigh: 0.42 });
        expect(merged.cruiseHigh).toBe(0.42);
    });
});

describe('archetype registry', () => {
    it('BUILTIN_ARCHETYPE_NAMES matches the originally shipped archetypes', () => {
        for (const name of BUILTIN_ARCHETYPE_NAMES) {
            expect(ARCHETYPES).toHaveProperty(name);
        }
    });

    it('BT_ARCHETYPE_IDS is sorted', () => {
        const sorted = [...BT_ARCHETYPE_IDS].sort((a, b) => a.localeCompare(b));
        expect(BT_ARCHETYPE_IDS).toEqual(sorted);
    });

    it('registerArchetype inserts and rebuilds the sorted id list', () => {
        registerArchetype('zzz-test', { targetLane: 0.0 });
        try {
            expect(BT_ARCHETYPE_IDS).toContain('zzz-test');
            const sorted = [...BT_ARCHETYPE_IDS].sort((a, b) =>
                a.localeCompare(b)
            );
            expect(BT_ARCHETYPE_IDS).toEqual(sorted);
            expect(mergeBtConfig('zzz-test').targetLane).toBe(0.0);
        } finally {
            removeArchetype('zzz-test');
        }
    });

    it('removeArchetype returns false for unknown names', () => {
        expect(removeArchetype('not-real')).toBe(false);
    });

    it('removeArchetype drops the archetype and rebuilds the id list', () => {
        registerArchetype('temp-test', {});
        expect(removeArchetype('temp-test')).toBe(true);
        expect(BT_ARCHETYPE_IDS).not.toContain('temp-test');
    });
});

describe('BTJockey public interface', () => {
    it('infer returns a Map keyed by non-player horse ids', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(0); // horse 0 is player
        const jockey = new BTJockey();

        const actions = jockey.infer(race);

        expect(actions).toBeInstanceOf(Map);
        expect(actions.size).toBe(3);
        expect(actions.has(0)).toBe(false);
        expect(actions.has(1)).toBe(true);
        expect(actions.has(2)).toBe(true);
        expect(actions.has(3)).toBe(true);
    });

    it('infer covers all horses when no player is set', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);
        const jockey = new BTJockey();

        const actions = jockey.infer(race);
        expect(actions.size).toBe(4);
    });

    it('all produced actions have tangential and normal in [-1, 1]', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 6);
        race.start(null);
        const jockey = new BTJockey();

        const actions = jockey.infer(race);
        for (const a of actions.values()) {
            expect(a.tangential).toBeGreaterThanOrEqual(-1);
            expect(a.tangential).toBeLessThanOrEqual(1);
            expect(a.normal).toBeGreaterThanOrEqual(-1);
            expect(a.normal).toBeLessThanOrEqual(1);
        }
    });

    it('inferAsync with horseIds only infers for the requested horses', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);
        const jockey = new BTJockey();

        const actions = await jockey.inferAsync(race, [1, 3]);

        expect(actions.size).toBe(2);
        expect(actions.has(1)).toBe(true);
        expect(actions.has(3)).toBe(true);
        expect(actions.has(0)).toBe(false);
        expect(actions.has(2)).toBe(false);
    });

    it('inferAsync skips finished horses', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 3);
        race.start(null);
        race.state.horses[1].finished = true;
        const jockey = new BTJockey();

        const actions = await jockey.inferAsync(race);
        expect(actions.has(1)).toBe(false);
        expect(actions.size).toBe(2);
    });

    it('dispose causes subsequent infer to return an empty map', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 3);
        race.start(null);
        const jockey = new BTJockey();

        jockey.dispose();
        const actions = jockey.infer(race);
        expect(actions.size).toBe(0);
    });
});

describe('BTJockey behaviour', () => {
    it('cruises at low tangential when far from the finish with full stamina', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        race.start(null);
        const jockey = new BTJockey();

        const actions = jockey.infer(race);
        for (const a of actions.values()) {
            // Cruise selector caps tangential at 0.75 (the "below band" push);
            // KICK is the only state that outputs 1.0.
            expect(a.tangential).toBeLessThanOrEqual(0.75);
        }
    });

    it('forces a kick once progress passes kickLateCap', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        race.start(null);
        const jockey = new BTJockey();

        // Push horse 0 past the forced-kick threshold (default 0.92).
        race.state.horses[0].trackProgress = 0.95;

        const action = jockey.infer(race).get(0)!;
        expect(action.tangential).toBe(1);
    });

    it('KICK is absorbing — tangential stays at 1 after rolling progress back', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        race.start(null);
        const jockey = new BTJockey();

        // Trigger KICK.
        race.state.horses[0].trackProgress = 0.95;
        jockey.infer(race);

        // Roll progress back; KICK is supposed to be terminal.
        race.state.horses[0].trackProgress = 0.1;
        const action = jockey.infer(race).get(0)!;
        expect(action.tangential).toBe(1);
    });

    it('front-runner cruise selector converges to a stable equilibrium without oscillation', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 1);
        race.start(null);
        const jockey = new BTJockey({
            ...DEFAULT_CONFIG,
            ...ARCHETYPES['front-runner'],
        });

        // Warm up: 200 ticks (~6.7s of sim time) for the horse to settle.
        for (let i = 0; i < 200; i++) {
            race.tick(jockey.infer(race));
        }

        // Sample velocity over the next 60 ticks.
        const samples: number[] = [];
        for (let i = 0; i < 60; i++) {
            race.tick(jockey.infer(race));
            samples.push(race.state.horses[0].tangentialVel);
        }

        // Make sure the horse hasn't entered KICK (would skew the test).
        expect(race.state.horses[0].trackProgress).toBeLessThan(0.5);

        const min = Math.min(...samples);
        const max = Math.max(...samples);
        // Old binary selector oscillated ~4 m/s between cruise modes.
        // Proportional selector should keep spread under 1 m/s.
        expect(max - min).toBeLessThan(1.0);
    });

    it('resetFrames lets a previously kicking horse cruise again', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        race.start(null);
        const jockey = new BTJockey();

        race.state.horses[0].trackProgress = 0.95;
        jockey.infer(race);

        jockey.resetFrames();
        race.state.horses[0].trackProgress = 0.0;

        const action = jockey.infer(race).get(0)!;
        // Cruise selector caps at 0.75; KICK would output 1.0.
        expect(action.tangential).toBeLessThanOrEqual(0.75);
    });
});
