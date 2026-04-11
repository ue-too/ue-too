import type { Point } from '@ue-too/math';
import { TrackNavigator } from '../track-navigator';
import type { TrackSegment } from '../track-types';

import { stepPhysics } from './physics';
import {
    FIXED_DT,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
    type RaceState,
} from './types';

const HORSE_COLORS = [0xc9a227, 0x4169e1, 0xe53935, 0x43a047];

/**
 * Build four identical horses lined up at the start of the track.
 * Each horse gets its own `TrackNavigator` instance — sharing one navigator
 * across horses corrupts its per-horse `currentIndex` / `curveEntryRadius`.
 *
 * Horses are spread across the track width by setting their initial position
 * to `segment.startPoint + laneOffset * outwardNormal`. Four lanes fit in
 * `[-TRACK_HALF_WIDTH * 0.6, +TRACK_HALF_WIDTH * 0.6]` so no horse starts
 * clipped into a rail.
 */
export function spawnHorses(segments: TrackSegment[]): Horse[] {
    if (segments.length === 0) {
        throw new Error('spawnHorses: track has no segments');
    }
    const first = segments[0];
    // Use one temporary navigator to pull the start-frame outward normal.
    // Horses receive their own instances below.
    const probe = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
    const startPoint: Point = { x: first.startPoint.x, y: first.startPoint.y };
    const frame = probe.getTrackFrame(startPoint);

    const laneSpacing = (TRACK_HALF_WIDTH * 1.2) / 3; // 4 horses, 3 gaps
    const laneOffsets = [-1.5, -0.5, 0.5, 1.5].map((i) => i * laneSpacing);

    return HORSE_COLORS.map((color, id) => {
        const pos: Point = {
            x: startPoint.x + frame.normal.x * laneOffsets[id],
            y: startPoint.y + frame.normal.y * laneOffsets[id],
        };
        return {
            id,
            color,
            pos,
            tangentialVel: 0,
            normalVel: 0,
            trackProgress: 0,
            navigator: new TrackNavigator(segments, 0, TRACK_HALF_WIDTH),
            finished: false,
            finishOrder: null,
        };
    });
}

/**
 * Race state machine: gate → running → finished. The sim loop calls
 * `tick(input)` at fixed timestep; React calls `start(playerHorseId)` and
 * `reset()` imperatively.
 */
export class Race {
    state: RaceState;
    private segments: TrackSegment[];

    constructor(segments: TrackSegment[]) {
        this.segments = segments;
        this.state = {
            phase: 'gate',
            horses: spawnHorses(segments),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
    }

    start(playerHorseId: number | null): void {
        if (this.state.phase !== 'gate') return;
        this.state.playerHorseId = playerHorseId;
        this.state.phase = 'running';
        this.state.tick = 0;
    }

    tick(input: InputState): void {
        if (this.state.phase !== 'running') return;

        stepPhysics(this.state.horses, input, this.state.playerHorseId, FIXED_DT);

        for (const h of this.state.horses) {
            if (!h.finished && h.trackProgress >= 1.0) {
                h.finished = true;
                h.finishOrder = this.state.finishOrder.length + 1;
                this.state.finishOrder.push(h.id);
            }
        }

        const playerId = this.state.playerHorseId;
        const isPlayerMode = playerId !== null;
        const player = isPlayerMode ? this.state.horses[playerId] : null;
        const allFinished = this.state.horses.every((h) => h.finished);

        if ((isPlayerMode && player!.finished) || (!isPlayerMode && allFinished)) {
            this.state.phase = 'finished';
        }

        this.state.tick++;
    }

    reset(): void {
        this.state = {
            phase: 'gate',
            horses: spawnHorses(this.segments),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
    }
}
