import type { BaseAppComponents } from '@ue-too/board-pixi-integration';

import { type Jockey, NullJockey } from '../ai';
import { createInputHandler } from './input';
import { Race } from './race';
import { RaceRenderer } from './renderer';
import type { TrackSegment } from './track-types';
import type { Horse, InputState, RacePhase } from './types';

export type PhaseChangeCallback = (
    phase: RacePhase,
    finishOrder: number[]
) => void;

/** Per-horse snapshot recorded each tick. */
export interface HorseFrame {
    id: number;
    x: number;
    y: number;
    tVel: number;
    nVel: number;
    progress: number;
    stamina: number;
    finished: boolean;
    finishOrder: number | null;
}

/** One tick of race recording. */
export interface RaceFrame {
    tick: number;
    horses: HorseFrame[];
    inputs: Record<number, { t: number; n: number }>;
}

/** Full race recording blob. */
export interface RaceRecording {
    horseCount: number;
    finishOrder: number[];
    totalTicks: number;
    frames: RaceFrame[];
}

export interface V2SimHandle {
    pickHorse(id: number | null): void;
    start(): void;
    reset(): void;
    getPhase(): RacePhase;
    getHorses(): Horse[];
    onPhaseChange(cb: PhaseChangeCallback): () => void;
    setJockey(jockey: Jockey): void;
    exportRace(): RaceRecording | null;
    cleanup(): void;
}

/**
 * Owns the race-loop ticker, input handler, renderer, and current race.
 * React calls into this imperatively via `V2SimHandle`; the sim pushes phase
 * transitions back to React via `onPhaseChange` subscribers.
 */
export class V2Sim {
    private race: Race;
    private renderer: RaceRenderer;
    private input: ReturnType<typeof createInputHandler>;
    private pendingPlayerId: number | null = null;
    private listeners = new Set<PhaseChangeCallback>();
    private tickerCb: () => void;
    private disposed = false;
    private jockey: Jockey = new NullJockey();
    private frames: RaceFrame[] = [];

    constructor(
        private components: BaseAppComponents,
        private segments: TrackSegment[]
    ) {
        this.race = new Race(segments);
        this.renderer = new RaceRenderer(components.app.stage, segments);
        this.input = createInputHandler();
        this.renderer.syncHorses(this.race.state.horses, null);

        this.tickerCb = () => this.tick();
        components.app.ticker.add(this.tickerCb);
    }

    private tick(): void {
        if (this.disposed) return;
        const prevPhase = this.race.state.phase;

        const inputs = this.jockey.infer(this.race);
        const pid = this.race.state.playerHorseId;
        if (pid !== null) {
            inputs.set(pid, this.input.state);
        }
        this.race.tick(inputs);

        // Record frame after physics
        if (this.race.state.phase === 'running' || prevPhase === 'running') {
            this.recordFrame(inputs);
        }

        this.renderer.syncHorses(
            this.race.state.horses,
            this.race.state.playerHorseId
        );

        if (this.race.state.phase !== prevPhase) {
            this.emitPhase();
        }

        // Camera follow in player mode
        if (pid !== null && this.race.state.phase === 'running') {
            const h = this.race.state.horses[pid];
            this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
        }
    }

    private recordFrame(inputs: Map<number, InputState>): void {
        const inputRecord: Record<number, { t: number; n: number }> = {};
        for (const [id, inp] of inputs) {
            inputRecord[id] = { t: inp.tangential, n: inp.normal };
        }
        this.frames.push({
            tick: this.race.state.tick,
            horses: this.race.state.horses.map(h => ({
                id: h.id,
                x: Math.round(h.pos.x * 100) / 100,
                y: Math.round(h.pos.y * 100) / 100,
                tVel: Math.round(h.tangentialVel * 1000) / 1000,
                nVel: Math.round(h.normalVel * 1000) / 1000,
                progress: Math.round(h.trackProgress * 10000) / 10000,
                stamina: Math.round(h.currentStamina * 100) / 100,
                finished: h.finished,
                finishOrder: h.finishOrder,
            })),
            inputs: inputRecord,
        });
    }

    setJockey(jockey: Jockey): void {
        this.jockey.dispose();
        this.jockey = jockey;
    }

    private emitPhase(): void {
        for (const cb of this.listeners) {
            cb(this.race.state.phase, [...this.race.state.finishOrder]);
        }
    }

    // --- V2SimHandle API ---

    pickHorse(id: number | null): void {
        if (this.race.state.phase !== 'gate') return;
        this.pendingPlayerId = id;
    }

    start(): void {
        if (this.race.state.phase !== 'gate') return;
        this.race.start(this.pendingPlayerId);
        this.emitPhase();
    }

    reset(): void {
        this.race.reset();
        this.pendingPlayerId = null;
        this.frames = [];
        this.renderer.dispose();
        this.renderer = new RaceRenderer(
            this.components.app.stage,
            this.segments
        );
        this.renderer.syncHorses(this.race.state.horses, null);
        this.emitPhase();
    }

    exportRace(): RaceRecording | null {
        if (this.frames.length === 0) return null;
        return {
            horseCount: this.race.state.horses.length,
            finishOrder: [...this.race.state.finishOrder],
            totalTicks: this.race.state.tick,
            frames: this.frames,
        };
    }

    getPhase(): RacePhase {
        return this.race.state.phase;
    }

    getHorses(): Horse[] {
        return this.race.state.horses;
    }

    onPhaseChange(cb: PhaseChangeCallback): () => void {
        this.listeners.add(cb);
        // Fire immediately so new subscribers see current state.
        cb(this.race.state.phase, [...this.race.state.finishOrder]);
        return () => {
            this.listeners.delete(cb);
        };
    }

    cleanup(): void {
        if (this.disposed) return;
        this.disposed = true;
        // Wrapper may destroy the Pixi Application before React's cleanup
        // effect fires (unmount ordering is not guaranteed), so guard the
        // ticker access with optional chaining.
        this.components.app.ticker?.remove(this.tickerCb);
        this.input.dispose();
        this.renderer.dispose();
        this.jockey.dispose();
        this.listeners.clear();
    }
}

export function attachV2Sim(
    components: BaseAppComponents,
    segments: TrackSegment[]
): V2Sim {
    return new V2Sim(components, segments);
}
