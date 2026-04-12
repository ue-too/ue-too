/**
 * Headless validation server for the horse-racing simulation.
 *
 * Exposes the v2 Race over HTTP so a Python RL environment can validate
 * its reimplemented physics against the TypeScript ground truth.
 *
 * Start with: `bun run apps/horse-racing/src/simulation/server.ts`
 */
import { join } from 'path';

import { buildObservations } from './observation';
import { Race } from './race';
import { parseTrackJson } from './track-from-json';
import { MAX_HORSES, type InputState } from './types';

const TRACKS_DIR = join(import.meta.dir, '../../public/tracks');

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function startServer(port: number) {
    let race: Race | null = null;
    let prevProgress: number[] = [];

    async function handleReset(req: Request): Promise<Response> {
        const body = (await req.json()) as {
            track?: string;
            horseCount?: number;
        };
        const trackName = body.track ?? 'tokyo';
        const horseCount = Math.max(
            1,
            Math.min(MAX_HORSES, body.horseCount ?? 8),
        );

        const trackPath = join(TRACKS_DIR, `${trackName}.json`);
        const trackFile = Bun.file(trackPath);
        if (!(await trackFile.exists())) {
            return jsonResponse(
                { error: `Track "${trackName}" not found` },
                404,
            );
        }

        let segments;
        try {
            const raw = await trackFile.json();
            segments = parseTrackJson(raw);
        } catch {
            return jsonResponse(
                { error: `Track "${trackName}" is malformed` },
                400,
            );
        }

        race = new Race(segments, horseCount);
        race.start(null);

        const observations = buildObservations(race);
        prevProgress = race.state.horses.map((h) => h.trackProgress);

        return jsonResponse({
            observations: observations.map((o) => Array.from(o)),
            horseCount,
        });
    }

    async function handleStep(req: Request): Promise<Response> {
        const body = (await req.json()) as { actions?: number[][] };

        if (!race) {
            return jsonResponse(
                { error: 'No active race. Call /reset first.' },
                400,
            );
        }
        if (race.state.phase === 'finished') {
            return jsonResponse(
                { error: 'Race is finished. Call /reset.' },
                400,
            );
        }

        const actions = body.actions ?? [];
        const expected = race.state.horses.length;
        if (actions.length !== expected) {
            return jsonResponse(
                {
                    error: `Expected ${expected} actions, got ${actions.length}`,
                },
                400,
            );
        }

        const inputs = new Map<number, InputState>();
        for (let i = 0; i < actions.length; i++) {
            inputs.set(i, {
                tangential: actions[i][0],
                normal: actions[i][1],
            });
        }

        race.tick(inputs);

        const observations = buildObservations(race);
        const currentProgress = race.state.horses.map(
            (h) => h.trackProgress,
        );
        const rewards = currentProgress.map(
            (p, i) => p - prevProgress[i],
        );
        prevProgress = currentProgress;

        const dones = race.state.horses.map((h) => h.finished);

        return jsonResponse({
            observations: observations.map((o) => Array.from(o)),
            rewards,
            dones,
            tick: race.state.tick,
        });
    }

    return Bun.serve({
        port,
        fetch(req) {
            const url = new URL(req.url);

            if (req.method === 'GET' && url.pathname === '/health') {
                return jsonResponse({ status: 'ok' });
            }
            if (req.method === 'POST' && url.pathname === '/reset') {
                return handleReset(req);
            }
            if (req.method === 'POST' && url.pathname === '/step') {
                return handleStep(req);
            }

            return jsonResponse({ error: 'Not found' }, 404);
        },
    });
}

if (import.meta.main) {
    const port = Number(process.env.PORT) || 3456;
    const server = startServer(port);
    console.log(`Horse racing server running on port ${server.port}`);
}
