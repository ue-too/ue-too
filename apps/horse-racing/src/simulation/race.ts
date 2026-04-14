import type { Point } from '@ue-too/math';

import { createDefaultAttributes } from './attributes';
import { applyExhaustion } from './exhaustion';
import { stepPhysics } from './physics';
import { RaceWorld } from './race-world';
import { computeDrainScale, drainStamina } from './stamina';
import { TrackNavigator } from './track-navigator';
import type { TrackSegment } from './track-types';
import {
    FIXED_DT,
    type Horse,
    type InputState,
    MAX_HORSES,
    PHYS_SUBSTEPS,
    type RaceState,
    TRACK_HALF_WIDTH,
} from './types';

const BASE_COLORS = [
    0xc9a227, 0x4169e1, 0xe53935, 0x43a047, 0x8e24aa, 0xf57c00, 0x00897b,
    0xc62828, 0x1565c0, 0x6a1b9a, 0xef6c00, 0x2e7d32, 0xad1457, 0x00838f,
    0x4e342e, 0x37474f, 0xfdd835, 0x7cb342, 0x039be5, 0xd81b60, 0x00acc1,
    0x5d4037, 0x546e7a, 0xff8f00,
];

function horseColor(index: number): number {
    return BASE_COLORS[index % BASE_COLORS.length];
}

/**
 * Build horses lined up at the start of the track.
 * Each horse gets its own `TrackNavigator` instance and default attributes.
 *
 * @param segments - Track segments defining the course.
 * @param horseCount - Number of horses to spawn (default 4, clamped to [1, MAX_HORSES]).
 */
export function spawnHorses(segments: TrackSegment[], horseCount = 4): Horse[] {
    if (segments.length === 0) {
        throw new Error('spawnHorses: track has no segments');
    }
    const count = Math.max(1, Math.min(MAX_HORSES, horseCount));
    const first = segments[0];
    const probe = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
    const startPoint: Point = { x: first.startPoint.x, y: first.startPoint.y };
    const frame = probe.getTrackFrame(startPoint);

    const laneSpacing =
        count > 1 ? (TRACK_HALF_WIDTH * 2 * 0.8) / (count - 1) : 0;

    return Array.from({ length: count }, (_, id) => {
        const laneOffset =
            count > 1 ? -TRACK_HALF_WIDTH * 0.8 + id * laneSpacing : 0;
        const pos: Point = {
            x: startPoint.x + frame.normal.x * laneOffset,
            y: startPoint.y + frame.normal.y * laneOffset,
        };
        const attrs = createDefaultAttributes();
        return {
            id,
            color: horseColor(id),
            pos,
            tangentialVel: 0,
            normalVel: 0,
            trackProgress: 0,
            navigator: new TrackNavigator(segments, 0, TRACK_HALF_WIDTH),
            finished: false,
            finishOrder: null,
            baseAttributes: attrs,
            currentStamina: attrs.maxStamina,
            effectiveAttributes: { ...attrs },
            lastDrain: 0,
        };
    });
}

/**
 * Race state machine: gate → running → finished.
 *
 * Tick pipeline per frame:
 *   1. applyExhaustion per horse → effective attrs
 *   2. stepPhysics (8 substeps at 240Hz) using effective attrs
 *   3. drainStamina per horse (once per tick, after physics)
 */
export class Race {
    state: RaceState;
    private segments: TrackSegment[];
    private horseCount: number;
    private raceWorld: RaceWorld;
    private drainScale: number;

    constructor(segments: TrackSegment[], horseCount = 4) {
        this.segments = segments;
        this.horseCount = horseCount;
        this.state = {
            phase: 'gate',
            horses: spawnHorses(segments, horseCount),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
        this.raceWorld = new RaceWorld(segments);
        this.addHorseBodies();
        const navigator = this.state.horses[0].navigator;
        const defaultCruise = createDefaultAttributes().cruiseSpeed;
        this.drainScale = computeDrainScale(navigator.totalLength, defaultCruise);
    }

    private addHorseBodies(): void {
        for (const h of this.state.horses) {
            const frame = h.navigator.getTrackFrame(h.pos);
            const angle = Math.atan2(frame.tangential.y, frame.tangential.x);
            this.raceWorld.addHorse(
                h.id,
                h.pos,
                angle,
                h.baseAttributes.weight
            );
        }
    }

    start(playerHorseId: number | null): void {
        if (this.state.phase !== 'gate') return;
        this.state.playerHorseId = playerHorseId;
        this.state.phase = 'running';
        this.state.tick = 0;
    }

    tick(inputs: Map<number, InputState>): void {
        if (this.state.phase !== 'running') return;

        const zeroInput: InputState = { tangential: 0, normal: 0 };

        // 1. Resolve effective attributes (exhaustion decay if stamina = 0)
        for (const h of this.state.horses) {
            if (!h.finished) {
                h.effectiveAttributes = applyExhaustion(h);
            }
        }

        // 2. Physics substeps
        stepPhysics(
            this.state.horses,
            inputs,
            this.raceWorld,
            PHYS_SUBSTEPS,
            FIXED_DT
        );

        // 3. Stamina drain (once per tick, after physics)
        for (const h of this.state.horses) {
            if (!h.finished) {
                const frame = h.navigator.getTrackFrame(h.pos);
                const horseInput = inputs.get(h.id) ?? zeroInput;
                drainStamina(h, h.effectiveAttributes, horseInput, frame, this.drainScale);
            }
        }

        // 4. Finish detection — remove finished horses from physics
        for (const h of this.state.horses) {
            if (!h.finished && h.trackProgress >= 1.0) {
                h.finished = true;
                h.finishOrder = this.state.finishOrder.length + 1;
                this.state.finishOrder.push(h.id);
                this.raceWorld.removeHorse(h.id);
            }
        }

        if (this.state.horses.every(h => h.finished)) {
            this.state.phase = 'finished';
        }

        this.state.tick++;
    }

    reset(): void {
        this.raceWorld.dispose();
        this.state = {
            phase: 'gate',
            horses: spawnHorses(this.segments, this.horseCount),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
        this.raceWorld = new RaceWorld(this.segments);
        this.addHorseBodies();
        const navigator = this.state.horses[0].navigator;
        const defaultCruise = createDefaultAttributes().cruiseSpeed;
        this.drainScale = computeDrainScale(navigator.totalLength, defaultCruise);
    }
}
