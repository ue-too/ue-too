import type { BaseAppComponents } from '@ue-too/board-pixi-integration';
import type { TrackSegment } from '../track-types';

import { createInputHandler } from './input';
import { Race } from './race';
import { RaceRenderer } from './renderer';
import type { RacePhase } from './types';

export type PhaseChangeCallback = (
    phase: RacePhase,
    finishOrder: number[],
) => void;

export interface V2SimHandle {
    pickHorse(id: number | null): void;
    start(): void;
    reset(): void;
    getPhase(): RacePhase;
    onPhaseChange(cb: PhaseChangeCallback): () => void;
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

    constructor(
        private components: BaseAppComponents,
        private segments: TrackSegment[],
    ) {
        this.race = new Race(segments);
        this.renderer = new RaceRenderer(components.app.stage, segments);
        this.input = createInputHandler();
        this.renderer.syncHorses(this.race.state.horses, null);

        components.camera.setMaxZoomLevel(30);

        this.tickerCb = () => this.tick();
        components.app.ticker.add(this.tickerCb);
    }

    private tick(): void {
        if (this.disposed) return;
        const prevPhase = this.race.state.phase;
        this.race.tick(this.input.state);
        this.renderer.syncHorses(
            this.race.state.horses,
            this.race.state.playerHorseId,
        );

        if (this.race.state.phase !== prevPhase) {
            this.emitPhase();
        }

        // Camera follow in player mode
        const pid = this.race.state.playerHorseId;
        if (pid !== null && this.race.state.phase === 'running') {
            const h = this.race.state.horses[pid];
            this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
        }
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
        this.renderer.dispose();
        this.renderer = new RaceRenderer(this.components.app.stage, this.segments);
        this.renderer.syncHorses(this.race.state.horses, null);
        this.emitPhase();
    }

    getPhase(): RacePhase {
        return this.race.state.phase;
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
        this.disposed = true;
        this.components.app.ticker.remove(this.tickerCb);
        this.input.dispose();
        this.renderer.dispose();
        this.listeners.clear();
    }
}

export function attachV2Sim(
    components: BaseAppComponents,
    segments: TrackSegment[],
): V2Sim {
    return new V2Sim(components, segments);
}
