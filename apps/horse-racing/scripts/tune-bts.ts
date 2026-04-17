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

const ARCHETYPE_NAMES = [
    'stalker',
    'front-runner',
    'closer',
    'speedball',
    'steady',
    'drifter',
] as const;
type ArchetypeName = (typeof ARCHETYPE_NAMES)[number];

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
