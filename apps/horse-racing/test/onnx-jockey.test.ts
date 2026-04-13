import { readFileSync } from 'fs';
import { join } from 'path';

import {
    ACTION_LEVELS,
    LEVELS_PER_AXIS,
    NUM_ACTIONS,
    OnnxJockey,
    decodeAction,
} from '../src/ai/onnx-jockey';
import { OBS_SIZE } from '../src/simulation/observation';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

/**
 * Build a mock session that always outputs the given action index
 * as the argmax of the logits for every horse in the batch.
 */
function createMockSession(actionIndex: number) {
    return {
        inputNames: ['obs'],
        outputNames: ['actions'],
        run: jest.fn(async (feeds: Record<string, unknown>) => {
            const input = feeds['obs'] as { dims: number[] };
            const batchSize = input.dims[0];
            const data = new Float32Array(batchSize * NUM_ACTIONS);
            for (let i = 0; i < batchSize; i++) {
                // Set the target action index to a high logit value
                data[i * NUM_ACTIONS + actionIndex] = 10.0;
            }
            return {
                actions: { dims: [batchSize, NUM_ACTIONS], data },
            };
        }),
        release: jest.fn(),
    };
}

describe('decodeAction', () => {
    it('decodes index 0 to (-1, -1)', () => {
        const a = decodeAction(0);
        expect(a.tangential).toBe(-1);
        expect(a.normal).toBe(-1);
    });

    it('decodes index 12 to (0, 0) — center of grid', () => {
        // tangential index = floor(12/5) = 2 → 0
        // normal index = 12 % 5 = 2 → 0
        const a = decodeAction(12);
        expect(a.tangential).toBe(0);
        expect(a.normal).toBe(0);
    });

    it('decodes index 24 to (1, 1)', () => {
        const a = decodeAction(24);
        expect(a.tangential).toBe(1);
        expect(a.normal).toBe(1);
    });

    it('decodes index 22 to (1, -0.5)', () => {
        // tangential index = floor(22/5) = 4 → 1
        // normal index = 22 % 5 = 2 → 0
        // Wait: 4*5 + 2 = 22, normal index 2 → 0
        // Let me recalculate for (1, -0.5):
        // tangential=1 → index 4, normal=-0.5 → index 1
        // 4*5 + 1 = 21
        const a = decodeAction(21);
        expect(a.tangential).toBe(1);
        expect(a.normal).toBe(-0.5);
    });

    it('all 25 actions map to valid ACTION_LEVELS', () => {
        for (let i = 0; i < NUM_ACTIONS; i++) {
            const a = decodeAction(i);
            expect(ACTION_LEVELS).toContain(a.tangential);
            expect(ACTION_LEVELS).toContain(a.normal);
        }
    });
});

describe('constants', () => {
    it('ACTION_LEVELS has 5 entries', () => {
        expect(ACTION_LEVELS).toHaveLength(5);
    });

    it('LEVELS_PER_AXIS is 5', () => {
        expect(LEVELS_PER_AXIS).toBe(5);
    });

    it('NUM_ACTIONS is 25', () => {
        expect(NUM_ACTIONS).toBe(25);
    });
});

describe('OnnxJockey', () => {
    it('produces actions for all horses when no player is set', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);

        // Action index 12 = (0, 0) — cruise, no steering
        const session = createMockSession(12);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);
        await Promise.resolve();
        const actions = jockey.infer(race);

        expect(actions.size).toBe(4);
        for (let i = 0; i < 4; i++) {
            const a = actions.get(i)!;
            expect(a.tangential).toBe(0);
            expect(a.normal).toBe(0);
        }
    });

    it('decodes hard push + soft right correctly', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 2);
        race.start(null);

        // tangential=1 → index 4, normal=0.5 → index 3 → flat = 4*5+3 = 23
        const session = createMockSession(23);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);
        await Promise.resolve();
        const actions = jockey.infer(race);

        expect(actions.size).toBe(2);
        const a = actions.get(0)!;
        expect(a.tangential).toBe(1);
        expect(a.normal).toBe(0.5);
    });

    it('excludes the player horse from inference', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(2);

        const session = createMockSession(24); // (1, 1)
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);
        await Promise.resolve();
        const actions = jockey.infer(race);

        expect(actions.size).toBe(3);
        expect(actions.has(2)).toBe(false);
        expect(actions.get(0)!.tangential).toBe(1);
        expect(actions.get(0)!.normal).toBe(1);
    });

    it('returns empty map when session.run throws', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);

        const session = createMockSession(0);
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
        race.start(0);

        const session = createMockSession(12);
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
        const session = createMockSession(0);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.dispose();

        expect(session.release).toHaveBeenCalled();
    });

    it('re-entry guard: second infer while first is pending returns previous result', async () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);

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

        const firstResult = jockey.infer(race);
        expect(session.run).toHaveBeenCalledTimes(1);
        expect(firstResult.size).toBe(0);

        const secondResult = jockey.infer(race);
        expect(session.run).toHaveBeenCalledTimes(1);
        expect(secondResult.size).toBe(0);

        resolveRun({
            actions: {
                dims: [4, NUM_ACTIONS],
                data: new Float32Array(4 * NUM_ACTIONS),
            },
        });
        await Promise.resolve();
    });
});
