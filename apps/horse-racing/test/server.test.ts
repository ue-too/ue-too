import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OBS_SIZE } from '../src/simulation/observation';
import { startServer } from '../src/simulation/server';

const PORT = 3457;
const BASE = `http://localhost:${PORT}`;

let server: ReturnType<typeof startServer>;

beforeAll(() => {
    server = startServer(PORT);
});

afterAll(() => {
    server.stop(true);
});

describe('validation server', () => {
    it('GET /health returns ok', async () => {
        const res = await fetch(`${BASE}/health`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ status: 'ok' });
    });

    it('POST /step before /reset returns 400', async () => {
        // Force a fresh server state by not calling /reset
        // The server module-level `race` starts as null, but prior tests
        // in the same process may have set it. We test the error message.
        const res = await fetch(`${BASE}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions: [] }),
        });
        // Could be 400 for "no active race" or "wrong action count"
        expect(res.status).toBe(400);
    });

    it('POST /reset creates race and returns observations', async () => {
        const res = await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'tokyo', horseCount: 4 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.horseCount).toBe(4);
        expect(body.observations).toHaveLength(4);
        expect(body.observations[0]).toHaveLength(OBS_SIZE);
    });

    it('POST /step advances the race', async () => {
        // Reset first to ensure clean state
        await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'tokyo', horseCount: 4 }),
        });

        const actions = Array.from({ length: 4 }, () => [1.0, 0.0]);
        const res = await fetch(`${BASE}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.observations).toHaveLength(4);
        expect(body.rewards).toHaveLength(4);
        expect(body.dones).toHaveLength(4);
        expect(body.tick).toBe(1);
    });

    it('POST /reset with invalid track returns 404', async () => {
        const res = await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'nonexistent_track' }),
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toContain('nonexistent_track');
    });

    it('POST /reset with horseCount > 24 clamps to 24', async () => {
        const res = await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'tokyo', horseCount: 50 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.horseCount).toBe(24);
        expect(body.observations).toHaveLength(24);
    });

    it('POST /step with wrong action count returns 400', async () => {
        // Reset with 4 horses
        await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'tokyo', horseCount: 4 }),
        });

        // Send 2 actions instead of 4
        const res = await fetch(`${BASE}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actions: [
                    [1, 0],
                    [0, 0],
                ],
            }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Expected 4 actions, got 2');
    });
});
