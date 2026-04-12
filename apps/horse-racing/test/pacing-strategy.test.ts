import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { createDefaultAttributes } from '../src/simulation/attributes';
import { applyExhaustion } from '../src/simulation/exhaustion';
import { stepPhysicsSingle } from '../src/simulation/physics';
import { drainStamina } from '../src/simulation/stamina';
import { TrackNavigator } from '../src/simulation/track-navigator';
import type { Horse, InputState } from '../src/simulation/types';
import { FIXED_DT, PHYS_SUBSTEPS, TRACK_HALF_WIDTH } from '../src/simulation/types';
import type { TrackSegment } from '../src/simulation/track-types';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };
const FLOOR_IT_INPUT: InputState = { tangential: 1, normal: 0 };
const MAX_TICKS = 20_000;

/**
 * Create a standalone horse at the start of a track.
 * Uses player mode (id = 0, playerHorseId = 0) so input is applied.
 */
function createHorse(segments: TrackSegment[]): Horse {
    const first = segments[0];
    const attrs = createDefaultAttributes();
    return {
        id: 0,
        color: 0,
        pos: { x: first.startPoint.x, y: first.startPoint.y },
        tangentialVel: 0,
        normalVel: 0,
        trackProgress: 0,
        navigator: new TrackNavigator(segments, 0, TRACK_HALF_WIDTH),
        finished: false,
        finishOrder: null,
        baseAttributes: attrs,
        currentStamina: attrs.maxStamina,
        effectiveAttributes: { ...attrs },
    };
}

/**
 * Run a single horse through the full track with the given input.
 * Returns the finish tick, or null if DNF within MAX_TICKS.
 * Also returns the tick at which stamina hit 0 (or null).
 */
function runSingleHorse(
    segments: TrackSegment[],
    input: InputState,
): { finishTick: number | null; depletionTick: number | null } {
    const horse = createHorse(segments);
    let depletionTick: number | null = null;

    for (let tick = 0; tick < MAX_TICKS; tick++) {
        // 1. Exhaustion
        horse.effectiveAttributes = applyExhaustion(horse);

        // 2. Physics substeps
        for (let s = 0; s < PHYS_SUBSTEPS; s++) {
            stepPhysicsSingle(horse, horse.effectiveAttributes, input, 0, FIXED_DT);
        }

        // 3. Drain
        const frame = horse.navigator.getTrackFrame(horse.pos);
        drainStamina(horse, horse.effectiveAttributes, input, frame);

        if (horse.currentStamina <= 0 && depletionTick === null) {
            depletionTick = tick;
        }

        if (horse.trackProgress >= 1.0) {
            return { finishTick: tick, depletionTick };
        }
    }

    return { finishTick: null, depletionTick };
}

describe('Pacing strategy validation', () => {
    it('floor-it horse loses to cruise horse on test_oval', () => {
        const segments = loadTrack('test_oval.json');
        const floorIt = runSingleHorse(segments, FLOOR_IT_INPUT);
        const cruise = runSingleHorse(segments, ZERO_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(cruise.finishTick).not.toBeNull();
        // Floor-it should finish AFTER cruise
        expect(floorIt.finishTick!).toBeGreaterThan(cruise.finishTick!);
    });

    it('floor-it horse loses to cruise horse on curriculum_1_straight (sprint)', () => {
        const segments = loadTrack('curriculum_1_straight.json');
        const floorIt = runSingleHorse(segments, FLOOR_IT_INPUT);
        const cruise = runSingleHorse(segments, ZERO_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(cruise.finishTick).not.toBeNull();
        // Floor-it should finish AFTER cruise
        expect(floorIt.finishTick!).toBeGreaterThan(cruise.finishTick!);
    });

    it('floor-it horse depletes stamina before finishing', () => {
        const segments = loadTrack('test_oval.json');
        const floorIt = runSingleHorse(segments, FLOOR_IT_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(floorIt.depletionTick).not.toBeNull();
        // Should deplete BEFORE finishing
        expect(floorIt.depletionTick!).toBeLessThan(floorIt.finishTick!);
    });
});
