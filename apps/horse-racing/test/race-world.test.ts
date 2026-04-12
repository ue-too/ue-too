import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { RaceWorld } from '../src/simulation/race-world';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

describe('RaceWorld', () => {
    it('creates world with rail bodies from track', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        expect(rw.world.getRigidBodyList().length).toBeGreaterThan(0);
    });

    it('adds horse polygon bodies', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        const railCount = rw.world.getRigidBodyList().length;

        rw.addHorse(0, { x: 0, y: 0 }, 0, 500);
        rw.addHorse(1, { x: 0, y: 5 }, 0, 500);

        expect(rw.world.getRigidBodyList().length).toBe(railCount + 2);
        expect(rw.getHorseBody(0)).toBeDefined();
        expect(rw.getHorseBody(1)).toBeDefined();
    });

    it('horse body has correct mass and position', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        rw.addHorse(0, { x: 10, y: 20 }, Math.PI / 4, 450);

        const body = rw.getHorseBody(0);
        expect(body.center.x).toBeCloseTo(10);
        expect(body.center.y).toBeCloseTo(20);
        expect(body.mass).toBe(450);
        expect(body.orientationAngle).toBeCloseTo(Math.PI / 4);
    });

    it('throws for unknown horse id', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        expect(() => rw.getHorseBody(99)).toThrow();
    });

    it('step advances the world without error', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        rw.addHorse(0, { x: 0, y: 0 }, 0, 500);
        expect(() => rw.step(1 / 240)).not.toThrow();
    });
});
