import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { Race } from '../src/simulation/race';
import type { InputState } from '../src/simulation/types';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };
const MAX_TICKS = 10_000;

describe('Race physics integration', () => {
    it('all four horses finish in watch mode on test_oval.json', () => {
        const segments = loadTrack('test_oval.json');
        const race = new Race(segments);
        race.start(null);

        let safety = 0;
        while (race.state.phase !== 'finished' && safety < MAX_TICKS) {
            race.tick(ZERO_INPUT);
            safety++;
        }

        expect(race.state.phase).toBe('finished');
        expect(race.state.horses.every((h) => h.finished)).toBe(true);
        expect(race.state.finishOrder).toHaveLength(4);
    });

    it('identical horses finish within 15% tick variance', () => {
        const segments = loadTrack('test_oval.json');
        const race = new Race(segments);
        race.start(null);

        const finishTicks = new Map<number, number>();
        let safety = 0;
        while (race.state.phase !== 'finished' && safety < MAX_TICKS) {
            race.tick(ZERO_INPUT);
            safety++;
            for (const h of race.state.horses) {
                if (h.finished && !finishTicks.has(h.id)) {
                    finishTicks.set(h.id, race.state.tick);
                }
            }
        }

        expect(finishTicks.size).toBe(4);
        const ticks = [...finishTicks.values()];
        const minT = Math.min(...ticks);
        const maxT = Math.max(...ticks);
        expect((maxT - minT) / minT).toBeLessThan(0.15);
    });
});
