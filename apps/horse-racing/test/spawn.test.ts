import { readFileSync } from 'fs';
import { join } from 'path';

import { spawnHorses } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import { MAX_HORSES } from '../src/simulation/types';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

describe('spawnHorses', () => {
    const segments = loadTrack('test_oval.json');

    it('spawns the requested number of horses', () => {
        const horses = spawnHorses(segments, 8);
        expect(horses).toHaveLength(8);
    });

    it('defaults to 4 horses', () => {
        const horses = spawnHorses(segments);
        expect(horses).toHaveLength(4);
    });

    it('assigns sequential ids starting from 0', () => {
        const horses = spawnHorses(segments, 6);
        expect(horses.map(h => h.id)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('spaces horses across available lanes (distinct positions)', () => {
        const horses = spawnHorses(segments, 5);
        const xs = horses.map(h => h.pos.x);
        const unique = new Set(xs);
        expect(unique.size).toBe(5);
    });

    it('clamps to MAX_HORSES (24) for count > 24', () => {
        const horses = spawnHorses(segments, 50);
        expect(horses).toHaveLength(MAX_HORSES);
    });

    it('clamps to minimum 1 for count <= 0', () => {
        expect(spawnHorses(segments, 0)).toHaveLength(1);
        expect(spawnHorses(segments, -5)).toHaveLength(1);
    });
});
