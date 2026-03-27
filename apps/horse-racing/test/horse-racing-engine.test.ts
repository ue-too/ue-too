import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { HorseRacingEngine } from '../src/simulation/horse-racing-engine';
import type { HorseAction } from '../src/simulation/horse-racing-engine';

function loadTrack(name = 'exp_track_8.json') {
    const path = join(__dirname, '../public/tracks', name);
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

function zeroActions(count: number): HorseAction[] {
    return Array.from({ length: count }, () => ({ extraTangential: 0, extraNormal: 0 }));
}

describe('HorseRacingEngine', () => {
    it('constructs without browser globals', () => {
        const segments = loadTrack();
        const engine = new HorseRacingEngine(segments);
        expect(engine.horseIds.length).toBe(4);
        expect(engine.navigators.length).toBe(4);
    });

    it('step returns one observation per horse', () => {
        const engine = new HorseRacingEngine(loadTrack());
        const obs = engine.step(zeroActions(4));
        expect(obs.length).toBe(4);
        for (const o of obs) {
            expect(o.position).toBeDefined();
            expect(o.velocity).toBeDefined();
            expect(typeof o.tangentialVel).toBe('number');
            expect(typeof o.normalVel).toBe('number');
            expect(typeof o.segmentIndex).toBe('number');
        }
    });

    it('auto-cruises toward target speed with zero actions', () => {
        const engine = new HorseRacingEngine(loadTrack());
        // Run for ~10s of sim time (300 ticks × 8 substeps × 1/240s ≈ 10s)
        for (let t = 0; t < 300; t++) {
            engine.step(zeroActions(4));
        }
        const obs = engine.step(zeroActions(4));
        // After enough time, tangential velocity should be positive and
        // moving toward the target speed (13). On curves the equilibrium
        // speed is lower due to centripetal forces, so we check > 5.
        for (const o of obs) {
            expect(o.tangentialVel).toBeGreaterThan(5);
            expect(o.tangentialVel).toBeLessThanOrEqual(20);
        }
    });

    it('produces deterministic results', () => {
        const segments = loadTrack();
        const actions: HorseAction[] = [
            { extraTangential: 5, extraNormal: -2 },
            { extraTangential: 0, extraNormal: 0 },
            { extraTangential: -3, extraNormal: 1 },
            { extraTangential: 0, extraNormal: 0 },
        ];

        // Run A
        const engineA = new HorseRacingEngine(segments);
        for (let t = 0; t < 60; t++) engineA.step(actions);
        const obsA = engineA.step(actions);

        // Run B (fresh engine, same actions)
        const engineB = new HorseRacingEngine(segments);
        for (let t = 0; t < 60; t++) engineB.step(actions);
        const obsB = engineB.step(actions);

        for (let i = 0; i < obsA.length; i++) {
            expect(obsA[i].position.x).toBe(obsB[i].position.x);
            expect(obsA[i].position.y).toBe(obsB[i].position.y);
            expect(obsA[i].tangentialVel).toBe(obsB[i].tangentialVel);
            expect(obsA[i].normalVel).toBe(obsB[i].normalVel);
        }
    });

    it('reset restores initial state', () => {
        const engine = new HorseRacingEngine(loadTrack());
        const initialPositions = engine.getHorsePositions();

        // Run a few steps
        for (let t = 0; t < 30; t++) {
            engine.step(zeroActions(4));
        }

        // Positions should have changed
        const movedPositions = engine.getHorsePositions();
        const hasMoved = movedPositions.some(
            (p, i) => p.x !== initialPositions[i].x || p.y !== initialPositions[i].y,
        );
        expect(hasMoved).toBe(true);

        // Reset and check
        engine.reset();
        const resetPositions = engine.getHorsePositions();
        for (let i = 0; i < resetPositions.length; i++) {
            expect(resetPositions[i].x).toBeCloseTo(initialPositions[i].x, 5);
            expect(resetPositions[i].y).toBeCloseTo(initialPositions[i].y, 5);
        }
    });

    it('respects custom config', () => {
        const engine = new HorseRacingEngine(loadTrack(), { horseCount: 2 });
        expect(engine.horseIds.length).toBe(2);
        expect(engine.config.horseCount).toBe(2);
    });

    it('player action affects speed beyond auto-cruise', () => {
        const segments = loadTrack();
        const engineBoost = new HorseRacingEngine(segments);
        const engineZero = new HorseRacingEngine(segments);

        const boostActions: HorseAction[] = Array.from({ length: 4 }, () => ({
            extraTangential: 10,
            extraNormal: 0,
        }));

        for (let t = 0; t < 60; t++) {
            engineBoost.step(boostActions);
            engineZero.step(zeroActions(4));
        }

        const obsBoost = engineBoost.step(boostActions);
        const obsZero = engineZero.step(zeroActions(4));

        // Boosted horse should be faster or further ahead
        expect(obsBoost[0].tangentialVel).toBeGreaterThan(obsZero[0].tangentialVel);
    });
});
