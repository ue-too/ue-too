import { readFileSync } from 'fs';
import { join } from 'path';

import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import type { TrackSegment } from '../src/simulation/track-types';
import type { InputState } from '../src/simulation/types';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };
const FLOOR_IT_INPUT: InputState = { tangential: 1, normal: 0 };
const MAX_TICKS = 20_000;

/**
 * Run a race with horse 0 as player, using the given input every tick.
 * Returns finish tick and stamina-depletion tick for horse 0.
 */
function runPlayerRace(
    segments: TrackSegment[],
    input: InputState
): { finishTick: number | null; depletionTick: number | null } {
    const race = new Race(segments);
    race.start(0);
    const inputs = new Map<number, InputState>([[0, input]]);
    let depletionTick: number | null = null;

    for (let tick = 0; tick < MAX_TICKS; tick++) {
        race.tick(inputs);
        const h = race.state.horses[0];

        if (h.currentStamina <= 0 && depletionTick === null) {
            depletionTick = tick;
        }
        if (h.finished) {
            return { finishTick: tick, depletionTick };
        }
    }

    return { finishTick: null, depletionTick };
}

const describeOrSkip = process.env.CI ? describe.skip : describe;

describeOrSkip('Pacing strategy validation', () => {
    it('floor-it horse loses to cruise horse on test_oval', () => {
        const segments = loadTrack('test_oval.json');
        const floorIt = runPlayerRace(segments, FLOOR_IT_INPUT);
        const cruise = runPlayerRace(segments, ZERO_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(cruise.finishTick).not.toBeNull();
        expect(floorIt.finishTick!).toBeGreaterThan(cruise.finishTick!);
    }, 60_000);

    it('floor-it horse loses to cruise horse on curriculum_1_straight (sprint)', () => {
        const segments = loadTrack('curriculum_1_straight.json');
        const floorIt = runPlayerRace(segments, FLOOR_IT_INPUT);
        const cruise = runPlayerRace(segments, ZERO_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(cruise.finishTick).not.toBeNull();
        expect(floorIt.finishTick!).toBeGreaterThan(cruise.finishTick!);
    }, 60_000);

    it('floor-it horse depletes stamina before finishing on test_oval', () => {
        const segments = loadTrack('test_oval.json');
        const floorIt = runPlayerRace(segments, FLOOR_IT_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(floorIt.depletionTick).not.toBeNull();
        expect(floorIt.depletionTick!).toBeLessThan(floorIt.finishTick!);
    }, 60_000);
});
