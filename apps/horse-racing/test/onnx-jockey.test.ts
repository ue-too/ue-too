import { readFileSync } from 'fs';
import { join } from 'path';

import { OnnxJockey } from '../src/ai/onnx-jockey';
import { OBS_SIZE } from '../src/simulation/observation';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

/** Minimal mock that mimics onnxruntime-web InferenceSession. */
function createMockSession(outputAction: number[]) {
    return {
        inputNames: ['obs'],
        outputNames: ['actions'],
        run: jest.fn(async (feeds: Record<string, unknown>) => {
            const input = feeds['obs'] as { dims: number[] };
            const batchSize = input.dims[0];
            const data = new Float32Array(batchSize * 2);
            for (let i = 0; i < batchSize; i++) {
                data[i * 2] = outputAction[0];
                data[i * 2 + 1] = outputAction[1];
            }
            return {
                actions: { dims: [batchSize, 2], data },
            };
        }),
        release: jest.fn(),
    };
}

describe('OnnxJockey', () => {
    it('produces actions for all horses when no player is set', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null); // no player — all horses are AI

        const session = createMockSession([0.5, -0.3]);
        const jockey = OnnxJockey.fromSession(session as any);

        // First infer fires the async session.run; returns empty pending result
        jockey.infer(race);
        // Await microtasks so the mock promise settles and pendingResult is updated
        await Promise.resolve();

        // Second infer returns the now-populated pendingResult
        const actions = jockey.infer(race);

        expect(actions.size).toBe(4);
        for (let i = 0; i < 4; i++) {
            const a = actions.get(i)!;
            expect(a.tangential).toBeCloseTo(0.5);
            expect(a.normal).toBeCloseTo(-0.3);
        }
    });

    it('excludes the player horse from inference', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(2); // horse 2 is player

        const session = createMockSession([0.8, 0.1]);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);
        await Promise.resolve();

        const actions = jockey.infer(race);

        expect(actions.size).toBe(3);
        expect(actions.has(2)).toBe(false);
        expect(actions.get(0)!.tangential).toBeCloseTo(0.8);
    });

    it('returns empty map when session.run throws', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);

        const session = createMockSession([0, 0]);
        (session.run as jest.Mock).mockRejectedValue(new Error('WASM OOM'));
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);
        await Promise.resolve();

        const actions = jockey.infer(race);

        expect(actions.size).toBe(0);
    });

    it('builds input tensor with correct shape', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 6);
        race.start(0); // horse 0 is player, 5 AI horses

        const session = createMockSession([0, 0]);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);
        await Promise.resolve();

        expect(session.run).toHaveBeenCalledTimes(1);
        const feeds = session.run.mock.calls[0][0] as Record<string, any>;
        const tensor = feeds['obs'];
        expect(tensor.dims).toEqual([5, OBS_SIZE]);
        expect(tensor.data).toBeInstanceOf(Float32Array);
        expect(tensor.data.length).toBe(5 * OBS_SIZE);
    });

    it('dispose releases the session', () => {
        const session = createMockSession([0, 0]);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.dispose();

        expect(session.release).toHaveBeenCalled();
    });

    it('re-entry guard: second infer() while first is pending returns previous result and does not call session.run again', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null); // all horses are AI

        // Create a session whose run() never resolves during this test
        let resolveRun!: (value: unknown) => void;
        const session = {
            inputNames: ['obs'],
            outputNames: ['actions'],
            run: jest.fn(
                () =>
                    new Promise(resolve => {
                        resolveRun = resolve;
                    })
            ),
            release: jest.fn(),
        };
        const jockey = OnnxJockey.fromSession(session as any);

        // First call — fires async run, returns empty pending result
        const firstResult = jockey.infer(race);
        expect(session.run).toHaveBeenCalledTimes(1);
        expect(firstResult.size).toBe(0);

        // Second call before run resolves — must NOT call run again
        const secondResult = jockey.infer(race);
        expect(session.run).toHaveBeenCalledTimes(1);
        // secondResult should equal the pendingResult (still empty at this point)
        expect(secondResult.size).toBe(0);

        // Clean up: let the promise resolve so no leaks
        resolveRun({ actions: { dims: [4, 2], data: new Float32Array(8) } });
        await Promise.resolve();
    });
});
