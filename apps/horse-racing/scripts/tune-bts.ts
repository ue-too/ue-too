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

const TRACK_FILES = ['simple_oval', 'tokyo', 'kyoto'] as const;
type TrackName = (typeof TRACK_FILES)[number];

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
// Entrypoint (skeleton)
// ============================================================

async function main(): Promise<void> {
    const tracks: Record<TrackName, TrackSegment[]> = {
        simple_oval: loadTrack('simple_oval'),
        tokyo: loadTrack('tokyo'),
        kyoto: loadTrack('kyoto'),
    };
    console.log(
        `Loaded tracks: ${Object.entries(tracks)
            .map(([n, segs]) => `${n}(${segs.length} segs)`)
            .join(', ')}`
    );
    console.log(`Archetypes: ${ARCHETYPE_NAMES.join(', ')}`);
    console.log('Skeleton OK — search loop not yet implemented.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
