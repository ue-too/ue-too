/**
 * Headless multi-race BT runner for web tuning (parity with Python `tune_bt.py`).
 * No Pixi — safe to run in the background with await between races.
 */

import { BTJockey, mergeBtConfig, type BTConfig } from '../ai/bt-jockey';
import { createDefaultAttributes, createRandomizedAttributes } from './attributes';
import { Race } from './race';
import type { TrackSegment } from './track-types';
import type { InputState } from './types';

const MAX_TICKS = 15000;

export interface BtBatchRequest {
    races: number;
    horseCount: number;
    /** One archetype id per slot (length must equal `horseCount`). */
    slotArchetypes: string[];
    randomizeAttributes: boolean;
    /** Reproducible batch when set (mulberry32 stream for attr rolls). */
    seed?: number;
    /** Merged after each slot’s archetype (same for every horse). */
    globalOverrides?: Partial<BTConfig>;
    onProgress?: (completed: number, total: number) => void;
}

export interface BtArchetypeAggregate {
    wins: number;
    placeSum: number;
    appearances: number;
}

export interface BtBatchResult {
    /** Stats keyed by archetype name */
    byArchetype: Record<string, BtArchetypeAggregate>;
    meanTicks: number;
    racesCompleted: number;
}

function mulberry32(seed: number): () => number {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function runOneBtRace(
    segments: TrackSegment[],
    horseCount: number,
    slotArchetypes: string[],
    rng: () => number,
    randomize: boolean,
    globalOverrides?: Partial<BTConfig>
): Promise<{
    ticks: number;
    archetypesByHorseId: string[];
    finishOrder: number[];
}> {
    const race = new Race(segments, horseCount);
    const archById: string[] = [];
    for (let i = 0; i < horseCount; i++) {
        archById[i] = slotArchetypes[i] ?? 'stalker';
        const h = race.state.horses[i];
        const attrs = randomize
            ? createRandomizedAttributes(rng)
            : createDefaultAttributes();
        h.baseAttributes = attrs;
        h.effectiveAttributes = { ...attrs };
        h.currentStamina = attrs.maxStamina;
    }

    const jockeys = archById.map(name =>
        new BTJockey(mergeBtConfig(name, globalOverrides))
    );

    race.start(null);
    let guard = 0;
    while (race.state.phase === 'running' && guard < MAX_TICKS) {
        const inputs = new Map<number, InputState>();
        for (let hid = 0; hid < horseCount; hid++) {
            const m = await jockeys[hid].inferAsync(race, [hid]);
            const inp = m.get(hid);
            if (inp) inputs.set(hid, inp);
        }
        race.tick(inputs);
        guard++;
    }
    if (race.state.phase !== 'finished') {
        throw new Error(
            `BT batch race did not finish (${guard} ticks, phase=${race.state.phase})`
        );
    }
    return {
        ticks: race.state.tick,
        archetypesByHorseId: archById,
        finishOrder: [...race.state.finishOrder],
    };
}

/**
 * Run many headless BT-only races and aggregate win rates / mean place by archetype.
 */
export async function runBtBatch(
    segments: TrackSegment[],
    req: BtBatchRequest
): Promise<BtBatchResult> {
    const hc = Math.max(2, Math.min(8, Math.floor(req.horseCount)));
    const nRaces = Math.max(1, Math.min(5000, Math.floor(req.races)));
    let slots = req.slotArchetypes.slice(0, hc);
    if (slots.length < hc) {
        const order = [
            'front-runner',
            'closer',
            'stalker',
            'speedball',
            'steady',
            'drifter',
        ];
        for (let i = slots.length; i < hc; i++) {
            slots.push(order[i % order.length]);
        }
    }
    slots = slots.slice(0, hc);

    const byArch: Record<string, BtArchetypeAggregate> = {};
    const ensure = (name: string): BtArchetypeAggregate => {
        if (!byArch[name]) {
            byArch[name] = { wins: 0, placeSum: 0, appearances: 0 };
        }
        return byArch[name];
    };
    for (const name of new Set(slots)) {
        ensure(name);
    }

    let tickSum = 0;

    for (let r = 0; r < nRaces; r++) {
        const seed =
            req.seed !== undefined ? req.seed * 1000003 + r : Date.now() + r;
        const rng = mulberry32(seed >>> 0);

        const { ticks, archetypesByHorseId, finishOrder } = await runOneBtRace(
            segments,
            hc,
            slots,
            rng,
            req.randomizeAttributes,
            req.globalOverrides
        );
        tickSum += ticks;
        for (let p = 0; p < finishOrder.length; p++) {
            const hid = finishOrder[p];
            const name = archetypesByHorseId[hid];
            const row = ensure(name);
            row.appearances++;
            row.placeSum += p + 1;
            if (p === 0) row.wins++;
        }
        req.onProgress?.(r + 1, nRaces);
        // Yield so the browser can repaint between races.
        if (r % 3 === 2) {
            await new Promise<void>(resolve => {
                setTimeout(resolve, 0);
            });
        }
    }

    return {
        byArchetype: byArch,
        meanTicks: tickSum / nRaces,
        racesCompleted: nRaces,
    };
}
