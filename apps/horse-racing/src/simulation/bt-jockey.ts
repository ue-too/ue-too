/**
 * Behavior-tree AI jockey — rule-based racing agent.
 *
 * Produces HorseAction from HorseObservation using a hierarchical behavior
 * tree parameterized by JockeyPersonality for archetype variety.
 *
 * This is a synchronous, pure-computation alternative to ONNX model inference.
 * Used as a fallback when no model is assigned to a horse.
 */

import type { HorseAction, HorseObservation } from './horse-racing-engine';

// ---------------------------------------------------------------------------
// Personality — tuneable parameters that define racing style
// ---------------------------------------------------------------------------

export interface JockeyPersonality {
    earlyEffort: number;         // tangential push in early race (0–1 scale)
    kickProgress: number;        // progress threshold to start final kick
    staminaReserve: number;      // min stamina ratio before kicking
    insideBias: number;          // tendency to take inside line on curves (0–1)
    overtakeAggression: number;  // how hard to push when overtaking (0–1)
    draftSeeking: number;        // tendency to position for drafting (0–1)
}

const DEFAULT_PERSONALITY: JockeyPersonality = {
    earlyEffort: 0.4,
    kickProgress: 0.75,
    staminaReserve: 0.25,
    insideBias: 0.5,
    overtakeAggression: 0.5,
    draftSeeking: 0.5,
};

export const PERSONALITIES: Record<string, JockeyPersonality> = {
    front_runner: {
        earlyEffort: 0.8,
        kickProgress: 0.60,
        staminaReserve: 0.15,
        insideBias: 0.6,
        overtakeAggression: 0.7,
        draftSeeking: 0.2,
    },
    stalker: {
        earlyEffort: 0.35,
        kickProgress: 0.72,
        staminaReserve: 0.25,
        insideBias: 0.5,
        overtakeAggression: 0.5,
        draftSeeking: 0.8,
    },
    closer: {
        earlyEffort: 0.2,
        kickProgress: 0.85,
        staminaReserve: 0.35,
        insideBias: 0.4,
        overtakeAggression: 0.6,
        draftSeeking: 0.6,
    },
    presser: {
        earlyEffort: 0.6,
        kickProgress: 0.70,
        staminaReserve: 0.20,
        insideBias: 0.5,
        overtakeAggression: 0.8,
        draftSeeking: 0.3,
    },
    // Degenerate personalities for testing
    full_throttle: {
        earlyEffort: 1.0,
        kickProgress: 0.0,
        staminaReserve: 0.0,
        insideBias: 0.3,
        overtakeAggression: 0.9,
        draftSeeking: 0.0,
    },
    passive: {
        earlyEffort: 0.0,
        kickProgress: 1.0,
        staminaReserve: 0.0,
        insideBias: 0.3,
        overtakeAggression: 0.0,
        draftSeeking: 0.0,
    },
    blocker: {
        earlyEffort: 0.4,
        kickProgress: 0.80,
        staminaReserve: 0.20,
        insideBias: 0.9,
        overtakeAggression: 0.2,
        draftSeeking: 0.0,
    },
};

// ---------------------------------------------------------------------------
// BT node types
// ---------------------------------------------------------------------------

interface ActionOutput {
    tangential: number;
    normal: number;
    weight: number;
}

type BTNode = (obs: BTObs, p: JockeyPersonality) => ActionOutput | null;

/** Simplified observation used by the BT — extracted from HorseObservation. */
interface BTObs {
    tangentialVel: number;
    normalVel: number;
    displacement: number;
    trackProgress: number;
    curvature: number;
    nextCurvature: number;
    staminaRatio: number;
    relatives: { tangOff: number; normOff: number; relTangVel: number; relNormVel: number; progressDiff?: number }[];
}

// ---------------------------------------------------------------------------
// Leaf behaviors
// ---------------------------------------------------------------------------

function emergencyBrake(_obs: BTObs, _p: JockeyPersonality): ActionOutput {
    return { tangential: 0, normal: 0, weight: 1 };
}

function gateBreak(_obs: BTObs, p: JockeyPersonality): ActionOutput {
    return { tangential: 2 + p.earlyEffort * 3, normal: 0, weight: 1 };
}

function paceControl(obs: BTObs, p: JockeyPersonality): ActionOutput {
    const base = p.earlyEffort * 3;
    const phaseMult = 1 + obs.trackProgress * 0.3;
    let effort = base * phaseMult;

    const expectedStamina = 1 - obs.trackProgress * 0.85;
    if (obs.staminaRatio < expectedStamina - 0.1) {
        effort *= 0.3;
    } else if (obs.staminaRatio < expectedStamina) {
        effort *= 0.7;
    }

    return { tangential: effort, normal: 0, weight: 0.6 };
}

function corneringLine(obs: BTObs, p: JockeyPersonality): ActionOutput | null {
    if (Math.abs(obs.curvature) < 1e-4) {
        // On straights, pre-position for upcoming curve
        if (Math.abs(obs.nextCurvature) > 1e-6) {
            const insideSign = obs.nextCurvature > 0 ? -1 : 1;
            const targetDisp = insideSign * 6 * p.insideBias;
            const error = targetDisp - obs.displacement;
            const steer = error * 0.3;
            return { tangential: 0, normal: clamp(steer, -2, 2), weight: 0.3 };
        }
        // Otherwise gently drift toward center
        if (Math.abs(obs.displacement) > 2) {
            const correction = -obs.displacement * 0.3;
            return { tangential: 0, normal: clamp(correction, -2, 2), weight: 0.2 };
        }
        return null;
    }

    const targetDisp = -8 * p.insideBias;
    const error = targetDisp - obs.displacement;
    const steer = error * 0.4;
    return { tangential: 0, normal: clamp(steer, -4, 4), weight: 0.4 };
}

function drafting(obs: BTObs, p: JockeyPersonality): ActionOutput | null {
    for (const rel of obs.relatives) {
        if (rel.tangOff > 3 && rel.tangOff < 20) {
            const lateralCorrection = rel.normOff * 0.3 * p.draftSeeking;
            const speedMatch = rel.relTangVel * 0.2;
            return {
                tangential: speedMatch,
                normal: clamp(lateralCorrection, -2, 2),
                weight: 0.3 * p.draftSeeking,
            };
        }
        if (rel.tangOff > 20) break;
    }
    return null;
}

function kick(obs: BTObs, p: JockeyPersonality): ActionOutput {
    if (obs.staminaRatio < p.staminaReserve * 0.5) {
        return { tangential: 0.5, normal: 0, weight: 0.6 };
    }
    if (obs.staminaRatio < p.staminaReserve) {
        return { tangential: 2, normal: 0, weight: 0.6 };
    }

    const remainingRace = Math.max(1 - obs.trackProgress, 0.02);
    const intensity = Math.min(1, obs.staminaRatio / (remainingRace * 2));
    return { tangential: 3 + intensity * 4, normal: 0, weight: 0.6 };
}

function overtakeLine(obs: BTObs, p: JockeyPersonality): ActionOutput | null {
    for (const rel of obs.relatives) {
        if (Math.abs(rel.tangOff) < 5 && Math.abs(rel.normOff) < 8) {
            let steer: number;
            if (obs.displacement > 0) {
                steer = rel.normOff > 0
                    ? -3 * p.overtakeAggression
                    : 2 * p.overtakeAggression;
            } else {
                steer = rel.normOff < 0
                    ? 2 * p.overtakeAggression
                    : -2 * p.overtakeAggression;
            }
            return {
                tangential: 2 * p.overtakeAggression,
                normal: clamp(steer, -4, 4),
                weight: 0.4 * p.overtakeAggression,
            };
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Composite nodes
// ---------------------------------------------------------------------------

function selector(children: BTNode[]): BTNode {
    return (obs, p) => {
        for (const child of children) {
            const r = child(obs, p);
            if (r !== null) return r;
        }
        return null;
    };
}

function condition(
    predicate: (obs: BTObs, p: JockeyPersonality) => boolean,
    child: BTNode,
): BTNode {
    return (obs, p) => predicate(obs, p) ? child(obs, p) : null;
}

function blend(children: BTNode[]): BTNode {
    return (obs, p) => {
        const results: ActionOutput[] = [];
        for (const child of children) {
            const r = child(obs, p);
            if (r !== null) results.push(r);
        }
        if (results.length === 0) return null;
        const totalW = results.reduce((s, r) => s + r.weight, 0);
        if (totalW < 1e-9) return { tangential: 0, normal: 0, weight: 0 };
        return {
            tangential: results.reduce((s, r) => s + r.tangential * r.weight, 0) / totalW,
            normal: results.reduce((s, r) => s + r.normal * r.weight, 0) / totalW,
            weight: totalW,
        };
    };
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

function buildDefaultTree(): BTNode {
    return selector([
        condition((obs) => obs.staminaRatio < 0.15, emergencyBrake),
        condition((obs) => obs.trackProgress < 0.08, gateBreak),
        condition((obs) => obs.trackProgress < 0.40, blend([paceControl, corneringLine])),
        condition((obs) => obs.trackProgress < 0.75, blend([paceControl, drafting, corneringLine])),
        condition((obs) => obs.trackProgress >= 0.75, blend([kick, overtakeLine, corneringLine])),
        (_obs, _p) => ({ tangential: 0, normal: 0, weight: 1 }),
    ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the BT-relevant fields from a HorseObservation + allObservations.
 */
function extractBTObs(
    obs: HorseObservation,
    horseIndex: number,
    allObs: HorseObservation[],
): BTObs {
    const curvature = obs.turnRadius < 1e6 ? 1 / obs.turnRadius : 0;
    const staminaRatio = obs.maxStamina > 0 ? obs.currentStamina / obs.maxStamina : 0;

    const relatives: BTObs['relatives'] = [];
    for (let j = 0; j < allObs.length; j++) {
        if (j === horseIndex) continue;
        const other = allObs[j];
        const dx = other.position.x - obs.position.x;
        const dy = other.position.y - obs.position.y;
        const tangOff = dx * obs.tangential.x + dy * obs.tangential.y;
        const normOff = dx * obs.normal.x + dy * obs.normal.y;
        const dvx = other.velocity.x - obs.velocity.x;
        const dvy = other.velocity.y - obs.velocity.y;
        const relTangVel = dvx * obs.tangential.x + dvy * obs.tangential.y;
        const relNormVel = dvx * obs.normal.x + dvy * obs.normal.y;
        const progressDiff = other.trackProgress - obs.trackProgress;
        relatives.push({ tangOff, normOff, relTangVel, relNormVel, progressDiff });
    }
    relatives.sort((a, b) => (b.progressDiff ?? 0) - (a.progressDiff ?? 0));

    return {
        tangentialVel: obs.tangentialVel,
        normalVel: obs.normalVel,
        displacement: obs.displacement,
        trackProgress: obs.trackProgress,
        curvature,
        nextCurvature: obs.nextCurvature ?? 0,
        staminaRatio,
        relatives,
    };
}

export class BTJockey {
    readonly personality: JockeyPersonality;
    private tree: BTNode;

    constructor(personality?: JockeyPersonality) {
        this.personality = personality ?? DEFAULT_PERSONALITY;
        this.tree = buildDefaultTree();
    }

    computeAction(
        obs: HorseObservation,
        horseIndex: number,
        allObs: HorseObservation[],
    ): HorseAction {
        const btObs = extractBTObs(obs, horseIndex, allObs);
        const result = this.tree(btObs, this.personality);
        if (!result) {
            return { extraTangential: 0, extraNormal: 0 };
        }
        return {
            extraTangential: clamp(result.tangential, -10, 10),
            extraNormal: clamp(result.normal, -5, 5),
        };
    }
}

export function makeBTJockey(archetype?: string): BTJockey {
    const personality = archetype && archetype in PERSONALITIES
        ? PERSONALITIES[archetype]
        : DEFAULT_PERSONALITY;
    return new BTJockey(personality);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
