import type { BaseAppComponents } from '@ue-too/board-pixi-integration';
import { PointCal } from '@ue-too/math';
import type { Point } from '@ue-too/math';
import { Graphics, Text } from 'pixi.js';

import type { CurveSegment, StraightSegment } from './track-types';

import { parseTrackJson, trackBounds } from './track-from-json';
import type { TrackSegment } from './track-types';
import { HorseRacingEngine } from './horse-racing-engine';
import type { HorseAction, HorseObservation } from './horse-racing-engine';
import { generateDefaultGenome } from './horse-genome';
import { AIJockeyManager } from './ai-jockey';
import { BTJockey, makeBTJockey, PERSONALITIES } from './bt-jockey';

// ---------------------------------------------------------------------------
// Constants (rendering only — simulation constants live in the engine)
// ---------------------------------------------------------------------------

const DEFAULT_TRACK_URL = '/tracks/tokyo.json';

const HORSE_COLORS = [
    0xc9a227, 0x8b4513, 0x4169e1, 0xffffff, 0xe53935, 0x43a047,
    0x8e24aa, 0xff9800, 0x00bcd4, 0xe91e63, 0xcddc39, 0x009688,
    0xff7043, 0x3f51b5, 0xfa8072, 0x40e0d0, 0x800000, 0x808000,
    0x000080, 0xff69b4,
];
const ARCHETYPE_NAMES = ['front_runner', 'stalker', 'closer', 'presser'];
const PLAYER_TANGENTIAL = 10; // player UP/DOWN acceleration magnitude
const PLAYER_NORMAL = 5; // player LEFT/RIGHT acceleration magnitude
const PLAYER_INDICATOR_COLOR = 0xffff00;
const PLAYER_INDICATOR_RADIUS = 3.5;

// Debug
const DEBUG_TRAIL = true;
const TRAIL_SAMPLE_INTERVAL = 5; // record every N ticks
const TRAIL_LINE_WIDTH = 1;
const DEBUG_FENCE_COLOR = 0xff4444;
const DEBUG_CENTERLINE_COLOR = 0x00ff00;
const DEBUG_FAN_COLOR = 0x00ccff;

// Track rendering — derive from default horse layout so fences contain all horses
const TRACK_HALF_WIDTH = 1.0 * 20 / 2 + 0.325; // horseSpacing * maxHorseCount / 2 + horseHalfWidth = 10.325
const RAIL_COLOR = 0xcccccc;
const RAIL_WIDTH = 2;
const TRACK_SURFACE_COLOR = 0x8b7355;
const CENTERLINE_COLOR = 0xffffff;
const CENTERLINE_WIDTH = 1;
const CENTERLINE_DASH = 6;
const CENTERLINE_GAP = 8;
const ARC_STEPS_PER_DEG = 1; // resolution for drawing arcs

// ---------------------------------------------------------------------------
// Key state
// ---------------------------------------------------------------------------

type KeyState = {
    ArrowUp: boolean;
    ArrowDown: boolean;
    ArrowLeft: boolean;
    ArrowRight: boolean;
};

function createKeyState(): KeyState {
    return {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
    };
}

// ---------------------------------------------------------------------------
// Simulation handle returned to callers
// ---------------------------------------------------------------------------

export type HorseRacingSimHandle = {
    cleanup: () => void;
    reloadTrack: (segments: TrackSegment[]) => void;
    /** Toggle visibility of the fitted-arc fan debug overlay. */
    setArcFanVisible: (visible: boolean) => void;
    /** Current visibility of the fitted-arc fan overlay. */
    arcFanVisible: () => boolean;
    /** Enable AI control for a specific horse (or all with index -1). */
    enableAI: (horseIndex: number) => void;
    /** Disable AI control, revert to keyboard/idle. */
    disableAI: (horseIndex: number) => void;
    /** Whether AI is controlling a specific horse. */
    isAIEnabled: (horseIndex: number) => boolean;
    /** Start the race (simulation is paused until this is called). */
    startRace: () => void;
    /** Whether the race has been started. */
    isRaceStarted: () => boolean;
    /** Whether the race has finished (all horses crossed the finish line). */
    isRaceFinished: () => boolean;
    /** Reset the race to starting positions with current settings. */
    resetRace: () => void;
    /** Get the current horse count. */
    getHorseCount: () => number;
    /** Change horse count and rebuild the sim. */
    setHorseCount: (count: number) => void;
    /** Assign a specific ONNX model to a horse. */
    setModelForHorse: (horseIndex: number, modelUrl: string) => Promise<void>;
    /** Assign a BT archetype to a horse (clears any ONNX model). */
    setBTForHorse: (horseIndex: number, archetype: string) => void;
    /** Set which horse the player controls (-1 = none, all AI). */
    setPlayerHorse: (horseIndex: number) => void;
    /** Get the current player-controlled horse index (-1 = none). */
    getPlayerHorse: () => number;
    /** Set active jockey skills for horse 0 (riding style modifiers + obs flags). */
    setActiveSkills: (skills: Set<string>) => void;
    /** Get currently active skills. */
    getActiveSkills: () => ReadonlySet<string>;
    /** Latest per-horse observations from the most recent sim tick (null before first step). */
    getObservations: () => HorseObservation[] | null;
    /** Get the model URL assigned to a horse (undefined = default). */
    getModelAssignment: (horseIndex: number) => string | undefined;
    /** Export recorded race data as a JSON object (returns null if no data). */
    exportRaceData: () => RaceExport | null;
};

// ---------------------------------------------------------------------------
// Race export types
// ---------------------------------------------------------------------------

export type RaceTickSnapshot = {
    tick: number;
    horses: {
        tangentialVel: number;
        normalVel: number;
        displacement: number;
        trackProgress: number;
        currentStamina: number;
        effectiveCruiseSpeed: number;
        effectiveMaxSpeed: number;
        forwardAccel: number;
        turnAccel: number;
        corneringGrip: number;
        drainRateMult: number;
        corneringMargin: number;
        placementNorm: number;
        position: { x: number; y: number };
        activeModifierIds: string[];
    }[];
};

export type RaceExport = {
    version: 1;
    exportedAt: string;
    config: {
        horseCount: number;
        activeSkills: string[];
        modelAssignments: Record<number, string>;
        horseNames: string[];
    };
    finishOrder: number[];
    /** Sampled at ~10 Hz (every 6 sim ticks). */
    ticks: RaceTickSnapshot[];
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Loads (or receives) track data, builds the dynamics world, and wires Pixi
 * graphics + ticker with centripetal-force horse control.
 *
 * @param components - Result of `baseInitApp`
 * @param preloadedSegments - Optional pre-parsed segments (skips fetch)
 * @returns Handle with cleanup and track-reload functions
 */
export async function attachHorseRacingSim(
    components: BaseAppComponents,
    preloadedSegments?: TrackSegment[],
): Promise<HorseRacingSimHandle> {
    const { app, cleanups } = components;
    const stage = app.stage;

    // AI jockey manager for model-controlled horses
    const aiManager = new AIJockeyManager();
    const aiControlled = new Set<number>();
    let pendingAIActions: Map<number, HorseAction> = new Map();
    let raceStarted = false;
    let currentHorseCount = 4;
    let playerIndex = -1; // -1 = no player control (all AI)

    // BT jockeys for horses without ONNX models
    const btJockeys = new Map<number, BTJockey>();

    // Track which model URL each horse should use
    const modelAssignments = new Map<number, string>();
    // Persist active skills across resets
    let currentSkills: Set<string> = new Set();
    // Latest observations for debug stats panel
    let latestObservations: HorseObservation[] | null = null;
    // Race recording (sampled every RECORD_INTERVAL ticks)
    const RECORD_INTERVAL = 6; // ~10 Hz at 60 Hz sim
    let recordedTicks: RaceTickSnapshot[] = [];
    let tickCounter = 0;

    const reloadModels = (): void => {
        aiManager.clearAll();
        for (let i = 0; i < currentHorseCount; i++) {
            const url = modelAssignments.get(i) ?? '/models/v5_baseline.onnx';
            aiManager.loadForHorse(i, url).catch(() => {
                console.warn(`[AI] Failed to load model for horse ${i}`);
            });
        }
    };

    // Load initial models and enable AI for all horses
    reloadModels();
    for (let i = 0; i < currentHorseCount; i++) aiControlled.add(i);

    let segments: TrackSegment[];
    if (preloadedSegments) {
        segments = preloadedSegments;
    } else {
        const res = await fetch(DEFAULT_TRACK_URL);
        if (!res.ok) {
            throw new Error(`Failed to load ${DEFAULT_TRACK_URL}: ${res.status}`);
        }
        segments = parseTrackJson(await res.json());
    }

    // Mutable sim state — replaced on reload
    let sim = buildSim(stage, segments, currentHorseCount);

    // Key listeners
    const keys = createKeyState();
    const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key in keys) (keys as Record<string, boolean>)[e.key] = true;
    };
    const onKeyUp = (e: KeyboardEvent): void => {
        if (e.key in keys) (keys as Record<string, boolean>)[e.key] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Track stage scale so we can mark pixelLine graphics dirty on change
    let prevScale = stage.localTransform.a;

    // Fixed-rate simulation: decouple sim ticks from display refresh rate.
    // The engine is designed to be called once per "sim tick" at ~60 Hz.
    const SIM_TICK_MS = 1000 / 60;
    let simAccumulatorMs = 0;

    // Ticker
    const onTick = (): void => {
        // When zoom changes, pixelLine graphics need their context marked dirty
        // so PixiJS rebuilds vertex data with the updated scale.
        const curScale = stage.localTransform.a;
        if (curScale !== prevScale) {
            prevScale = curScale;
            sim.trackGfx.context.dirty = true;
            sim.debugGfx.context.dirty = true;
            sim.arcFanGfx.context.dirty = true;
        }

        const engine = sim.engine;
        const horseCount = engine.horseIds.length;

        // Wait for start button before running the simulation
        if (!raceStarted) return;

        // Check if race is over (all horses finished)
        if (sim.raceFinished) return;

        // Accumulate real elapsed time and step at a fixed sim rate.
        // Cap accumulator to avoid spiral-of-death on long frames.
        simAccumulatorMs += app.ticker.deltaMS;
        if (simAccumulatorMs > SIM_TICK_MS * 4) {
            simAccumulatorMs = SIM_TICK_MS * 4;
        }

        let observations: HorseObservation[] | undefined;

        while (simAccumulatorMs >= SIM_TICK_MS) {
            simAccumulatorMs -= SIM_TICK_MS;

            if (sim.raceFinished) break;

            // Map keyboard / AI → actions (skip finished horses)
            const actions: HorseAction[] = [];
            for (let i = 0; i < horseCount; i++) {
                if (sim.finishedHorses.has(i)) {
                    // Freeze finished horse — counteract auto-cruise by braking
                    actions.push({ extraTangential: -20, extraNormal: 0 });
                    continue;
                }
                if (i === playerIndex) {
                    // Player-controlled horse: read keyboard input
                    let extraTangential = 0;
                    let extraNormal = 0;
                    if (keys.ArrowUp) extraTangential = PLAYER_TANGENTIAL;
                    if (keys.ArrowDown) extraTangential = -PLAYER_TANGENTIAL;
                    if (keys.ArrowLeft) extraNormal = -PLAYER_NORMAL;
                    if (keys.ArrowRight) extraNormal = PLAYER_NORMAL;
                    actions.push({ extraTangential, extraNormal });
                } else if (aiControlled.has(i) && pendingAIActions.has(i) && aiManager.hasModel(i)) {
                    // Use AI-computed action from previous tick's observation
                    actions.push(pendingAIActions.get(i)!);
                } else if (latestObservations && latestObservations[i]) {
                    // No ONNX model — use behavior tree fallback
                    if (!btJockeys.has(i)) {
                        const archetypes = Object.keys(PERSONALITIES);
                        btJockeys.set(i, makeBTJockey(archetypes[i % archetypes.length]));
                    }
                    actions.push(btJockeys.get(i)!.computeAction(
                        latestObservations[i], i, latestObservations,
                    ));
                } else {
                    actions.push({ extraTangential: 0, extraNormal: 0 });
                }
            }

            // Step simulation
            observations = engine.step(actions);
            latestObservations = observations;

            // Record snapshot at ~10 Hz
            tickCounter++;
            if (tickCounter % RECORD_INTERVAL === 0) {
                recordedTicks.push({
                    tick: tickCounter,
                    horses: observations.map(obs => ({
                        tangentialVel: obs.tangentialVel,
                        normalVel: obs.normalVel,
                        displacement: obs.displacement,
                        trackProgress: obs.trackProgress,
                        currentStamina: obs.currentStamina,
                        effectiveCruiseSpeed: obs.effectiveCruiseSpeed,
                        effectiveMaxSpeed: obs.effectiveMaxSpeed,
                        forwardAccel: obs.forwardAccel,
                        turnAccel: obs.turnAccel,
                        corneringGrip: obs.corneringGrip,
                        drainRateMult: obs.drainRateMult,
                        corneringMargin: obs.corneringMargin === Infinity ? 1000 : obs.corneringMargin,
                        placementNorm: obs.placementNorm,
                        position: { x: obs.position.x, y: obs.position.y },
                        activeModifierIds: obs.activeModifierIds ? [...obs.activeModifierIds] : [],
                    })),
                });
            }

            // Detect newly finished horses via the navigator's completedLap flag,
            // which is set when a horse exits the last track segment.
            const navs = sim.engine.navigators;
            const bodyMap = sim.engine.world.getRigidBodyMap();
            for (let i = 0; i < horseCount; i++) {
                if (sim.finishedHorses.has(i)) continue;
                if (navs[i].completedLap) {
                    sim.finishedHorses.add(i);
                    const pos = observations[i].position;
                    sim.finishPositions.set(i, {
                        x: pos.x, y: pos.y,
                        rotation: observations[i].orientationAngle,
                    });
                    sim.finishOrder.push(i);
                    // Freeze the horse so it stops moving
                    const body = bodyMap.get(engine.horseIds[i]);
                    if (body) {
                        body.linearVelocity = { x: 0, y: 0 };
                    }
                    console.log(`[Race] Horse ${i} finished in position ${sim.finishOrder.length}`);
                }
            }
            if (sim.finishedHorses.size >= horseCount) {
                sim.raceFinished = true;
                console.log('[Race] All horses finished! Final order:', sim.finishOrder);
            }
        }

        // Queue AI inference for next tick (async, non-blocking)
        // Pass all observations so agents can compute relative horse positions
        if (observations && aiManager.isReady && aiControlled.size > 0) {
            const aiIndices = [...aiControlled];
            const aiObs = aiIndices.map(i => observations![i]);
            aiManager.computeActions(aiIndices, aiObs, observations).then((actionMap) => {
                pendingAIActions = actionMap;
            });
        }

        // Update graphics from engine state
        const positions = engine.getHorsePositions();
        const orientations = engine.getHorseOrientations();
        for (let i = 0; i < horseCount; i++) {
            const id = engine.horseIds[i];
            const gr = sim.horseGfx.get(id);
            if (!gr) continue;
            // Freeze finished horses at their finish position
            const finishPos = sim.finishPositions.get(i);
            if (finishPos) {
                gr.position.set(finishPos.x, finishPos.y);
                gr.rotation = finishPos.rotation;
            } else {
                gr.position.set(positions[i].x, positions[i].y);
                gr.rotation = orientations[i];
            }
        }

        // Update per-horse archetype labels (scale inversely with zoom for consistent screen size)
        const labelScale = 1 / curScale;
        for (let i = 0; i < horseCount && i < sim.aiLabels.length; i++) {
            if (aiControlled.has(i)) {
                sim.aiLabels[i].visible = true;
                sim.aiLabels[i].position.set(positions[i].x, positions[i].y);
                sim.aiLabels[i].scale.set(labelScale, labelScale);
            } else {
                sim.aiLabels[i].visible = false;
            }
        }

        // --- Player indicator ring ---
        sim.playerIndicator.clear();
        if (playerIndex >= 0 && playerIndex < horseCount && !sim.finishedHorses.has(playerIndex)) {
            const px = positions[playerIndex].x;
            const py = positions[playerIndex].y;
            sim.playerIndicator.circle(px, py, PLAYER_INDICATOR_RADIUS);
            sim.playerIndicator.stroke({ width: 2, color: PLAYER_INDICATOR_COLOR, alpha: 0.9, pixelLine: true });
            // Small arrow above the horse (scales with zoom)
            const arrowSize = 1.5;
            const arrowY = py - PLAYER_INDICATOR_RADIUS - arrowSize * 0.5;
            sim.playerIndicator.moveTo(px - arrowSize, arrowY - arrowSize);
            sim.playerIndicator.lineTo(px, arrowY);
            sim.playerIndicator.lineTo(px + arrowSize, arrowY - arrowSize);
            sim.playerIndicator.stroke({ width: 2, color: PLAYER_INDICATOR_COLOR, alpha: 0.9, pixelLine: true });
        }

        // --- Debug: racing line trail + target arc overlay ---
        if (DEBUG_TRAIL) {
            sim.trailCounter += 1;

            // Line trail (sampled)
            if (sim.trailCounter % TRAIL_SAMPLE_INTERVAL === 0) {
                for (let i = 0; i < horseCount; i++) {
                    const prev = sim.trailPrevPos[i];
                    const cur = positions[i];
                    if (prev) {
                        sim.trailGfx
                            .moveTo(prev.x, prev.y)
                            .lineTo(cur.x, cur.y)
                            .stroke({ width: TRAIL_LINE_WIDTH, color: HORSE_COLORS[i % HORSE_COLORS.length], alpha: 0.7, pixelLine: true });
                    }
                    sim.trailPrevPos[i] = { x: cur.x, y: cur.y };
                }
            }

            // Target arc (redrawn each frame using the horse's current radius)
            sim.targetArcGfx.clear();
            for (let i = 0; i < horseCount; i++) {
                const nav = engine.navigators[i];
                const seg = nav.segment;
                if (seg.tracktype !== 'CURVE') continue;

                const center: Point = { x: seg.center.x, y: seg.center.y };
                // Use the horse's actual distance from the curve center
                const dx = positions[i].x - center.x;
                const dy = positions[i].y - center.y;
                const currentRadius = Math.sqrt(dx * dx + dy * dy);
                if (currentRadius < 1e-6) continue;

                const startA = Math.atan2(
                    seg.startPoint.y - seg.center.y,
                    seg.startPoint.x - seg.center.x,
                );
                const span = seg.angleSpan;
                const steps = Math.max(
                    Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
                    4,
                );
                const pts = arcPoints(center, currentRadius, startA, span, steps);
                sim.targetArcGfx.moveTo(pts[0].x, pts[0].y);
                for (let j = 1; j < pts.length; j++) {
                    sim.targetArcGfx.lineTo(pts[j].x, pts[j].y);
                }
                sim.targetArcGfx.stroke({
                    width: 1,
                    color: HORSE_COLORS[i % HORSE_COLORS.length],
                    alpha: 0.5,
                    pixelLine: true,
                });
            }
        }
    };

    app.ticker.add(onTick);

    // Cleanup helper
    const teardownSim = (): void => {
        sim.teardown();
    };

    const cleanup = (): void => {
        app.ticker.remove(onTick);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        teardownSim();
    };

    const reloadTrack = (newSegments: TrackSegment[]): void => {
        app.ticker.remove(onTick);
        teardownSim();
        segments = newSegments;
        raceStarted = false;
        pendingAIActions.clear();
        btJockeys.clear();
        recordedTicks = [];
        tickCounter = 0;
        latestObservations = null;
        sim = buildSim(stage, segments, currentHorseCount);
        sim.engine.setActiveSkills(currentSkills);
        simAccumulatorMs = 0;
        reloadModels();
        aiControlled.clear();
        for (let i = 0; i < currentHorseCount; i++) {
            if (i !== playerIndex) aiControlled.add(i);
        }
        app.ticker.add(onTick);
    };

    const setArcFanVisible = (visible: boolean): void => {
        sim.arcFanGfx.visible = visible;
    };

    const arcFanVisible = (): boolean => sim.arcFanGfx.visible;

    cleanups.push(cleanup);

    const enableAI = (horseIndex: number): void => {
        if (horseIndex === -1) {
            for (let i = 0; i < sim.engine.horseIds.length; i++) aiControlled.add(i);
        } else {
            aiControlled.add(horseIndex);
        }
    };

    const disableAI = (horseIndex: number): void => {
        if (horseIndex === -1) {
            aiControlled.clear();
            pendingAIActions.clear();
        } else {
            aiControlled.delete(horseIndex);
            pendingAIActions.delete(horseIndex);
        }
    };

    const isAIEnabled = (horseIndex: number): boolean => aiControlled.has(horseIndex);

    const startRace = (): void => { raceStarted = true; };
    const isRaceStarted = (): boolean => raceStarted;
    const isRaceFinished = (): boolean => sim.raceFinished;

    const resetRace = (): void => {
        app.ticker.remove(onTick);
        teardownSim();
        raceStarted = false;
        pendingAIActions.clear();
        btJockeys.clear();
        recordedTicks = [];
        tickCounter = 0;
        latestObservations = null;
        sim = buildSim(stage, segments, currentHorseCount);
        sim.engine.setActiveSkills(currentSkills);
        simAccumulatorMs = 0;
        reloadModels();
        aiControlled.clear();
        for (let i = 0; i < currentHorseCount; i++) {
            if (i !== playerIndex) aiControlled.add(i);
        }
        app.ticker.add(onTick);
    };

    const getHorseCount = (): number => currentHorseCount;

    const setHorseCount = (count: number): void => {
        currentHorseCount = Math.max(2, Math.min(20, count));
        resetRace();
    };

    const setModelForHorse = async (horseIndex: number, modelUrl: string): Promise<void> => {
        modelAssignments.set(horseIndex, modelUrl);
        btJockeys.delete(horseIndex); // clear any BT assignment
        await aiManager.loadForHorse(horseIndex, modelUrl);
    };

    const setBTForHorse = (horseIndex: number, archetype: string): void => {
        modelAssignments.set(horseIndex, `bt:${archetype}`);
        // Clear ONNX model so the fallback BT path is used
        aiManager.clearForHorse(horseIndex);
        btJockeys.set(horseIndex, makeBTJockey(archetype));
    };

    const setPlayerHorse = (horseIndex: number): void => {
        const prev = playerIndex;
        playerIndex = horseIndex;
        // Re-enable AI on the previously controlled horse
        if (prev >= 0 && prev !== horseIndex) {
            aiControlled.add(prev);
        }
        // Disable AI on the newly player-controlled horse
        if (horseIndex >= 0) {
            aiControlled.delete(horseIndex);
            pendingAIActions.delete(horseIndex);
        }
    };

    const getPlayerHorse = (): number => playerIndex;

    const setActiveSkills = (skills: Set<string>): void => {
        currentSkills = new Set(skills);
        sim.engine.setActiveSkills(currentSkills);
    };

    const getActiveSkills = (): ReadonlySet<string> => sim.engine.activeSkills;

    const getObservations = (): HorseObservation[] | null => latestObservations;

    const getModelAssignment = (horseIndex: number): string | undefined =>
        modelAssignments.get(horseIndex) ?? '/models/v5_baseline.onnx';

    const HORSE_NAMES = [
        'Gold', 'Brown', 'Blue', 'White', 'Red', 'Green',
        'Purple', 'Orange', 'Cyan', 'Pink', 'Lime', 'Teal',
        'Coral', 'Indigo', 'Salmon', 'Turquoise', 'Maroon', 'Olive',
        'Navy', 'Rose',
    ];

    const exportRaceData = (): RaceExport | null => {
        if (recordedTicks.length === 0) return null;
        const assignments: Record<number, string> = {};
        for (let i = 0; i < currentHorseCount; i++) {
            assignments[i] = modelAssignments.get(i) ?? '/models/v5_baseline.onnx';
        }
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            config: {
                horseCount: currentHorseCount,
                activeSkills: [...currentSkills],
                modelAssignments: assignments,
                horseNames: HORSE_NAMES.slice(0, currentHorseCount),
            },
            finishOrder: [...sim.finishOrder],
            ticks: recordedTicks,
        };
    };

    return {
        cleanup, reloadTrack, setArcFanVisible, arcFanVisible,
        enableAI, disableAI, isAIEnabled,
        startRace, isRaceStarted, isRaceFinished,
        resetRace, getHorseCount, setHorseCount, setModelForHorse, setBTForHorse,
        setPlayerHorse, getPlayerHorse, setActiveSkills, getActiveSkills,
        getObservations, getModelAssignment, exportRaceData,
    };
}

// ---------------------------------------------------------------------------
// Track drawing
// ---------------------------------------------------------------------------

/**
 * Draws the track surface, rail lines, and dashed centerline into a
 * Pixi Graphics object.
 */
function drawTrack(g: Graphics, segments: TrackSegment[]): void {
    const hw = TRACK_HALF_WIDTH;

    // --- Pass 1: track surface (brown fill) ---
    g.beginPath();
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightSurface(g, seg, hw);
        } else {
            drawCurveSurface(g, seg, hw);
        }
    }
    g.fill({ color: TRACK_SURFACE_COLOR });

    // --- Pass 2: inner + outer rail lines ---
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightRails(g, seg, hw);
        } else {
            drawCurveRails(g, seg, hw);
        }
    }

    // --- Pass 3: dashed centerline ---
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawStraightCenterline(g, seg);
        } else {
            drawCurveCenterline(g, seg);
        }
    }
}

// ---- Straight helpers ----

function straightOffsetLine(
    seg: StraightSegment,
    offset: number,
): { start: Point; end: Point } {
    const s: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
    const e: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
    const fwd = PointCal.unitVector(PointCal.subVector(e, s));
    const outward = PointCal.rotatePoint(fwd, -Math.PI / 2);
    const off = PointCal.multiplyVectorByScalar(outward, offset);
    return {
        start: PointCal.addVector(s, off),
        end: PointCal.addVector(e, off),
    };
}

function drawStraightSurface(
    g: Graphics,
    seg: StraightSegment,
    hw: number,
): void {
    const outer = straightOffsetLine(seg, hw);
    const inner = straightOffsetLine(seg, -hw);
    g.moveTo(outer.start.x, outer.start.y);
    g.lineTo(outer.end.x, outer.end.y);
    g.lineTo(inner.end.x, inner.end.y);
    g.lineTo(inner.start.x, inner.start.y);
    g.closePath();
}

function drawStraightRails(
    g: Graphics,
    seg: StraightSegment,
    hw: number,
): void {
    const outer = straightOffsetLine(seg, hw);
    const inner = straightOffsetLine(seg, -hw);
    g.moveTo(outer.start.x, outer.start.y);
    g.lineTo(outer.end.x, outer.end.y);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
    g.moveTo(inner.start.x, inner.start.y);
    g.lineTo(inner.end.x, inner.end.y);
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
}

function drawStraightCenterline(g: Graphics, seg: StraightSegment): void {
    const s: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
    const e: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
    const ab = PointCal.subVector(e, s);
    const len = PointCal.magnitude(ab);
    const fwd = PointCal.unitVector(ab);
    let d = 0;
    let drawing = true;
    while (d < len) {
        const segLen = Math.min(drawing ? CENTERLINE_DASH : CENTERLINE_GAP, len - d);
        const p0 = PointCal.addVector(s, PointCal.multiplyVectorByScalar(fwd, d));
        const p1 = PointCal.addVector(s, PointCal.multiplyVectorByScalar(fwd, d + segLen));
        if (drawing) {
            g.moveTo(p0.x, p0.y);
            g.lineTo(p1.x, p1.y);
            g.stroke({ width: CENTERLINE_WIDTH, color: CENTERLINE_COLOR, alpha: 0.5 });
        }
        d += segLen;
        drawing = !drawing;
    }
}

// ---- Curve helpers ----

function arcPoints(
    center: Point,
    radius: number,
    startAngle: number,
    span: number,
    steps: number,
): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= steps; i++) {
        const a = startAngle + (span * i) / steps;
        pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
    }
    return pts;
}

function curveStartAngle(seg: CurveSegment): number {
    const dx = seg.startPoint.x - seg.center.x;
    const dy = seg.startPoint.y - seg.center.y;
    return Math.atan2(dy, dx);
}

function drawCurveSurface(g: Graphics, seg: CurveSegment, hw: number): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG), 4);

    const outerPts = arcPoints(center, seg.radius + hw, startA, span, steps);
    const innerPts = arcPoints(center, seg.radius - hw, startA, span, steps);

    // Draw outer arc forward, then inner arc backward to form a closed shape
    g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) {
        g.lineTo(outerPts[i].x, outerPts[i].y);
    }
    for (let i = innerPts.length - 1; i >= 0; i--) {
        g.lineTo(innerPts[i].x, innerPts[i].y);
    }
    g.closePath();
}

function drawCurveRails(g: Graphics, seg: CurveSegment, hw: number): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG), 4);

    const outerPts = arcPoints(center, seg.radius + hw, startA, span, steps);
    const innerPts = arcPoints(center, seg.radius - hw, startA, span, steps);

    g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 1; i < outerPts.length; i++) {
        g.lineTo(outerPts[i].x, outerPts[i].y);
    }
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });

    g.moveTo(innerPts[0].x, innerPts[0].y);
    for (let i = 1; i < innerPts.length; i++) {
        g.lineTo(innerPts[i].x, innerPts[i].y);
    }
    g.stroke({ width: RAIL_WIDTH, color: RAIL_COLOR, pixelLine: true });
}

function drawCurveCenterline(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const arcLen = Math.abs(span) * seg.radius;

    // Walk the arc in dashes
    let d = 0;
    let drawing = true;
    while (d < arcLen) {
        const segLen = Math.min(drawing ? CENTERLINE_DASH : CENTERLINE_GAP, arcLen - d);
        if (drawing) {
            const a0 = startA + (span * d) / arcLen;
            const a1 = startA + (span * (d + segLen)) / arcLen;
            const dashSpan = a1 - a0;
            const dashSteps = Math.max(Math.ceil(Math.abs(dashSpan) * (180 / Math.PI)), 2);
            const pts = arcPoints(center, seg.radius, a0, dashSpan, dashSteps);
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                g.lineTo(pts[i].x, pts[i].y);
            }
            g.stroke({ width: CENTERLINE_WIDTH, color: CENTERLINE_COLOR, alpha: 0.5 });
        }
        d += segLen;
        drawing = !drawing;
    }
}

// ---------------------------------------------------------------------------
// Debug overlay: fences, centerline, fitted-arc fans
// ---------------------------------------------------------------------------

const DEBUG_FENCE_HW = TRACK_HALF_WIDTH; // matches physics halfTrackWidth
const DEBUG_FENCE_THICK = 3; // must match DEFAULT_BUILD.railThickness
const DEBUG_FENCE_STEP_DEG = 5;

/**
 * Draws debug overlay showing physics collider boundaries, the track
 * centerline, and the fitted-arc fans (Crescent coverage area).
 */
function drawDebugOverlay(g: Graphics, arcFanG: Graphics, segments: TrackSegment[]): void {
    for (const seg of segments) {
        if (seg.tracktype === 'STRAIGHT') {
            drawDebugStraightFences(g, seg);
            drawDebugStraightCenterline(g, seg);
        } else {
            drawDebugFittedArcFan(arcFanG, seg);
            drawDebugCurveOuterFence(g, seg);
            drawDebugCurveCenterline(g, seg);
            drawDebugCurveInnerRail(g, seg);
        }
    }
}

// ---- Straight fence colliders (inner + outer rail rectangles) ----

function drawDebugStraightFences(g: Graphics, seg: StraightSegment): void {
    const start: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
    const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
    const ab = PointCal.subVector(end, start);
    const len = PointCal.magnitude(ab);
    const fwd = PointCal.unitVector(ab);
    const outward = PointCal.unitVector(PointCal.rotatePoint(fwd, -Math.PI / 2));
    const mid = PointCal.multiplyVectorByScalar(PointCal.addVector(start, end), 0.5);
    const angle = Math.atan2(fwd.y, fwd.x);
    const hl = len / 2;
    const hw = DEBUG_FENCE_THICK / 2;

    const railOffset = DEBUG_FENCE_HW + DEBUG_FENCE_THICK / 2;
    for (const sign of [1, -1]) {
        const railCenter = PointCal.addVector(
            mid,
            PointCal.multiplyVectorByScalar(outward, sign * railOffset),
        );
        const local: Point[] = [
            { x: hl, y: hw },
            { x: hl, y: -hw },
            { x: -hl, y: -hw },
            { x: -hl, y: hw },
        ];
        const world = local.map((p) => {
            const rot = PointCal.rotatePoint(p, angle);
            return PointCal.addVector(railCenter, rot);
        });
        g.moveTo(world[0].x, world[0].y);
        for (let i = 1; i < world.length; i++) {
            g.lineTo(world[i].x, world[i].y);
        }
        g.closePath();
        g.fill({ color: DEBUG_FENCE_COLOR, alpha: 0.15 });
        g.stroke({ width: 1, color: DEBUG_FENCE_COLOR, alpha: 0.5, pixelLine: true });
    }
}

// ---- Curve outer-fence quad strips ----

function drawDebugCurveOuterFence(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const outerRadius = seg.radius + DEBUG_FENCE_HW;
    const extendedRadius = outerRadius + DEBUG_FENCE_THICK;

    const fromCenterStart = PointCal.subVector(
        { x: seg.startPoint.x, y: seg.startPoint.y },
        center,
    );
    let orientAngle = PointCal.angleFromA2B({ x: 1, y: 0 }, fromCenterStart);
    let span = seg.angleSpan;
    if (span < 0) {
        orientAngle += span;
        span = -span;
    }

    const maxStep = (DEBUG_FENCE_STEP_DEG * Math.PI) / 180;
    const numSteps = Math.max(Math.ceil(span / maxStep), 1);
    const stepAngle = span / numSteps;

    for (let i = 0; i < numSteps; i++) {
        const a0 = orientAngle + stepAngle * i;
        const a1 = orientAngle + stepAngle * (i + 1);

        const p0 = PointCal.addVector(center, PointCal.rotatePoint({ x: outerRadius, y: 0 }, a0));
        const p1 = PointCal.addVector(center, PointCal.rotatePoint({ x: outerRadius, y: 0 }, a1));
        const p2 = PointCal.addVector(center, PointCal.rotatePoint({ x: extendedRadius, y: 0 }, a1));
        const p3 = PointCal.addVector(center, PointCal.rotatePoint({ x: extendedRadius, y: 0 }, a0));

        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.lineTo(p3.x, p3.y);
        g.closePath();
        g.fill({ color: DEBUG_FENCE_COLOR, alpha: 0.15 });
        g.stroke({ width: 1, color: DEBUG_FENCE_COLOR, alpha: 0.5, pixelLine: true });
    }
}

// ---- Curve inner rail (Crescent at nominal radius) ----

function drawDebugCurveInnerRail(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const innerRadius = seg.radius - DEBUG_FENCE_HW;
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(
        Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
        4,
    );
    const pts = arcPoints(center, innerRadius, startA, span, steps);
    // Draw closed crescent: arc + chord
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
    }
    g.closePath();
    g.fill({ color: 0xff8800, alpha: 0.1 });
    g.stroke({ width: 1, color: 0xff8800, alpha: 0.7, pixelLine: true });
}

// ---- Centerline (solid, for debug contrast) ----

function drawDebugStraightCenterline(g: Graphics, seg: StraightSegment): void {
    g.moveTo(seg.startPoint.x, seg.startPoint.y);
    g.lineTo(seg.endPoint.x, seg.endPoint.y);
    g.stroke({ width: 1.5, color: DEBUG_CENTERLINE_COLOR, alpha: 0.7 });
}

function drawDebugCurveCenterline(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const steps = Math.max(
        Math.ceil(Math.abs(seg.angleSpan) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
        4,
    );
    const pts = arcPoints(center, seg.radius, startA, seg.angleSpan, steps);
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({ width: 1.5, color: DEBUG_CENTERLINE_COLOR, alpha: 0.7 });
}

// ---- Fitted-arc fan (Crescent coverage visualised as a fan / wedge) ----

function drawDebugFittedArcFan(g: Graphics, seg: CurveSegment): void {
    const center: Point = { x: seg.center.x, y: seg.center.y };
    const startA = curveStartAngle(seg);
    const span = seg.angleSpan;
    const steps = Math.max(
        Math.ceil(Math.abs(span) * (180 / Math.PI) * ARC_STEPS_PER_DEG),
        4,
    );
    const pts = arcPoints(center, seg.radius, startA, span, steps);

    // Fan: center → arc start → ... arc end → center
    g.moveTo(center.x, center.y);
    g.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
    }
    g.lineTo(center.x, center.y);
    g.closePath();
    g.fill({ color: DEBUG_FAN_COLOR, alpha: 0.08 });
    g.stroke({ width: 1, color: DEBUG_FAN_COLOR, alpha: 0.35 });
}

// ---------------------------------------------------------------------------
// Internal sim builder (creates engine + graphics for a given track)
// ---------------------------------------------------------------------------

type SimState = {
    engine: HorseRacingEngine;
    trackGfx: Graphics;
    horseGfx: Map<string, Graphics>;
    aiLabels: Text[];
    playerIndicator: Graphics;
    trailGfx: Graphics;
    targetArcGfx: Graphics;
    debugGfx: Graphics;
    arcFanGfx: Graphics;
    finishedHorses: Set<number>;
    finishPositions: Map<number, { x: number; y: number; rotation: number }>;
    finishOrder: number[];
    raceFinished: boolean;
    trailCounter: number;
    trailPrevPos: (Point | null)[];
    teardown: () => void;
};

function buildSim(
    stage: import('pixi.js').Container,
    segments: TrackSegment[],
    horseCount = 4,
): SimState {
    // Each horse gets a random genome for varied physical attributes
    const genomes = Array.from({ length: horseCount }, () => generateDefaultGenome());
    const engine = new HorseRacingEngine(segments, { horseCount }, genomes);
    const bounds = trackBounds(segments, 120);

    // Turf background
    const turf = new Graphics();
    turf.rect(
        bounds.min.x,
        bounds.min.y,
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
    );
    turf.fill({ color: 0x2d6a3e });
    stage.addChildAt(turf, 0);

    // Track visual
    const trackGfx = new Graphics();
    drawTrack(trackGfx, segments);
    stage.addChild(trackGfx);

    // Debug overlay (fences, centerline) + separate arc-fan layer
    const debugGfx = new Graphics();
    const arcFanGfx = new Graphics();
    if (DEBUG_TRAIL) {
        drawDebugOverlay(debugGfx, arcFanGfx, segments);
    }
    stage.addChild(debugGfx);
    stage.addChild(arcFanGfx);

    // Label
    const label = new Text({
        text: 'Horse racing (dynamics demo)',
        style: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            fill: 0xffffff,
        },
    });
    label.anchor.set(0.5, 0);
    label.position.set(
        (bounds.min.x + bounds.max.x) / 2,
        bounds.min.y + 16,
    );
    stage.addChild(label);

    // Horse graphics (bodies are owned by the engine)
    const horseGfx = new Map<string, Graphics>();
    const horseHL = engine.config.horseHalfLength;
    const horseHW = engine.config.horseHalfWidth;
    const positions = engine.getHorsePositions();
    const orientations = engine.getHorseOrientations();

    for (let i = 0; i < engine.horseIds.length; i++) {
        const id = engine.horseIds[i];
        const g = new Graphics();
        g.rect(-horseHL, -horseHW, horseHL * 2, horseHW * 2).fill({
            color: HORSE_COLORS[i % HORSE_COLORS.length],
        });
        // Direction indicator line
        g.moveTo(0, 0);
        g.lineTo(horseHL * 0.6, 0);
        g.stroke({ width: 1, color: 0x000000 });
        g.position.set(positions[i].x, positions[i].y);
        g.rotation = orientations[i];
        stage.addChild(g);
        horseGfx.set(id, g);
    }

    // Per-horse archetype labels
    const aiLabels: Text[] = [];
    for (let i = 0; i < engine.horseIds.length; i++) {
        const archetypeName = i < ARCHETYPE_NAMES.length ? ARCHETYPE_NAMES[i] : 'AI';
        const label = new Text({
            text: archetypeName,
            style: { fontSize: 14, fill: HORSE_COLORS[i % HORSE_COLORS.length], fontFamily: 'sans-serif', fontWeight: 'bold' },
        });
        label.anchor.set(0.5, 2.5);
        label.visible = false;
        label.scale.set(0.15, 0.15);
        stage.addChild(label);
        aiLabels.push(label);
    }

    // Player indicator (ring + arrow drawn around the player-controlled horse)
    const playerIndicator = new Graphics();
    stage.addChild(playerIndicator);

    // Debug trail graphics
    const trailGfx = new Graphics();
    stage.addChild(trailGfx);
    const targetArcGfx = new Graphics();
    stage.addChild(targetArcGfx);

    const teardown = (): void => {
        stage.removeChild(turf);
        turf.destroy();
        stage.removeChild(trackGfx);
        trackGfx.destroy();
        stage.removeChild(debugGfx);
        debugGfx.destroy();
        stage.removeChild(arcFanGfx);
        arcFanGfx.destroy();
        stage.removeChild(label);
        label.destroy();
        stage.removeChild(playerIndicator);
        playerIndicator.destroy();
        stage.removeChild(trailGfx);
        trailGfx.destroy();
        stage.removeChild(targetArcGfx);
        targetArcGfx.destroy();
        for (const g of horseGfx.values()) {
            stage.removeChild(g);
            g.destroy();
        }
        horseGfx.clear();
        for (const lbl of aiLabels) {
            stage.removeChild(lbl);
            lbl.destroy();
        }
    };

    const trailPrevPos: (Point | null)[] = new Array(engine.horseIds.length).fill(null);
    return { engine, trackGfx, horseGfx, aiLabels, playerIndicator, trailGfx, targetArcGfx, debugGfx, arcFanGfx, finishedHorses: new Set(), finishPositions: new Map(), finishOrder: [], raceFinished: false, trailCounter: 0, trailPrevPos, teardown };
}
