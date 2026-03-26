import { readFileSync } from 'fs';
import { join } from 'path';

import { World } from '@ue-too/dynamics';

import {
    buildTrackIntoWorld,
    parseTrackJson,
    trackBounds,
} from '../src/simulation/track-from-json';

describe('parseTrackJson', () => {
    it('parses exp_track_8 shape', () => {
        const path = join(__dirname, '../public/tracks/exp_track_8.json');
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
        const segs = parseTrackJson(raw);
        expect(segs.length).toBeGreaterThan(0);
        expect(segs.some((s) => s.tracktype === 'STRAIGHT')).toBe(true);
        expect(segs.some((s) => s.tracktype === 'CURVE')).toBe(true);
    });

    it('buildTrackIntoWorld adds bodies', () => {
        const path = join(__dirname, '../public/tracks/track.json');
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
        const segs = parseTrackJson(raw);
        const b = trackBounds(segs, 50);
        const w = Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) + 100;
        const h = Math.max(Math.abs(b.min.y), Math.abs(b.max.y)) + 100;
        const world = new World(w, h, 'dynamictree');
        buildTrackIntoWorld(world, segs);
        expect(world.getRigidBodyList().length).toBeGreaterThan(0);
    });
});
