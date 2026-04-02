/**
 * AI Jockey — runs trained ONNX policy models in the browser to control horses.
 *
 * Supports both a single shared model (all AI horses use the same policy)
 * and per-horse models (each horse has its own specialized policy).
 *
 * The model takes a 102-dimensional observation (94 continuous features +
 * 8 binary modifier flags) and outputs a 2D action
 * [extraTangential, extraNormal].
 */

import * as ort from 'onnxruntime-web';

import type { HorseAction } from './horse-racing-engine';
import type { HorseObservation } from './horse-racing-engine';

// Load WASM backend from CDN to avoid Vite's public/ import restrictions
const ORT_VERSION = '1.24.3';
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
// Disable multi-threading to avoid SharedArrayBuffer issues in dev
ort.env.wasm.numThreads = 1;

export class AIJockey {
    private session: ort.InferenceSession | null = null;
    private ready = false;

    /**
     * Load an ONNX model from a URL.
     * @param modelUrl - URL to the .onnx file (e.g., '/models/horse_jockey.onnx')
     */
    async load(modelUrl: string): Promise<void> {
        this.session = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ['wasm'],
        });
        this.ready = true;
    }

    get isReady(): boolean {
        return this.ready;
    }

    /**
     * Compute an action from a horse observation.
     */
    async computeAction(obs: HorseObservation): Promise<HorseAction> {
        if (!this.session) {
            return { extraTangential: 0, extraNormal: 0 };
        }

        const obsArray = observationToArray(obs);
        const tensor = new ort.Tensor('float32', obsArray, [1, OBS_SIZE]);
        const results = await this.session.run({ obs: tensor });
        const actionData = results.action.data as Float32Array;

        return {
            extraTangential: clamp(actionData[0], -10, 10),
            extraNormal: clamp(actionData[1], -5, 5),
        };
    }

    /**
     * Compute actions for multiple horses (batched for efficiency).
     */
    async computeActions(observations: HorseObservation[]): Promise<HorseAction[]> {
        if (!this.session || observations.length === 0) {
            return observations.map(() => ({ extraTangential: 0, extraNormal: 0 }));
        }

        const batchSize = observations.length;
        const obsFlat = new Float32Array(batchSize * OBS_SIZE);
        for (let i = 0; i < batchSize; i++) {
            const arr = observationToArray(observations[i]);
            obsFlat.set(arr, i * OBS_SIZE);
        }

        const tensor = new ort.Tensor('float32', obsFlat, [batchSize, OBS_SIZE]);
        const results = await this.session.run({ obs: tensor });
        const actionData = results.action.data as Float32Array;

        const actions: HorseAction[] = [];
        for (let i = 0; i < batchSize; i++) {
            actions.push({
                extraTangential: clamp(actionData[i * 2], -10, 10),
                extraNormal: clamp(actionData[i * 2 + 1], -5, 5),
            });
        }
        return actions;
    }
}

// ---------------------------------------------------------------------------
// AIJockeyManager — manages per-horse AI models
// ---------------------------------------------------------------------------

/**
 * Manages multiple AI jockeys, supporting both shared and per-horse models.
 *
 * Usage:
 * - Shared model: `loadShared('/models/horse_jockey.onnx')` — all AI horses use one model
 * - Per-horse: `loadForHorse(0, '/models/horse_0.onnx')` — horse 0 gets its own model
 * - Per-horse models take priority over shared when both are loaded
 */
export class AIJockeyManager {
    private shared: AIJockey = new AIJockey();
    private perHorse: Map<number, AIJockey> = new Map();

    async loadShared(modelUrl: string): Promise<void> {
        await this.shared.load(modelUrl);
        console.log(`[AI] Shared model loaded from ${modelUrl}`);
    }

    async loadForHorse(horseIndex: number, modelUrl: string): Promise<void> {
        const jockey = new AIJockey();
        await jockey.load(modelUrl);
        this.perHorse.set(horseIndex, jockey);
        console.log(`[AI] Horse ${horseIndex} model loaded from ${modelUrl}`);
    }

    clearAll(): void {
        this.perHorse.clear();
    }

    hasModel(horseIndex: number): boolean {
        return this.perHorse.has(horseIndex) || this.shared.isReady;
    }

    get isReady(): boolean {
        return this.shared.isReady || this.perHorse.size > 0;
    }

    /**
     * Compute actions for the given horse indices.
     * Uses per-horse model if available, falls back to shared model.
     * @param allObservations - ALL horse observations (needed for relative positions)
     */
    async computeActions(
        horseIndices: number[],
        observations: HorseObservation[],
        allObservations?: HorseObservation[],
    ): Promise<Map<number, HorseAction>> {
        const result = new Map<number, HorseAction>();

        // Group by model: per-horse vs shared
        const sharedIndices: number[] = [];
        const sharedObs: HorseObservation[] = [];

        for (let j = 0; j < horseIndices.length; j++) {
            const idx = horseIndices[j];
            const obs = observations[j];
            const perHorseJockey = this.perHorse.get(idx);

            if (perHorseJockey?.isReady) {
                const obsArray = observationToArray(obs, idx, allObservations);
                const tensor = new ort.Tensor('float32', obsArray, [1, OBS_SIZE]);
                const results = await perHorseJockey['session']!.run({ obs: tensor });
                const actionData = results.action.data as Float32Array;
                result.set(idx, {
                    extraTangential: clamp(actionData[0], -10, 10),
                    extraNormal: clamp(actionData[1], -5, 5),
                });
            } else {
                sharedIndices.push(idx);
                sharedObs.push(obs);
            }
        }

        // Batch shared model inference
        if (sharedIndices.length > 0 && this.shared.isReady) {
            const batchSize = sharedIndices.length;
            const obsFlat = new Float32Array(batchSize * OBS_SIZE);
            for (let j = 0; j < batchSize; j++) {
                const arr = observationToArray(sharedObs[j], sharedIndices[j], allObservations);
                obsFlat.set(arr, j * OBS_SIZE);
            }
            const tensor = new ort.Tensor('float32', obsFlat, [batchSize, OBS_SIZE]);
            const results = await this.shared['session']!.run({ obs: tensor });
            const actionData = results.action.data as Float32Array;
            for (let j = 0; j < batchSize; j++) {
                result.set(sharedIndices[j], {
                    extraTangential: clamp(actionData[j * 2], -10, 10),
                    extraNormal: clamp(actionData[j * 2 + 1], -5, 5),
                });
            }
        }

        return result;
    }
}

// ---------------------------------------------------------------------------
// Observation conversion
// ---------------------------------------------------------------------------

const MAX_REL_HORSES = 19;
const OBS_SIZE = 108;

function observationToArray(
    obs: HorseObservation,
    horseIndex?: number,
    allObs?: HorseObservation[],
): Float32Array {
    const corneringMargin = obs.corneringMargin === Infinity
        ? 1000.0
        : Math.min(obs.corneringMargin, 1000.0);

    // Compute relative positions & velocities to other horses (sorted by track progress, ahead first)
    const relFlat = new Float32Array(MAX_REL_HORSES * 4); // 19 × 4 = 76, initialized to 0
    if (allObs && horseIndex !== undefined) {
        const relatives: { progressDiff: number; tang: number; norm: number; relTangVel: number; relNormVel: number }[] = [];
        for (let j = 0; j < allObs.length; j++) {
            if (j === horseIndex) continue;
            const other = allObs[j];
            const dx = other.position.x - obs.position.x;
            const dy = other.position.y - obs.position.y;
            const tang = dx * obs.tangential.x + dy * obs.tangential.y;
            const norm = dx * obs.normal.x + dy * obs.normal.y;
            const dvx = other.velocity.x - obs.velocity.x;
            const dvy = other.velocity.y - obs.velocity.y;
            const relTangVel = dvx * obs.tangential.x + dvy * obs.tangential.y;
            const relNormVel = dvx * obs.normal.x + dvy * obs.normal.y;
            const progressDiff = other.trackProgress - obs.trackProgress;
            relatives.push({ progressDiff, tang, norm, relTangVel, relNormVel });
        }
        // Descending by progress: horses ahead come first
        relatives.sort((a, b) => b.progressDiff - a.progressDiff);
        for (let j = 0; j < MAX_REL_HORSES && j < relatives.length; j++) {
            const r = relatives[j];
            relFlat[j * 4]     = r.tang;
            relFlat[j * 4 + 1] = r.norm;
            relFlat[j * 4 + 2] = r.relTangVel;
            relFlat[j * 4 + 3] = r.relNormVel;
        }
    }

    // Map from Python snake_case MODIFIER_IDS to browser camelCase modifier IDs.
    // The ONNX model expects flags in Python's order.
    const MODIFIER_ID_MAP: [string, string][] = [
        ['drafting',       'drafting'],
        ['pack_pressure',  'packPressure'],
        ['pack_anxiety',   'packAnxiety'],
        ['front_runner',   'frontRunner'],
        ['closer',         'closer'],
        ['mudder',         'mudder'],
        ['gate_speed',     'gateSpeed'],
        ['endurance',      'endurance'],
    ];
    const activeIds = obs.activeModifierIds ?? new Set<string>();

    const arr = new Float32Array(OBS_SIZE);
    // Ego features [0-7]
    arr[0] = obs.tangentialVel;
    arr[1] = obs.normalVel;
    arr[2] = obs.displacement;
    arr[3] = obs.trackProgress;
    arr[4] = obs.turnRadius < 1e6 ? 1 / obs.turnRadius : 0;
    arr[5] = obs.currentStamina / obs.maxStamina;
    arr[6] = obs.effectiveCruiseSpeed;
    arr[7] = obs.effectiveMaxSpeed;
    // Relative horses [8-83]
    arr.set(relFlat, 8);
    // Track/attribute features [84-93]
    arr[84] = corneringMargin;
    arr[85] = obs.slope;
    arr[86] = obs.pushingPower;
    arr[87] = obs.pushResistance;
    arr[88] = obs.forwardAccel;
    arr[89] = obs.turnAccel;
    arr[90] = obs.corneringGrip;
    arr[91] = obs.drainRateMult;
    arr[92] = obs.placementNorm;
    arr[93] = obs.numHorses / 20.0; // normalize to [0, 1]
    // Modifier flags [94-101]
    for (let k = 0; k < MODIFIER_ID_MAP.length; k++) {
        arr[94 + k] = activeIds.has(MODIFIER_ID_MAP[k][1]) ? 1.0 : 0.0;
    }
    // Skill flags [102-107]
    const SKILL_IDS = [
        'staminaManagement', 'sprintTiming', 'overtake',
        'draftingExploit', 'corneringLine', 'pacePressure',
    ];
    const skillIds = obs.activeSkillIds ?? new Set<string>();
    for (let k = 0; k < SKILL_IDS.length; k++) {
        arr[102 + k] = skillIds.has(SKILL_IDS[k]) ? 5.0 : 0.0;
    }
    return arr;
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
