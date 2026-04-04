/**
 * AI Jockey V2 — runs trained ONNX policy models with GRU recurrent state.
 *
 * V2 models use effort+lane action space and maintain GRU hidden state
 * across ticks for race-phase planning.
 *
 * Supports both v1 (stateless, 108-dim obs) and v2 (GRU, 63-dim obs) models.
 */

import * as ort from 'onnxruntime-web';

// Load WASM backend from CDN
const ORT_VERSION = '1.24.3';
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
ort.env.wasm.numThreads = 1;

// ---------------------------------------------------------------------------
// V2 types
// ---------------------------------------------------------------------------

export type JockeyAction = {
    /** Effort level: -1 = ease up, 0 = cruise, 1 = max push */
    effort: number;
    /** Lane target: -1 = inside rail, 0 = hold, 1 = outside */
    lane: number;
};

export type JockeyStyle = {
    riskTolerance: number;  // [0, 1]
    tacticalBias: number;   // [-1, 1]: -1=front-runner, 1=closer
    skillLevel: number;     // [0, 1]
};

export type HorseProfile = {
    topSpeed: number;
    acceleration: number;
    staminaEfficiency: number;
    corneringGripLeft: number;
    corneringGripRight: number;
    climbingPower: number;
    weight: number;
    staminaPool: number;
};

export type V2Observation = {
    // Ego state
    speed: number;
    lateralVel: number;
    displacement: number;
    progress: number;
    curvature: number;
    curvatureDirection: number;  // -1=right, 0=straight, 1=left
    staminaRatio: number;

    // Horse profile
    profile: HorseProfile;

    // Jockey style
    jockeyStyle: JockeyStyle;

    // Race context
    placement: number;
    numHorses: number;
    raceElapsed: number;
    estRaceTime: number;

    // Track lookahead (next 3 segments)
    lookahead: Array<{
        curvature: number;
        turnDirection: number;
        length: number;
        slope: number;
    }>;

    // Relative horses (up to 8, sorted by proximity)
    relatives: Array<{
        tangOffset: number;
        normOffset: number;
        relSpeed: number;
        staminaEst: number;
    }>;
};

// ---------------------------------------------------------------------------
// Normalization constants (must match Python observation.py)
// ---------------------------------------------------------------------------

const MAX_SPEED = 25.0;
const MAX_DISPLACEMENT = 12.0;
const MAX_CURVATURE = 0.1;
const MAX_SEGMENT_LENGTH = 500.0;
const MAX_TANG_OFFSET = 100.0;
const MAX_NORM_OFFSET = 25.0;
const OBS_SIZE = 63;
const MAX_REL_HORSES = 8;
const GRU_HIDDEN_SIZE = 128;

// ---------------------------------------------------------------------------
// V2 AI Jockey with GRU state
// ---------------------------------------------------------------------------

export class AIJockeyV2 {
    private session: ort.InferenceSession | null = null;
    private ready = false;
    private hasGru = false;
    private hiddenState: Float32Array;
    private inputNames: string[] = [];
    private outputNames: string[] = [];

    constructor() {
        this.hiddenState = new Float32Array(GRU_HIDDEN_SIZE);
    }

    async load(modelUrl: string): Promise<void> {
        this.session = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ['wasm'],
        });
        this.inputNames = this.session.inputNames;
        this.outputNames = this.session.outputNames;
        this.hasGru = this.inputNames.length > 1;
        this.resetState();
        this.ready = true;
        console.log(`[AI-V2] Model loaded: ${modelUrl} (GRU=${this.hasGru})`);
    }

    get isReady(): boolean {
        return this.ready;
    }

    resetState(): void {
        this.hiddenState = new Float32Array(GRU_HIDDEN_SIZE);
    }

    async computeAction(obs: V2Observation): Promise<JockeyAction> {
        if (!this.session) {
            return { effort: 0, lane: 0 };
        }

        const obsArray = observationToArray(obs);
        const obsTensor = new ort.Tensor('float32', obsArray, [1, OBS_SIZE]);

        let results: ort.InferenceSession.ReturnType;
        if (this.hasGru) {
            const hiddenTensor = new ort.Tensor(
                'float32', this.hiddenState, [1, GRU_HIDDEN_SIZE]
            );
            results = await this.session.run({
                [this.inputNames[0]]: obsTensor,
                [this.inputNames[1]]: hiddenTensor,
            });
            // Update hidden state
            const newHidden = results[this.outputNames[1]];
            if (newHidden) {
                this.hiddenState = new Float32Array(newHidden.data as Float32Array);
            }
        } else {
            results = await this.session.run({
                [this.inputNames[0]]: obsTensor,
            });
        }

        const actionData = results[this.outputNames[0]].data as Float32Array;
        return {
            effort: clamp(actionData[0], -1, 1),
            lane: clamp(actionData[1], -1, 1),
        };
    }
}

// ---------------------------------------------------------------------------
// V2 AI Jockey Manager
// ---------------------------------------------------------------------------

export class AIJockeyManagerV2 {
    private shared: AIJockeyV2 = new AIJockeyV2();
    private perHorse: Map<number, AIJockeyV2> = new Map();

    async loadShared(modelUrl: string): Promise<void> {
        await this.shared.load(modelUrl);
    }

    async loadForHorse(horseIndex: number, modelUrl: string): Promise<void> {
        const jockey = new AIJockeyV2();
        await jockey.load(modelUrl);
        this.perHorse.set(horseIndex, jockey);
    }

    clearAll(): void {
        this.perHorse.clear();
    }

    resetAllStates(): void {
        this.shared.resetState();
        for (const jockey of this.perHorse.values()) {
            jockey.resetState();
        }
    }

    hasModel(horseIndex: number): boolean {
        return this.perHorse.has(horseIndex) || this.shared.isReady;
    }

    get isReady(): boolean {
        return this.shared.isReady || this.perHorse.size > 0;
    }

    async computeAction(
        horseIndex: number,
        obs: V2Observation,
    ): Promise<JockeyAction> {
        const perHorse = this.perHorse.get(horseIndex);
        if (perHorse?.isReady) {
            return perHorse.computeAction(obs);
        }
        if (this.shared.isReady) {
            return this.shared.computeAction(obs);
        }
        return { effort: 0, lane: 0 };
    }
}

// ---------------------------------------------------------------------------
// Observation serialization (must match Python observation.py exactly)
// ---------------------------------------------------------------------------

function observationToArray(obs: V2Observation): Float32Array {
    const arr = new Float32Array(OBS_SIZE);
    let idx = 0;

    // Ego state (7)
    arr[idx++] = obs.speed / MAX_SPEED;
    arr[idx++] = obs.lateralVel / MAX_SPEED;
    arr[idx++] = obs.displacement / MAX_DISPLACEMENT;
    arr[idx++] = obs.progress;
    arr[idx++] = Math.min(obs.curvature, MAX_CURVATURE) / MAX_CURVATURE;
    arr[idx++] = obs.curvatureDirection;
    arr[idx++] = obs.staminaRatio;

    // Horse profile (6)
    arr[idx++] = (obs.profile.topSpeed - 16.0) / 4.0;
    arr[idx++] = (obs.profile.acceleration - 0.5) / 1.0;
    arr[idx++] = (obs.profile.staminaEfficiency - 0.7) / 0.6;
    arr[idx++] = (obs.profile.corneringGripLeft - 0.5) / 1.0;
    arr[idx++] = (obs.profile.corneringGripRight - 0.5) / 1.0;
    arr[idx++] = (obs.profile.climbingPower - 0.5) / 1.0;

    // Jockey style (3)
    arr[idx++] = obs.jockeyStyle.riskTolerance;
    arr[idx++] = (obs.jockeyStyle.tacticalBias + 1.0) / 2.0;
    arr[idx++] = obs.jockeyStyle.skillLevel;

    // Race context (3)
    arr[idx++] = obs.placement / Math.max(1, obs.numHorses - 1);
    arr[idx++] = obs.numHorses / 20.0;
    const elapsed = obs.estRaceTime > 0 ? obs.raceElapsed / obs.estRaceTime : 0;
    arr[idx++] = Math.min(1.0, elapsed);

    // Track lookahead (12)
    for (let i = 0; i < 3; i++) {
        const seg = obs.lookahead[i] ?? { curvature: 0, turnDirection: 0, length: 0, slope: 0 };
        arr[idx++] = Math.min(seg.curvature, MAX_CURVATURE) / MAX_CURVATURE;
        arr[idx++] = seg.turnDirection;
        arr[idx++] = Math.min(seg.length, MAX_SEGMENT_LENGTH) / MAX_SEGMENT_LENGTH;
        arr[idx++] = seg.slope;
    }

    // Relative horses (32)
    for (let i = 0; i < MAX_REL_HORSES; i++) {
        const rel = obs.relatives[i];
        if (rel) {
            arr[idx++] = rel.tangOffset / MAX_TANG_OFFSET;
            arr[idx++] = rel.normOffset / MAX_NORM_OFFSET;
            arr[idx++] = rel.relSpeed / MAX_SPEED;
            arr[idx++] = rel.staminaEst;
        } else {
            idx += 4; // zeros (already initialized)
        }
    }

    return arr;
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
