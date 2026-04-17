/**
 * Manual BT fine-tuning diagnostic harness.
 *
 * Runs N races per track with the current ARCHETYPES and prints a
 * per-archetype × per-track table of mean place and mean stamina at finish.
 * Intended for the hand-tuning loop described in
 * `apps/horse-racing/src/ai/BT-TUNING.md`.
 *
 * Run:        bun run apps/horse-racing/scripts/diagnose-bts.ts
 * More races: DIAG_RACES=10 bun run apps/horse-racing/scripts/diagnose-bts.ts
 * Fixed seed: DIAG_SEED=42 bun run apps/horse-racing/scripts/diagnose-bts.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { BTJockey, mergeBtConfig } from '../src/ai/bt-jockey';
import { createDefaultAttributes } from '../src/simulation/attributes';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import type { TrackSegment } from '../src/simulation/track-types';
import type { InputState } from '../src/simulation/types';

const ARCHETYPE_NAMES = [
    'stalker',
    'front-runner',
    'closer',
    'speedball',
    'steady',
    'drifter',
] as const;
type ArchetypeName = (typeof ARCHETYPE_NAMES)[number];

const TRACKS = ['test_oval', 'tokyo', 'kyoto'] as const;
type Track = (typeof TRACKS)[number];

const DIAG_RACES = process.env.DIAG_RACES
    ? parseInt(process.env.DIAG_RACES, 10)
    : 5;
const DIAG_SEED = process.env.DIAG_SEED
    ? parseInt(process.env.DIAG_SEED, 10)
    : 1;
const MAX_TICKS = 15_000;

// Deterministic PRNG so successive diagnostic runs are comparable.
function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface RaceStats {
    finishOrder: number[];
    archetypeBySlot: ArchetypeName[];
    finished: boolean;
    /** Stamina fraction [0..1] for each horse at the moment it finished (or race end if DNF). */
    staminaAtFinish: number[];
}

function loadTrack(name: Track): TrackSegment[] {
    const path = join(__dirname, '..', 'public', 'tracks', `${name}.json`);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')));
}

async function runDiagnosticRace(
    segments: TrackSegment[],
    seed: number
): Promise<RaceStats> {
    const rng = mulberry32(seed);
    const slots: ArchetypeName[] = [...ARCHETYPE_NAMES];
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    const race = new Race(segments, slots.length);
    for (let i = 0; i < slots.length; i++) {
        const h = race.state.horses[i];
        const attrs = createDefaultAttributes();
        h.baseAttributes = attrs;
        h.effectiveAttributes = { ...attrs };
        h.currentStamina = attrs.maxStamina;
    }
    const jockeys = slots.map(
        name => new BTJockey(mergeBtConfig(name, {}))
    );

    const staminaAtFinish = new Array<number>(slots.length).fill(0);
    const captured = new Set<number>();

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
        // Snapshot stamina for horses that finished this tick.
        for (const h of race.state.horses) {
            if (h.finished && !captured.has(h.id)) {
                staminaAtFinish[h.id] =
                    h.currentStamina / h.baseAttributes.maxStamina;
                captured.add(h.id);
            }
        }
        guard++;
    }
    // DNFs: fall back to whatever stamina they have at race end.
    for (const h of race.state.horses) {
        if (!captured.has(h.id)) {
            staminaAtFinish[h.id] =
                h.currentStamina / h.baseAttributes.maxStamina;
        }
    }

    return {
        finishOrder: [...race.state.finishOrder],
        archetypeBySlot: slots,
        finished: race.state.phase === 'finished',
        staminaAtFinish,
    };
}

interface Cell {
    placeSum: number;
    stamSum: number;
    count: number;
    dnfs: number;
    wins: number;
}

async function main(): Promise<void> {
    console.log(
        `Diagnostic: ${DIAG_RACES} races × ${TRACKS.length} tracks (seed=${DIAG_SEED})`
    );

    const tracks: Record<Track, TrackSegment[]> = {} as Record<
        Track,
        TrackSegment[]
    >;
    for (const t of TRACKS) tracks[t] = loadTrack(t);

    const stats = {} as Record<ArchetypeName, Record<Track, Cell>>;
    for (const a of ARCHETYPE_NAMES) {
        stats[a] = {} as Record<Track, Cell>;
        for (const t of TRACKS) {
            stats[a][t] = {
                placeSum: 0,
                stamSum: 0,
                count: 0,
                dnfs: 0,
                wins: 0,
            };
        }
    }

    const t0 = performance.now();
    let raceNum = 0;
    for (const trackName of TRACKS) {
        for (let r = 0; r < DIAG_RACES; r++) {
            raceNum++;
            const seed = DIAG_SEED * 1_000_003 + raceNum;
            const out = await runDiagnosticRace(tracks[trackName], seed);
            for (let slot = 0; slot < out.archetypeBySlot.length; slot++) {
                const arch = out.archetypeBySlot[slot];
                const cell = stats[arch][trackName];
                cell.count++;
                if (out.finished) {
                    const place = out.finishOrder.indexOf(slot) + 1;
                    cell.placeSum += place;
                    if (place === 1) cell.wins++;
                } else {
                    cell.dnfs++;
                    cell.placeSum += out.archetypeBySlot.length;
                }
                cell.stamSum += out.staminaAtFinish[slot] * 100;
            }
        }
    }
    const elapsed = (performance.now() - t0) / 1000;

    // --- Print table ---
    console.log(
        `\nDone in ${elapsed.toFixed(1)}s (${DIAG_RACES * TRACKS.length} races).\n`
    );
    const colWidth = 14;
    let header = 'archetype'.padEnd(14);
    for (const t of TRACKS) header += t.padEnd(colWidth);
    console.log(header);
    let sub = ' '.repeat(14);
    for (const _t of TRACKS) sub += 'place/stam/wins'.padEnd(colWidth);
    console.log(sub);

    for (const arch of ARCHETYPE_NAMES) {
        let line = arch.padEnd(14);
        for (const t of TRACKS) {
            const s = stats[arch][t];
            const mp = s.count > 0 ? s.placeSum / s.count : 0;
            const stam = s.count > 0 ? s.stamSum / s.count : 0;
            const wr = s.count > 0 ? (s.wins / s.count) * 100 : 0;
            const dnf = s.dnfs > 0 ? `!${s.dnfs}` : '';
            const cellStr = `${mp.toFixed(1)}/${Math.round(stam).toString().padStart(2)}%/${Math.round(wr).toString().padStart(2)}%${dnf}`;
            line += cellStr.padEnd(colWidth);
        }
        console.log(line);
    }

    // --- Automated warnings ---
    console.log('');
    for (const arch of ARCHETYPE_NAMES) {
        const places = TRACKS.map(t => {
            const s = stats[arch][t];
            return s.count > 0 ? s.placeSum / s.count : 0;
        });
        const best = Math.min(...places);
        const worst = Math.max(...places);
        if (best > 4.0) {
            console.log(
                `⚠  ${arch}: best track mean place ${best.toFixed(2)} (> 4.0) — no competitive track`
            );
        }
        if (worst - best < 0.3 && best < 4.0) {
            console.log(
                `⚠  ${arch}: flat across tracks (spread ${(worst - best).toFixed(2)}) — no track niche`
            );
        }
        for (const t of TRACKS) {
            if (stats[arch][t].dnfs > 0) {
                console.log(
                    `❌ ${arch} on ${t}: ${stats[arch][t].dnfs} DNF(s)`
                );
            }
        }
    }
}

if (import.meta.main) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
