/**
 * Headless validation server for the horse-racing simulation.
 *
 * @remarks
 * Exposes the {@link HorseRacingEngine} over HTTP so a Python RL environment
 * can validate its reimplemented physics against the TypeScript ground truth.
 *
 * Start with: `bun run apps/horse-racing/src/server.ts`
 *
 * @example
 * ```bash
 * curl -X POST http://localhost:3456/simulate \
 *   -H 'Content-Type: application/json' \
 *   -d '{"track":"exp_track_8","steps":100,"actions":[]}'
 * ```
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from './simulation/track-from-json';
import { HorseRacingEngine } from './simulation/horse-racing-engine';
import type { HorseAction } from './simulation/horse-racing-engine';

const PORT = Number(process.env.PORT) || 3456;
const TRACKS_DIR = join(import.meta.dir, '../public/tracks');

type SimulateRequest = {
    /** Track filename without extension, e.g. "exp_track_8" */
    track: string;
    /** Number of ticks to simulate */
    steps: number;
    /**
     * Actions per step per horse. If empty or shorter than `steps`, remaining
     * steps use zero actions.
     * Shape: actions[stepIndex][horseIndex]
     */
    actions: HorseAction[][];
};

type TrajectoryPoint = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tangentialVel: number;
    normalVel: number;
};

function loadTrack(name: string) {
    const path = join(TRACKS_DIR, `${name}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === '/health') {
            return Response.json({ status: 'ok' });
        }

        if (url.pathname === '/simulate' && req.method === 'POST') {
            const body = (await req.json()) as SimulateRequest;
            const { track, steps, actions } = body;

            let segments;
            try {
                segments = loadTrack(track);
            } catch {
                return Response.json(
                    { error: `Track "${track}" not found` },
                    { status: 404 },
                );
            }

            const engine = new HorseRacingEngine(segments);
            const horseCount = engine.horseIds.length;
            const zeroActions: HorseAction[] = Array.from(
                { length: horseCount },
                () => ({ extraTangential: 0, extraNormal: 0 }),
            );

            const trajectories: TrajectoryPoint[][] = [];

            for (let t = 0; t < steps; t++) {
                const stepActions = actions[t] ?? zeroActions;
                const obs = engine.step(stepActions);
                trajectories.push(
                    obs.map((o) => ({
                        x: o.position.x,
                        y: o.position.y,
                        vx: o.velocity.x,
                        vy: o.velocity.y,
                        tangentialVel: o.tangentialVel,
                        normalVel: o.normalVel,
                    })),
                );
            }

            return Response.json({ trajectories });
        }

        return Response.json({ error: 'Not found' }, { status: 404 });
    },
});

console.log(`Horse racing validation server running on http://localhost:${PORT}`);
