import type { BaseAppComponents } from '@ue-too/board-pixi-integration';

import { type Jockey, NullJockey } from '../ai';
import type { BtBatchRequest, BtBatchResult } from './bt-batch';
import { runBtBatch } from './bt-batch';
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
    /** Sprite rotation in radians — captured at sim time so playback is exact. */
    rotation: number;
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
    /** Metadata for replaying in a different session. */
    horseColors?: number[];
    horseLabels?: Record<number, string>;
    trackUrl?: string;
}

/** Callback for precompute progress. `null` means not precomputing. */
export type PrecomputeProgressCallback = (progress: number | null) => void;

/** Fired once the precompute is done and playback can start. */
export type SimulationReadyCallback = () => void;

/** Fires during playback with current frame index and total frames. */
export type PlaybackProgressCallback = (
    frame: number,
    totalFrames: number,
    paused: boolean
) => void;

export interface V2SimHandle {
    pickHorse(id: number | null): void;
    /** Stage 1: run the full race simulation (precompute). UI shows progress. */
    start(): void;
    /** Stage 2: start playback of the precomputed race. Call after ready event. */
    playback(): void;
    /** Toggle pause/resume during playback. */
    togglePlayback(): void;
    /** Jump playback to a specific frame index. */
    seekPlayback(frame: number): void;
    /** Simulation-frame steps per display tick while playing back (default 1). */
    getPlaybackSpeed(): number;
    setPlaybackSpeed(multiplier: number): void;
    reset(): void;
    getPhase(): RacePhase;
    getHorses(): Horse[];
    getHorseCount(): number;
    setHorseCount(count: number): void;
    /** Load a different track and reset the race. Only valid in 'gate' phase. */
    setTrack(url: string): Promise<void>;
    onPhaseChange(cb: PhaseChangeCallback): () => void;
    onPrecomputeProgress(cb: PrecomputeProgressCallback): () => void;
    onSimulationReady(cb: SimulationReadyCallback): () => void;
    onPlaybackProgress(cb: PlaybackProgressCallback): () => void;
    setJockey(jockey: Jockey): void;
    setHorseJockey(horseId: number, jockey: Jockey | null): void;
    getHorseJockeyUrl(horseId: number): string | null;
    setHorseJockeyUrl(horseId: number, url: string | null): Promise<void>;
    exportRace(): RaceRecording | null;
    /** Load a previously exported recording and start playback. */
    importRace(recording: RaceRecording): void;
    /** Current track geometry (for headless BT batch tuning). */
    getTrackSegments(): TrackSegment[];
    /** Run repeated BT-only races in-process (no rendering). */
    runBtBatch(req: BtBatchRequest): Promise<BtBatchResult>;
    /** Camera follow: set which horse ID the camera tracks (null = free). */
    followHorse(id: number | null): void;
    getFollowedHorse(): number | null;
    /** Snapshot of the current playback frame (null if not playing). */
    getCurrentFrame(): RaceFrame | null;
    /**
     * Flush cached jockey for a specific URL so next race recreates it.
     * Used by the workbench to ensure live config changes take effect.
     */
    invalidateJockeyUrl(url: string): void;
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
    private precomputeListeners = new Set<PrecomputeProgressCallback>();
    private readyListeners = new Set<SimulationReadyCallback>();
    /** finishOrder and tick count from the precomputed race (cleared on reset). */
    private simulatedFinishOrder: number[] = [];
    private simulatedTotalTicks = 0;

    // --- Precompute + playback ---
    /** If set, we're replaying precomputed frames instead of live-simulating. */
    private playbackMode = false;
    private playbackIndex = 0;
    /** True while precompute loop is running. */
    private precomputing = false;
    /** True once precompute finished and frames are ready for playback. */
    private simulationReady = false;
    /** When true, playback ticker advances no frames. */
    private playbackPaused = false;
    /** Display-tick steps toward next sim frame; supports fractional speeds below 1. */
    private playbackAccumulator = 0;
    /** Sim frames advanced per Pixi tick (1 = realtime-ish). */
    private playbackSpeed = 1;
    private playbackListeners = new Set<PlaybackProgressCallback>();

    /** Which horse the camera follows during playback (null = no auto-follow). */
    private followTarget: number | null = null;
    private currentTrackUrl = '';
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
                this.emitPlaybackProgress();
                this.emitPhase();
            }
            return;
        }
        // Paused: redraw current frame only (seek uses the same path).
        if (this.playbackPaused) {
            this.applyPlaybackFrame(this.playbackIndex);
            this.emitPlaybackProgress();
            return;
        }

        this.playbackAccumulator += this.playbackSpeed;
        const maxSteps = 64;
        let steps = 0;
        while (
            this.playbackAccumulator >= 1 &&
            this.playbackIndex < this.frames.length &&
            steps < maxSteps
        ) {
            this.playbackAccumulator -= 1;
            this.playbackIndex++;
            steps++;
        }

        if (this.playbackIndex >= this.frames.length) {
            this.applyPlaybackFrame(this.frames.length - 1);
            if (this.race.state.phase !== 'finished') {
                this.race.state.phase = 'finished';
                this.emitPhase();
            }
        } else if (this.playbackSpeed < 1 && this.playbackIndex + 1 < this.frames.length) {
            this.applyInterpolatedFrame(
                this.playbackIndex,
                this.playbackIndex + 1,
                this.playbackAccumulator
            );
        } else {
            this.applyPlaybackFrame(this.playbackIndex);
        }
        this.emitPlaybackProgress();
    }

    /** Interpolate between two frames for smooth sub-1x playback. */
    private applyInterpolatedFrame(idxA: number, idxB: number, t: number): void {
        const a = this.frames[idxA];
        const b = this.frames[idxB];
        const rotations = new Map<number, number>();
        for (let i = 0; i < a.horses.length; i++) {
            const ha = a.horses[i];
            const hb = b.horses[i];
            const h = this.race.state.horses[ha.id];
            if (!h || !hb) continue;
            h.pos.x = ha.x + (hb.x - ha.x) * t;
            h.pos.y = ha.y + (hb.y - ha.y) * t;
            h.tangentialVel = ha.tVel + (hb.tVel - ha.tVel) * t;
            h.normalVel = ha.nVel + (hb.nVel - ha.nVel) * t;
            h.trackProgress = ha.progress + (hb.progress - ha.progress) * t;
            h.currentStamina = ha.stamina + (hb.stamina - ha.stamina) * t;
            h.finished = ha.finished;
            h.finishOrder = ha.finishOrder;
            const rA = ha.rotation;
            let rB = hb.rotation;
            let diff = rB - rA;
            if (diff > Math.PI) diff -= 2 * Math.PI;
            if (diff < -Math.PI) diff += 2 * Math.PI;
            rotations.set(ha.id, rA + diff * t);
        }
        this.renderer.syncHorses(
            this.race.state.horses,
            this.race.state.playerHorseId,
            rotations
        );
        this.renderer.drawTraces(this.frames, idxA, this.components.camera.zoomLevel);
        const follow = this.followTarget ?? this.race.state.playerHorseId;
        if (follow !== null) {
            const h = this.race.state.horses[follow];
            if (h) this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
        }
    }

    /** Apply recorded horse state for one frame index (playback / seek). */
    private applyPlaybackFrame(index: number): void {
        const frame = this.frames[index];
        const rotations = new Map<number, number>();
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
            rotations.set(recorded.id, recorded.rotation);
        }
        this.renderer.syncHorses(
            this.race.state.horses,
            this.race.state.playerHorseId,
            rotations
        );
        this.renderer.drawTraces(this.frames, index, this.components.camera.zoomLevel);
        const follow = this.followTarget ?? this.race.state.playerHorseId;
        if (follow !== null) {
            const h = this.race.state.horses[follow];
            if (h) this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
        }
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
            horses: this.race.state.horses.map((h, i) => {
                const frame = h.navigator.getTrackFrame(h.pos);
                const rotation = Math.atan2(frame.tangential.y, frame.tangential.x);
                return {
                    id: h.id,
                    x: Math.round(h.pos.x * 100) / 100,
                    y: Math.round(h.pos.y * 100) / 100,
                    tVel: Math.round(h.tangentialVel * 1000) / 1000,
                    nVel: Math.round(h.normalVel * 1000) / 1000,
                    progress: Math.round(h.trackProgress * 10000) / 10000,
                    stamina: Math.round(h.currentStamina * 100) / 100,
                    lateralOffset: Math.round(h.navigator.lateralOffset(h.pos) * 100) / 100,
                    rotation: Math.round(rotation * 10000) / 10000,
                    finished: h.finished,
                    finishOrder: h.finishOrder,
                    obs: Array.from(allObs[i]),
                };
            }),
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
        // During playback the race object is fresh and has no finishOrder —
        // use the preserved finishOrder from the precomputed race instead.
        const order = (this.playbackMode || this.simulatedFinishOrder.length > 0)
            ? this.simulatedFinishOrder
            : this.race.state.finishOrder;
        for (const cb of this.listeners) {
            cb(this.race.state.phase, [...order]);
        }
    }

    // --- V2SimHandle API ---

    pickHorse(id: number | null): void {
        if (this.race.state.phase !== 'gate') return;
        this.pendingPlayerId = id;
    }

    /**
     * Stage 1: run the entire race simulation upfront.
     * Does NOT start playback — emits `simulationReady` when done.
     * UI should call `playback()` to actually start rendering the race.
     */
    start(): void {
        if (this.race.state.phase !== 'gate') return;
        if (this.simulationReady || this.precomputing) return;
        this.race.start(this.pendingPlayerId);
        // Reset frame buffers on all jockeys
        this.jockey.resetFrames?.();
        for (const entry of this.jockeyPool.values()) {
            entry.jockey.resetFrames?.();
        }
        // tickAsync suppresses emitPhase while precomputing, so the UI
        // stays at 'gate' (no StaminaOverlay, no end screen) during the
        // simulation. We only emit 'running' when playback actually starts.
        void this.runSimulation();
    }

    /**
     * Stage 2: start playback of the precomputed race.
     * Must be called after `simulationReady` event fires.
     */
    playback(): void {
        if (!this.simulationReady || this.playbackMode) return;
        // Preserve finishOrder and tick count from the precomputed race
        // so RaceEndOverlay and exportRace see the right values.
        this.simulatedFinishOrder = [...this.race.state.finishOrder];
        this.simulatedTotalTicks = this.race.state.tick;
        // Recreate the race so navigators/state start fresh for playback.
        // Horse positions/velocities are rewritten each playback tick anyway,
        // but we need navigators to start at segment 0 so getTrackFrame()
        // returns the correct orientation at the start of the track.
        const playerId = this.pendingPlayerId;
        this.race = new Race(this.segments, this.horseCount);
        this.race.start(playerId);
        this.playbackIndex = 0;
        this.playbackMode = true;
        this.playbackPaused = false;
        this.playbackAccumulator = 0;
        this.simulationReady = false;

        this.emitPhase();
        this.emitPlaybackProgress();
    }

    /**
     * Run the entire race synchronously (awaiting inference each tick) and
     * collect all frames. Emits `simulationReady` when done.
     */
    private async runSimulation(): Promise<void> {
        this.precomputing = true;
        const MAX_TICKS = 10000;
        const ESTIMATED_TICKS = 2200;
        const VISIBLE_BATCH = 20;
        const HIDDEN_BATCH = 200;
        this.emitPrecomputeProgress(0);
        try {
            let guard = 0;
            while (
                !this.disposed &&
                this.race.state.phase === 'running' &&
                guard < MAX_TICKS
            ) {
                await this.tickAsync();
                guard++;
                const batch = document.hidden ? HIDDEN_BATCH : VISIBLE_BATCH;
                if (guard % batch === 0) {
                    const progress = Math.min(0.99, guard / ESTIMATED_TICKS);
                    this.emitPrecomputeProgress(progress);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        } finally {
            this.precomputing = false;
            this.emitPrecomputeProgress(null);
        }
        if (this.disposed) return;
        this.simulationReady = true;
        this.emitSimulationReady();
    }

    reset(): void {
        const savedUrls = new Map(this.horseModelUrls);
        this.race = new Race(this.segments, this.horseCount);
        this.pendingPlayerId = null;
        this.frames = [];
        this.playbackMode = false;
        this.playbackIndex = 0;
        this.playbackPaused = false;
        this.playbackAccumulator = 0;
        this.playbackSpeed = 1;
        this.simulationReady = false;
        this.simulatedFinishOrder = [];
        this.simulatedTotalTicks = 0;
        this.renderer.dispose();
        this.renderer = new RaceRenderer(
            this.components.app.stage,
            this.segments
        );
        this.renderer.syncHorses(this.race.state.horses, null);
        this.horseModelUrls.clear();
        for (const [id, url] of savedUrls) {
            if (id < this.horseCount) {
                void this.setHorseJockeyUrl(id, url);
            }
        }
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

    setTrack(segments: TrackSegment[], trackUrl?: string): void {
        if (this.race.state.phase !== 'gate') return;
        this.segments = segments;
        if (trackUrl !== undefined) this.currentTrackUrl = trackUrl;
        this.reset();
    }

    exportRace(): RaceRecording | null {
        if (this.frames.length === 0) return null;
        const order = this.simulatedFinishOrder.length > 0
            ? this.simulatedFinishOrder
            : this.race.state.finishOrder;
        const ticks = this.simulatedTotalTicks > 0
            ? this.simulatedTotalTicks
            : this.race.state.tick;
        const colors = this.race.state.horses.map(h => h.color);
        const labels: Record<number, string> = {};
        for (const h of this.race.state.horses) {
            const url = this.horseModelUrls.get(h.id);
            if (url?.startsWith('bt://')) {
                labels[h.id] = url.slice(5);
            } else if (url) {
                labels[h.id] = url.split('/').pop()?.replace('.onnx', '') ?? url;
            } else {
                labels[h.id] = 'no AI';
            }
        }
        return {
            horseCount: this.race.state.horses.length,
            finishOrder: [...order],
            totalTicks: ticks,
            frames: this.frames,
            horseColors: colors,
            horseLabels: labels,
            trackUrl: this.currentTrackUrl || undefined,
        };
    }

    importRace(recording: RaceRecording): void {
        this.horseCount = recording.horseCount;
        this.reset();
        this.race = new Race(this.segments, this.horseCount);
        this.race.start(null);
        if (recording.horseColors) {
            for (let i = 0; i < recording.horseColors.length; i++) {
                const h = this.race.state.horses[i];
                if (h) h.color = recording.horseColors[i];
            }
        }
        this.renderer.dispose();
        this.renderer = new RaceRenderer(
            this.components.app.stage,
            this.segments
        );
        this.renderer.syncHorses(this.race.state.horses, null);
        this.frames = recording.frames;
        this.simulatedFinishOrder = [...recording.finishOrder];
        this.simulatedTotalTicks = recording.totalTicks;
        this.playbackIndex = 0;
        this.playbackMode = true;
        this.playbackPaused = true;
        this.playbackAccumulator = 0;
        this.simulationReady = false;
        this.emitPhase();
        this.emitPlaybackProgress();
    }

    getTrackSegments(): TrackSegment[] {
        return this.segments;
    }

    runBtBatch(req: BtBatchRequest): Promise<BtBatchResult> {
        return runBtBatch(this.segments, req);
    }

    followHorse(id: number | null): void {
        this.followTarget = id;
    }

    getFollowedHorse(): number | null {
        return this.followTarget;
    }

    getCurrentFrame(): RaceFrame | null {
        if (!this.playbackMode || this.frames.length === 0) return null;
        const idx = Math.min(this.playbackIndex, this.frames.length - 1);
        return this.frames[idx] ?? null;
    }

    invalidateJockeyUrl(url: string): void {
        const entry = this.jockeyPool.get(url);
        if (!entry) return;
        const horseIds = [...this.horseModelUrls.entries()]
            .filter(([, u]) => u === url)
            .map(([id]) => id);
        entry.jockey.dispose();
        this.jockeyPool.delete(url);
        for (const id of horseIds) {
            this.horseModelUrls.delete(id);
            void this.setHorseJockeyUrl(id, url);
        }
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
        const order = this.simulatedFinishOrder.length > 0
            ? this.simulatedFinishOrder
            : this.race.state.finishOrder;
        cb(this.race.state.phase, [...order]);
        return () => {
            this.listeners.delete(cb);
        };
    }

    onPrecomputeProgress(cb: PrecomputeProgressCallback): () => void {
        this.precomputeListeners.add(cb);
        return () => {
            this.precomputeListeners.delete(cb);
        };
    }

    private emitPrecomputeProgress(progress: number | null): void {
        for (const cb of this.precomputeListeners) {
            cb(progress);
        }
    }

    onSimulationReady(cb: SimulationReadyCallback): () => void {
        this.readyListeners.add(cb);
        return () => {
            this.readyListeners.delete(cb);
        };
    }

    private emitSimulationReady(): void {
        for (const cb of this.readyListeners) {
            cb();
        }
    }

    onPlaybackProgress(cb: PlaybackProgressCallback): () => void {
        this.playbackListeners.add(cb);
        // Fire immediately so new subscribers see current state
        cb(this.playbackIndex, this.frames.length, this.playbackPaused);
        return () => {
            this.playbackListeners.delete(cb);
        };
    }

    private emitPlaybackProgress(): void {
        const total = this.frames.length;
        const frame = Math.min(this.playbackIndex, total);
        for (const cb of this.playbackListeners) {
            cb(frame, total, this.playbackPaused);
        }
    }

    togglePlayback(): void {
        if (!this.playbackMode) return;
        this.playbackPaused = !this.playbackPaused;
        this.emitPlaybackProgress();
    }

    seekPlayback(frame: number): void {
        if (!this.playbackMode || this.frames.length === 0) return;
        const clamped = Math.max(0, Math.min(this.frames.length - 1, Math.floor(frame)));
        this.playbackIndex = clamped;
        this.playbackAccumulator = 0;
        // Re-arm 'running' phase if we had played to the end.
        if (this.race.state.phase === 'finished') {
            this.race.state.phase = 'running';
            this.emitPhase();
        }
        this.emitPlaybackProgress();
    }

    getPlaybackSpeed(): number {
        return this.playbackSpeed;
    }

    setPlaybackSpeed(multiplier: number): void {
        const m = Number(multiplier);
        if (!Number.isFinite(m)) return;
        this.playbackSpeed = Math.min(8, Math.max(0.25, m));
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
