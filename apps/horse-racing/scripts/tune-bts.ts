/**
 * Headless (1+1)-ES random search for rebalancing BT archetypes.
 * Run: bun run apps/horse-racing/scripts/tune-bts.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
    ARCHETYPES,
    type BTConfig,
    BTJockey,
    DEFAULT_CONFIG,
    mergeBtConfig,
} from '../src/ai/bt-jockey';
import { createDefaultAttributes } from '../src/simulation/attributes';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import type { TrackSegment } from '../src/simulation/track-types';
import type { InputState } from '../src/simulation/types';

// ============================================================
// Config
// ============================================================

export const ARCHETYPE_NAMES = [
    'stalker',
    'front-runner',
    'closer',
    'speedball',
    'steady',
    'drifter',
] as const;
export type ArchetypeName = (typeof ARCHETYPE_NAMES)[number];

export const TRACK_FILES = ['test_oval', 'tokyo', 'kyoto'] as const;
export type TrackName = (typeof TRACK_FILES)[number];

const ITERS = 100;
const RACES_PER_EVAL = 50;
const MAX_TICKS = 15_000;
const SIGMA_INIT = 0.1;
const SIGMA_MIN = 0.02;
const SIGMA_MAX = 0.3;
const SIGMA_GROW = 1.2;
const SIGMA_SHRINK = 0.85;

// ============================================================
// Track loading
// ============================================================

function loadTrack(name: TrackName): TrackSegment[] {
    const path = join(__dirname, '..', 'public', 'tracks', `${name}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

// ============================================================
// Personality-core params + ranges (mirrors KNOB_META in BtWorkbench.tsx)
// ============================================================

export type ParamKey =
    | 'cruiseHigh'
    | 'kickPhase'
    | 'wKick'
    | 'targetLane'
    | 'wPass'
    | 'wDraft'
    | 'conserveThreshold'
    | 'lateralAggression';

export const PERSONALITY_PARAMS: ParamKey[] = [
    'cruiseHigh',
    'kickPhase',
    'wKick',
    'targetLane',
    'wPass',
    'wDraft',
    'conserveThreshold',
    'lateralAggression',
];

export const PARAM_RANGES: Record<ParamKey, [number, number]> = {
    cruiseHigh: [0.25, 0.95],
    kickPhase: [0.5, 0.96],
    wKick: [0, 3],
    targetLane: [-0.95, 0.0],
    wPass: [0, 3],
    wDraft: [0, 3],
    conserveThreshold: [0, 0.6],
    lateralAggression: [0.1, 1.0],
};

export type Proposal = Record<ArchetypeName, Partial<BTConfig>>;

// ============================================================
// Mulberry32 + Gaussian
// ============================================================

export function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Box-Muller transform: returns one N(0, 1) sample using the supplied uniform rng. */
export function gaussian(rng: () => number): number {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ============================================================
// Perturb
// ============================================================

export function perturb(
    current: Proposal,
    sigma: number,
    rng: () => number
): Proposal {
    const next: Proposal = {} as Proposal;
    for (const name of ARCHETYPE_NAMES) {
        const merged = mergeBtConfig(name, current[name]);
        const overrides: Partial<BTConfig> = { ...current[name] };
        for (const param of PERSONALITY_PARAMS) {
            const [min, max] = PARAM_RANGES[param];
            const range = max - min;
            const eps = gaussian(rng) * sigma * range;
            const raw = merged[param] + eps;
            (overrides as Record<string, number>)[param] = Math.max(
                min,
                Math.min(max, raw)
            );
        }
        next[name] = overrides;
    }
    return next;
}

// ============================================================
// Role anchors — preserve archetype identity through the search
// ============================================================

export function enforceAnchors(p: Proposal): Proposal {
    const out: Proposal = {} as Proposal;
    for (const name of ARCHETYPE_NAMES) {
        out[name] = { ...p[name] };
    }

    // front-runner: kicks early, runs high
    out['front-runner'].kickPhase = Math.min(
        out['front-runner'].kickPhase ?? 0.65,
        0.72
    );
    out['front-runner'].cruiseHigh = Math.max(
        out['front-runner'].cruiseHigh ?? 0.85,
        0.78
    );

    // closer: late kick, prioritizes kick decision
    out.closer.kickPhase = Math.max(out.closer.kickPhase ?? 0.78, 0.78);
    out.closer.wKick = Math.max(out.closer.wKick ?? 1.5, 1.2);

    // speedball: aggressive overtaker
    out.speedball.wPass = Math.max(out.speedball.wPass ?? 1.5, 1.2);

    // stalker: drafting-oriented
    out.stalker.wDraft = Math.max(out.stalker.wDraft ?? 1.3, 1.0);

    // steady: conservative passer
    out.steady.wPass = Math.min(out.steady.wPass ?? 0.5, 0.8);

    // drifter: no anchor (free baseline)
    return out;
}

// ============================================================
// runRace — one headless race with shuffled archetype slots
// ============================================================

export interface RaceOutcome {
    finishOrder: number[]; // horse ids in finishing order
    archetypeBySlot: ArchetypeName[]; // index = horse id
    finished: boolean; // false on DNF (MAX_TICKS hit)
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function runRace(
    segments: TrackSegment[],
    proposal: Proposal,
    seed: number
): Promise<RaceOutcome> {
    const rng = mulberry32(seed);
    const slots = shuffleInPlace([...ARCHETYPE_NAMES], rng);

    const race = new Race(segments, slots.length);
    for (let i = 0; i < slots.length; i++) {
        const h = race.state.horses[i];
        const attrs = createDefaultAttributes();
        h.baseAttributes = attrs;
        h.effectiveAttributes = { ...attrs };
        h.currentStamina = attrs.maxStamina;
    }

    const jockeys = slots.map(
        name => new BTJockey(mergeBtConfig(name, proposal[name]))
    );

    race.start(null);

    let guard = 0;
    while (race.state.phase === 'running' && guard < MAX_TICKS) {
        const inputs = new Map<number, InputState>();
        for (let hid = 0; hid < slots.length; hid++) {
            const m = await jockeys[hid].inferAsync(race, [hid]);
            const inp = m.get(hid);
            if (inp) inputs.set(hid, inp);
        }
        race.tick(inputs);
        guard++;
    }

    return {
        finishOrder: [...race.state.finishOrder],
        archetypeBySlot: slots,
        finished: race.state.phase === 'finished',
    };
}

// ============================================================
// evaluate — 3 tracks × racesPerEval races, returns full metrics
// ============================================================

export interface ArchetypeTrackMetrics {
    appearances: number;
    wins: number;
    placeSum: number;
}

export type Metrics = Record<
    ArchetypeName,
    Record<TrackName, ArchetypeTrackMetrics>
>;

function emptyMetrics(): Metrics {
    const m = {} as Metrics;
    for (const a of ARCHETYPE_NAMES) {
        m[a] = {} as Record<TrackName, ArchetypeTrackMetrics>;
        for (const t of TRACK_FILES) {
            m[a][t] = { appearances: 0, wins: 0, placeSum: 0 };
        }
    }
    return m;
}

export function meanPlace(m: ArchetypeTrackMetrics): number {
    if (m.appearances === 0) return 6.0; // worst possible
    return m.placeSum / m.appearances;
}

export function winRate(m: ArchetypeTrackMetrics): number {
    if (m.appearances === 0) return 0;
    return m.wins / m.appearances;
}

export async function evaluate(
    proposal: Proposal,
    tracks: Record<TrackName, TrackSegment[]>,
    racesPerEval: number,
    iter: number
): Promise<Metrics> {
    const metrics = emptyMetrics();
    for (const trackName of TRACK_FILES) {
        const segs = tracks[trackName];
        for (let r = 0; r < racesPerEval; r++) {
            const seed = iter * 1_000_003 + r;
            const out = await runRace(segs, proposal, seed);
            const finishedSet = new Set(out.finishOrder);
            for (let pos = 0; pos < out.archetypeBySlot.length; pos++) {
                const arch = out.archetypeBySlot[pos];
                const cell = metrics[arch][trackName];
                cell.appearances++;
                if (out.finished && finishedSet.has(pos)) {
                    const place = out.finishOrder.indexOf(pos) + 1;
                    cell.placeSum += place;
                    if (place === 1) cell.wins++;
                } else {
                    // DNF: treat as worst place
                    cell.placeSum += out.archetypeBySlot.length;
                }
            }
        }
    }
    return metrics;
}

// ============================================================
// computeFitness — composite score from metrics + diversity penalty
// ============================================================

const DEAD_LAST_THRESHOLD = 4.0;
const DEAD_LAST_WEIGHT = 0.5;
const DIVERSITY_WEIGHT = 0.05;

function bestMeanPlace(
    perTrack: Record<TrackName, ArchetypeTrackMetrics>
): number {
    let best = Infinity;
    for (const t of TRACK_FILES) {
        const mp = meanPlace(perTrack[t]);
        if (mp < best) best = mp;
    }
    return best;
}

function configVector(proposal: Proposal, name: ArchetypeName): number[] {
    const merged = mergeBtConfig(name, proposal[name]);
    return PERSONALITY_PARAMS.map(p => {
        const [min, max] = PARAM_RANGES[p];
        const v = merged[p];
        return (v - min) / (max - min); // normalized to [0,1]
    });
}

function diversityScore(proposal: Proposal): number {
    const vectors = ARCHETYPE_NAMES.map(n => configVector(proposal, n));
    let total = 0;
    for (let i = 0; i < vectors.length; i++) {
        for (let j = i + 1; j < vectors.length; j++) {
            let sq = 0;
            for (let k = 0; k < vectors[i].length; k++) {
                const d = vectors[i][k] - vectors[j][k];
                sq += d * d;
            }
            total += Math.sqrt(sq);
        }
    }
    return total;
}

export function computeFitness(metrics: Metrics, proposal: Proposal): number {
    let placementTerm = 0;
    let deadLastPenalty = 0;
    for (const a of ARCHETYPE_NAMES) {
        const best = bestMeanPlace(metrics[a]);
        placementTerm -= best;
        if (best > DEAD_LAST_THRESHOLD) {
            deadLastPenalty += best - DEAD_LAST_THRESHOLD;
        }
    }
    const diversity = diversityScore(proposal);
    return (
        placementTerm -
        DEAD_LAST_WEIGHT * deadLastPenalty +
        DIVERSITY_WEIGHT * diversity
    );
}

// ============================================================
// Entrypoint (skeleton)
// ============================================================

async function main(): Promise<void> {
    const itersOverride = process.env.TUNE_ITERS
        ? parseInt(process.env.TUNE_ITERS, 10)
        : ITERS;
    const racesOverride = process.env.TUNE_RACES
        ? parseInt(process.env.TUNE_RACES, 10)
        : RACES_PER_EVAL;
    console.log(`config: iters=${itersOverride} racesPerEval=${racesOverride}`);

    const tracks: Record<TrackName, TrackSegment[]> = {
        test_oval: loadTrack('test_oval'),
        tokyo: loadTrack('tokyo'),
        kyoto: loadTrack('kyoto'),
    };

    // Starting proposal = current ARCHETYPES (empty overrides → mergeBtConfig
    // fills from ARCHETYPES).
    const starting: Proposal = {} as Proposal;
    for (const name of ARCHETYPE_NAMES) starting[name] = {};

    let current = enforceAnchors(starting);
    let best = current;

    console.log('Evaluating starting configs (1 baseline)...');
    let currentMetrics = await evaluate(current, tracks, racesOverride, 0);
    let currentFit = computeFitness(currentMetrics, current);
    let bestFit = currentFit;
    let bestMetrics = currentMetrics;
    console.log(`baseline fitness=${currentFit.toFixed(4)}`);

    let sigma = SIGMA_INIT;
    const rng = mulberry32(2026_04_17);

    for (let iter = 1; iter <= itersOverride; iter++) {
        const proposal = enforceAnchors(perturb(current, sigma, rng));
        const metrics = await evaluate(proposal, tracks, racesOverride, iter);
        const fit = computeFitness(metrics, proposal);
        const accepted = fit > currentFit;
        const delta = fit - currentFit;
        const flag = accepted ? 'ACCEPTED' : 'rejected';
        console.log(
            `[${iter.toString().padStart(3, ' ')}/${itersOverride}] ` +
                `fitness=${fit.toFixed(4)}  Δ=${delta >= 0 ? '+' : ''}${delta.toFixed(4)}  ` +
                `${flag}  σ=${sigma.toFixed(3)}  best=${bestFit.toFixed(4)}`
        );
        if (accepted) {
            current = proposal;
            currentFit = fit;
            sigma = Math.min(SIGMA_MAX, sigma * SIGMA_GROW);
            if (fit > bestFit) {
                best = proposal;
                bestFit = fit;
                bestMetrics = metrics;
            }
        } else {
            sigma = Math.max(SIGMA_MIN, sigma * SIGMA_SHRINK);
        }
        if (iter % 10 === 0) {
            console.log('---- per-archetype best mean place ----');
            for (const a of ARCHETYPE_NAMES) {
                const perTrack = TRACK_FILES.map(t => {
                    const cell = bestMetrics[a][t];
                    return `${t}=${meanPlace(cell).toFixed(2)}`;
                }).join('  ');
                console.log(`  ${a.padEnd(13)} ${perTrack}`);
            }
            console.log('---------------------------------------');
        }
    }

    console.log(`\nSearch complete. best fitness=${bestFit.toFixed(4)}`);
    console.log('Best configs:');
    for (const a of ARCHETYPE_NAMES) {
        const merged = mergeBtConfig(a, best[a]);
        const compact = PERSONALITY_PARAMS.map(
            p => `${p}=${merged[p].toFixed(3)}`
        ).join(' ');
        console.log(`  ${a.padEnd(13)} ${compact}`);
    }

    // Task 9 (next) appends JSON output here using the same in-scope
    // variables: itersOverride, racesOverride, best, bestFit, bestMetrics.
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
