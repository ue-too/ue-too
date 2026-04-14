import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { TrackNavigator } from '../src/simulation/track-navigator';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

describe('TrackNavigator.sampleTrackAhead', () => {
    it('returns current frame for distance 0', () => {
        const segments = loadOvalTrack();
        const nav = new TrackNavigator(segments, 0);
        const pos = { x: 50, y: 0 };
        const frame0 = nav.getTrackFrame(pos);
        const frameLookahead = nav.sampleTrackAhead(pos, 0);
        expect(frameLookahead.tangential.x).toBeCloseTo(frame0.tangential.x, 6);
        expect(frameLookahead.tangential.y).toBeCloseTo(frame0.tangential.y, 6);
        expect(frameLookahead.normal.x).toBeCloseTo(frame0.normal.x, 6);
        expect(frameLookahead.normal.y).toBeCloseTo(frame0.normal.y, 6);
        expect(frameLookahead.turnRadius).toBe(frame0.turnRadius);
    });

    it('returns a TrackFrame at the requested distance ahead', () => {
        const segments = loadOvalTrack();
        const nav = new TrackNavigator(segments, 0);
        // Position at start of first straight segment
        const pos = { x: 0, y: 0 };
        // Sample 100m ahead — still on the first straight (250m long)
        const frame = nav.sampleTrackAhead(pos, 100);
        // On a straight, tangential should point in the forward direction (+x)
        expect(frame.tangential.x).toBeCloseTo(1, 3);
        expect(frame.tangential.y).toBeCloseTo(0, 3);
        expect(frame.turnRadius).toBe(Infinity);
        expect(frame.nominalRadius).toBe(Infinity);
    });

    it('crosses segment boundaries', () => {
        const segments = loadOvalTrack();
        const nav = new TrackNavigator(segments, 0);
        const pos = { x: 0, y: 0 };
        // ~30% of total track length should land on a curve
        const totalLength = nav.totalLength;
        const frame = nav.sampleTrackAhead(pos, totalLength * 0.3);
        // On a curve, turnRadius should be finite
        expect(frame.turnRadius).toBeLessThan(1e6);
        expect(frame.nominalRadius).toBeLessThan(1e6);
    });

    it('clamps to last segment for distance beyond track', () => {
        const segments = loadOvalTrack();
        const nav = new TrackNavigator(segments, 0);
        const pos = { x: 0, y: 0 };
        const totalLength = nav.totalLength;
        // Request well beyond the track
        const frame = nav.sampleTrackAhead(pos, totalLength * 2);
        // Should return a valid frame (the end of the last segment)
        expect(frame.tangential).toBeDefined();
        expect(frame.normal).toBeDefined();
        // Last segment is a curve
        expect(frame.turnRadius).toBeLessThan(1e6);
    });
});
