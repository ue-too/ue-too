import type { BaseAppComponents } from '@ue-too/board-pixi-integration';

import { type Jockey, NullJockey } from '../ai';
import { createInputHandler } from './input';
import { buildObservations } from './observation';
import { Race } from './race';
import { RaceRenderer } from './renderer';
import type { TrackSegment } from './track-types';
import { MAX_HORSES, TRACK_HALF_WIDTH, type Horse, type InputState, type RacePhase } from './types';

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
    lateralOffset: number;
    finished: boolean;
    finishOrder: number | null;
    obs: number[];
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
    getHorseCount(): number;
    setHorseCount(count: number): void;
    onPhaseChange(cb: PhaseChangeCallback): () => void;
    setJockey(jockey: Jockey): void;
    setHorseJockey(horseId: number, jockey: Jockey | null): void;
    getHorseJockeyUrl(horseId: number): string | null;
    setHorseJockeyUrl(horseId: number, url: string | null): Promise<void>;
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
    private ticking = false;
    private jockey: Jockey = new NullJockey();
    /** Per-horse model URL assignment (horseId → model URL). */
    private horseModelUrls = new Map<number, string>();
    /** Shared jockey instances keyed by model URL (refcounted). */
    private jockeyPool = new Map<string, { jockey: Jockey; refCount: number }>();
    private frames: RaceFrame[] = [];

    // --- Precompute + playback ---
    /** If set, we're replaying precomputed frames instead of live-simulating. */
    private playbackMode = false;
    private playbackIndex = 0;
    /** True while precompute loop is running. */
    private precomputing = false;

    private horseCount = 4;

    constructor(
        private components: BaseAppComponents,
        private segments: TrackSegment[]
    ) {
        this.race = new Race(segments, this.horseCount);
        this.renderer = new RaceRenderer(components.app.stage, segments);
        this.input = createInputHandler();
        this.renderer.syncHorses(this.race.state.horses, null);

        this.tickerCb = () => this.tick();
        components.app.ticker.add(this.tickerCb);
    }

    private tick(): void {
        if (this.disposed) return;
        if (this.playbackMode) {
            this.playbackTick();
            return;
        }
        if (this.precomputing || this.ticking) return;
        this.ticking = true;
        this.tickAsync().finally(() => { this.ticking = false; });
    }

    /** Render one frame from precomputed data, no physics. */
    private playbackTick(): void {
        if (this.playbackIndex >= this.frames.length) {
            // End of playback — ensure race phase is 'finished' and emit
            if (this.race.state.phase !== 'finished') {
                this.race.state.phase = 'finished';
                this.emitPhase();
            }
            return;
        }
        const frame = this.frames[this.playbackIndex];
        // Write frame's horse state back into the live race objects (for rendering)
        for (const recorded of frame.horses) {
            const h = this.race.state.horses[recorded.id];
            if (!h) continue;
            h.pos.x = recorded.x;
            h.pos.y = recorded.y;
            h.tangentialVel = recorded.tVel;
            h.normalVel = recorded.nVel;
            h.trackProgress = recorded.progress;
            h.currentStamina = recorded.stamina;
            h.finished = recorded.finished;
            h.finishOrder = recorded.finishOrder;
            // Sync navigator segment state so getTrackFrame returns correct orientation.
            h.navigator.updateSegment(h.pos);
        }
        this.renderer.syncHorses(
            this.race.state.horses,
            this.race.state.playerHorseId
        );
        const pid = this.race.state.playerHorseId;
        if (pid !== null) {
            const h = this.race.state.horses[pid];
            this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
        }
        this.playbackIndex++;
    }

    private async tickAsync(): Promise<void> {
        const prevPhase = this.race.state.phase;

        // Collect actions: per-horse jockeys override the global jockey
        const inputs = new Map<number, InputState>();

        // Global jockey for unassigned horses (await fresh inference)
        const globalResult = await this.jockey.inferAsync(this.race);
        for (const [id, action] of globalResult) {
            if (!this.horseModelUrls.has(id)) inputs.set(id, action);
        }

        // Per-horse jockeys (one infer per unique model URL, only for assigned horses)
        const urlToHorseIds = new Map<string, number[]>();
        for (const [horseId, url] of this.horseModelUrls) {
            const ids = urlToHorseIds.get(url) ?? [];
            ids.push(horseId);
            urlToHorseIds.set(url, ids);
        }
        const inferPromises: Promise<Map<number, InputState>>[] = [];
        for (const [url, horseIds] of urlToHorseIds) {
            const entry = this.jockeyPool.get(url);
            if (entry) {
                inferPromises.push(entry.jockey.inferAsync(this.race, horseIds));
            }
        }
        const perHorseResults = await Promise.all(inferPromises);
        for (const result of perHorseResults) {
            for (const [id, action] of result) {
                inputs.set(id, action);
            }
        }

        const pid = this.race.state.playerHorseId;
        if (pid !== null) {
            inputs.set(pid, this.input.state);
        }

        if (this.disposed) return;

        this.race.tick(inputs);

        // Record frame after physics
        if (this.race.state.phase === 'running' || prevPhase === 'running') {
            this.recordFrame(inputs);
        }

        // Skip rendering + phase emission while precomputing (we'll emit once
        // playback starts, and rendering happens on the playback tick).
        if (this.precomputing) return;

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
        const allObs = buildObservations(this.race);
        this.frames.push({
            tick: this.race.state.tick,
            horses: this.race.state.horses.map((h, i) => ({
                id: h.id,
                x: Math.round(h.pos.x * 100) / 100,
                y: Math.round(h.pos.y * 100) / 100,
                tVel: Math.round(h.tangentialVel * 1000) / 1000,
                nVel: Math.round(h.normalVel * 1000) / 1000,
                progress: Math.round(h.trackProgress * 10000) / 10000,
                stamina: Math.round(h.currentStamina * 100) / 100,
                lateralOffset: Math.round(h.navigator.lateralOffset(h.pos) * 100) / 100,
                finished: h.finished,
                finishOrder: h.finishOrder,
                obs: Array.from(allObs[i]),
            })),
            inputs: inputRecord,
        });
    }

    setJockey(jockey: Jockey): void {
        this.jockey.dispose();
        this.jockey = jockey;
    }

    setHorseJockey(horseId: number, jockey: Jockey | null): void {
        // Release old assignment
        const oldUrl = this.horseModelUrls.get(horseId);
        if (oldUrl) {
            const entry = this.jockeyPool.get(oldUrl);
            if (entry) {
                entry.refCount--;
                if (entry.refCount <= 0) {
                    entry.jockey.dispose();
                    this.jockeyPool.delete(oldUrl);
                }
            }
            this.horseModelUrls.delete(horseId);
        }
        // jockey param is ignored — pool is managed via setHorseJockeyUrl
        // This method is kept for the null case (clearing assignment)
    }

    getHorseJockeyUrl(horseId: number): string | null {
        return this.horseModelUrls.get(horseId) ?? null;
    }

    async setHorseJockeyUrl(horseId: number, url: string | null): Promise<void> {
        // Release old assignment
        const oldUrl = this.horseModelUrls.get(horseId);
        if (oldUrl) {
            const entry = this.jockeyPool.get(oldUrl);
            if (entry) {
                entry.refCount--;
                if (entry.refCount <= 0) {
                    entry.jockey.dispose();
                    this.jockeyPool.delete(oldUrl);
                }
            }
            this.horseModelUrls.delete(horseId);
        }

        if (!url) return;

        // Reuse existing session or create new one
        const existing = this.jockeyPool.get(url);
        if (existing) {
            existing.refCount++;
        } else {
            let jockey: Jockey;
            if (url.startsWith('bt://')) {
                const { BTJockey, ARCHETYPES } = await import('../ai/bt-jockey');
                const archetype = url.slice('bt://'.length);
                const config = ARCHETYPES[archetype] ?? {};
                jockey = new BTJockey(config);
            } else {
                const { OnnxJockey } = await import('../ai');
                jockey = await OnnxJockey.create(url);
            }
            this.jockeyPool.set(url, { jockey, refCount: 1 });
        }
        this.horseModelUrls.set(horseId, url);
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
        // Reset frame buffers on all jockeys
        this.jockey.resetFrames?.();
        for (const entry of this.jockeyPool.values()) {
            entry.jockey.resetFrames?.();
        }
        // Precompute the full race upfront, then switch to playback.
        void this.precomputeThenPlayback();
        this.emitPhase();
    }

    /**
     * Run the entire race synchronously (awaiting inference each tick) and
     * collect all frames. Then reset the playback index so the render loop
     * replays from tick 0.
     */
    private async precomputeThenPlayback(): Promise<void> {
        this.precomputing = true;
        const MAX_TICKS = 10000; // safety cap
        try {
            let guard = 0;
            while (
                !this.disposed &&
                this.race.state.phase === 'running' &&
                guard < MAX_TICKS
            ) {
                await this.tickAsync();
                guard++;
            }
        } finally {
            this.precomputing = false;
        }
        if (this.disposed) return;
        // Recreate the race so navigators/state start fresh for playback.
        // Horse positions/velocities are rewritten each playback tick anyway,
        // but we need navigators to start at segment 0 so getTrackFrame()
        // returns the correct orientation at the start of the track.
        const playerId = this.race.state.playerHorseId;
        this.race = new Race(this.segments, this.horseCount);
        this.race.start(playerId);
        // Enter playback from the start of the recorded frames
        this.playbackIndex = 0;
        this.playbackMode = true;
    }

    reset(): void {
        this.race = new Race(this.segments, this.horseCount);
        this.pendingPlayerId = null;
        this.frames = [];
        this.playbackMode = false;
        this.playbackIndex = 0;
        this.renderer.dispose();
        this.renderer = new RaceRenderer(
            this.components.app.stage,
            this.segments
        );
        this.renderer.syncHorses(this.race.state.horses, null);
        this.emitPhase();
    }

    getHorseCount(): number {
        return this.horseCount;
    }

    setHorseCount(count: number): void {
        if (this.race.state.phase !== 'gate') return;
        this.horseCount = Math.max(2, Math.min(MAX_HORSES, count));
        this.reset();
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
        for (const entry of this.jockeyPool.values()) entry.jockey.dispose();
        this.jockeyPool.clear();
        this.horseModelUrls.clear();
        this.listeners.clear();
    }
}

export function attachV2Sim(
    components: BaseAppComponents,
    segments: TrackSegment[]
): V2Sim {
    return new V2Sim(components, segments);
}
