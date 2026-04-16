import {
    OPPONENT_SLOT_SIZE,
    OPPONENT_SLOTS,
    SELF_STATE_SIZE,
    TRACK_CONTEXT_SIZE,
    buildObservations,
} from '../simulation/observation';
import type { Race } from '../simulation/race';
import type { InputState } from '../simulation/types';
import type { Jockey } from './types';

const OPP_BASE = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE; // 26

const STATE_CRUISE = 0;
const STATE_PASSING = 1;
const STATE_KICK = 2;
const STATE_SETTLING = 3;

/**
 * Tunable BT parameters — keep **all fields and default numbers** in sync with
 * `horse_racing/opponents/behavior_tree.py` (`BTConfig` + defaults + archetypes)
 * in the hr-simulation repo (camelCase here ↔ snake_case there).
 */
export interface BTConfig {
    cruiseLow: number;
    cruiseHigh: number;
    targetLane: number;
    lateralAggression: number;
    kickPhase: number;
    kickEarlyMargin: number;
    kickLateCap: number;
    blockProgressMax: number;
    blockLateralTol: number;
    blockMinSlowness: number;
    conserveThreshold: number;
    passMinTicks: number;
    passClearLateral: number;
    passCooldownTicks: number;
    settleTicks: number;
    transitionMinTicks: number;
    defendOnScore: number;
    defendOffScore: number;
    defendTangMin: number;
    defendDrift: number;
    wPass: number;
    wKick: number;
    wDraft: number;
    /** Lateral error above this (|lateral - target|) triggers tangential rating. */
    offLanePenaltyStart: number;
    /** Extra lateral error beyond start is multiplied by this for tangential penalty. */
    offLaneTangPenaltyScale: number;
    /** Maximum tangential subtracted while converging on lane (cruise / settle only). */
    offLaneTangPenaltyMax: number;
    /** Multiplier on geometric lane penalty: below 1 favors momentum, above 1 favors coasting to the lane. */
    offLaneDecelScale: number;
    /**
     * Add back tangential after lane penalty (capped at cruise tang).
     * Positive values favor keeping drive while shifting (accelerate-through lean).
     */
    offLaneAccelRelief: number;
}

/** Default BT tuning values — keep in sync with Python `BTConfig`. */
export const DEFAULT_CONFIG: BTConfig = {
    cruiseLow: 0.55,
    cruiseHigh: 0.70,
    targetLane: -0.90,
    lateralAggression: 0.7,
    kickPhase: 0.75,
    kickEarlyMargin: 0.10,
    kickLateCap: 0.92,
    blockProgressMax: 0.03,
    blockLateralTol: 0.15,
    blockMinSlowness: 0.03,
    conserveThreshold: 0.30,
    passMinTicks: 40,
    passClearLateral: 0.25,
    passCooldownTicks: 80,
    settleTicks: 40,
    transitionMinTicks: 30,
    defendOnScore: 0.6,
    defendOffScore: 0.3,
    defendTangMin: 0.5,
    defendDrift: 0.15,
    wPass: 1.0,
    wKick: 1.0,
    wDraft: 1.0,
    offLanePenaltyStart: 0.06,
    offLaneTangPenaltyScale: 0.5,
    offLaneTangPenaltyMax: 0.18,
    offLaneDecelScale: 1.0,
    offLaneAccelRelief: 0.0,
};

// ============================================================
// Archetypes — weight profiles for different racing styles.
// Must match `ARCHETYPES` / archetype_*() in behavior_tree.py (same keys & values).
// ============================================================

export const ARCHETYPES: Record<string, Partial<BTConfig>> = {
    stalker: {
        targetLane: -0.85,
        lateralAggression: 0.65,
        wDraft: 1.3,
        offLanePenaltyStart: 0.06,
        offLaneTangPenaltyMax: 0.16,
        offLaneDecelScale: 1.0,
        offLaneAccelRelief: 0.03,
    },
    'front-runner': {
        cruiseLow: 0.72,
        cruiseHigh: 0.85,
        targetLane: -0.92,
        lateralAggression: 0.85,
        kickPhase: 0.65,
        kickEarlyMargin: 0.05,
        kickLateCap: 0.88,
        blockMinSlowness: 0.01,
        passCooldownTicks: 40,
        defendDrift: 0.20,
        wPass: 1.3,
        wKick: 1.2,
        wDraft: 0.5,
        // Stay on the gas near the rail; only rate if badly wrong-side.
        offLanePenaltyStart: 0.10,
        offLaneTangPenaltyScale: 0.35,
        offLaneTangPenaltyMax: 0.10,
        offLaneDecelScale: 0.75,
        offLaneAccelRelief: 0.07,
    },
    closer: {
        cruiseLow: 0.48,
        cruiseHigh: 0.60,
        targetLane: -0.75,
        lateralAggression: 0.6,
        kickPhase: 0.78,
        kickEarlyMargin: 0.06,
        kickLateCap: 0.92,
        conserveThreshold: 0.40,
        settleTicks: 50,
        defendOnScore: 0.8,
        wPass: 0.7,
        wKick: 1.5,
        wDraft: 1.8,
        // Willing to rate to reach a wide lane early (less abreast stacking).
        offLanePenaltyStart: 0.04,
        offLaneTangPenaltyScale: 0.65,
        offLaneTangPenaltyMax: 0.24,
        offLaneDecelScale: 1.25,
        offLaneAccelRelief: 0.0,
    },
    speedball: {
        cruiseLow: 0.60,
        cruiseHigh: 0.75,
        targetLane: -0.80,
        lateralAggression: 0.8,
        kickPhase: 0.70,
        kickEarlyMargin: 0.10,
        kickLateCap: 0.88,
        blockMinSlowness: 0.005,
        passMinTicks: 30,
        passCooldownTicks: 30,
        wPass: 1.5,
        wKick: 0.9,
        wDraft: 0.6,
        offLanePenaltyStart: 0.08,
        offLaneTangPenaltyScale: 0.38,
        offLaneTangPenaltyMax: 0.10,
        offLaneDecelScale: 0.7,
        offLaneAccelRelief: 0.09,
    },
    steady: {
        cruiseLow: 0.58,
        cruiseHigh: 0.68,
        targetLane: -0.88,
        lateralAggression: 0.65,
        kickPhase: 0.80,
        blockMinSlowness: 0.08,
        passCooldownTicks: 150,
        defendOnScore: 0.9,
        wPass: 0.5,
        wKick: 0.8,
        wDraft: 1.0,
        offLanePenaltyStart: 0.07,
        offLaneTangPenaltyMax: 0.14,
        offLaneDecelScale: 1.05,
        offLaneAccelRelief: 0.02,
    },
    drifter: {
        cruiseLow: 0.52,
        cruiseHigh: 0.65,
        targetLane: -0.82,
        lateralAggression: 0.65,
        kickPhase: 0.78,
        wPass: 1.0,
        wKick: 1.05,
        wDraft: 1.2,
        offLanePenaltyStart: 0.055,
        offLaneTangPenaltyScale: 0.42,
        offLaneTangPenaltyMax: 0.14,
        offLaneDecelScale: 0.95,
        offLaneAccelRelief: 0.04,
    },
};

/** Archetype name → merged defaults (for batch tuning / inspectors). */
export function mergeBtConfig(
    archetype: string,
    overrides?: Partial<BTConfig>
): BTConfig {
    const base = ARCHETYPES[archetype] ?? {};
    return { ...DEFAULT_CONFIG, ...base, ...(overrides ?? {}) };
}

/** Sorted archetype keys for UI dropdowns — kept in sync by register/remove. */
export let BT_ARCHETYPE_IDS: string[] = Object.keys(ARCHETYPES).sort((a, b) =>
    a.localeCompare(b)
);

function rebuildIds(): void {
    BT_ARCHETYPE_IDS = Object.keys(ARCHETYPES).sort((a, b) =>
        a.localeCompare(b)
    );
}

/**
 * Register (or overwrite) a named archetype at runtime.
 * The config is stored as overrides from DEFAULT_CONFIG.
 */
export function registerArchetype(
    name: string,
    config: Partial<BTConfig>
): void {
    ARCHETYPES[name] = { ...config };
    rebuildIds();
}

/** Remove a runtime-registered archetype. Built-in names can be removed too. */
export function removeArchetype(name: string): boolean {
    if (!(name in ARCHETYPES)) return false;
    delete ARCHETYPES[name];
    rebuildIds();
    return true;
}

/** Names of the original built-in archetypes (safe to check before deleting). */
export const BUILTIN_ARCHETYPE_NAMES = new Set([
    'stalker',
    'front-runner',
    'closer',
    'speedball',
    'steady',
    'drifter',
]);

interface HorseState {
    state: number;
    ticks: number;
    cooldown: number;
    globalTick: number;
    lastTransitionTick: number;
    defending: boolean;
    settleFromLane: number;
}

/**
 * Utility-scored jockey with committed maneuvers and reactive overlays.
 *
 * States: CRUISE / PASSING / KICK / SETTLING.
 * Each tick the utility selector scores CRUISE, PASS, and KICK; the highest
 * wins (subject to commitment windows and transition budgets). A defensive
 * overlay nudges outputs when an opponent threatens to pass, without adding
 * a dedicated state.
 *
 * Archetypes are expressed as weight profiles over the scoring functions
 * plus a few direct constants (target lane, cruise band, kick timing).
 */
export class BTJockey implements Jockey {
    private config: BTConfig;
    private disposed = false;
    private states = new Map<number, HorseState>();

    constructor(config: Partial<BTConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    infer(race: Race): Map<number, InputState> {
        return this.computeActions(race);
    }

    async inferAsync(
        race: Race,
        horseIds?: number[]
    ): Promise<Map<number, InputState>> {
        return this.computeActions(race, horseIds);
    }

    resetFrames(): void {
        this.states.clear();
    }

    private getState(id: number): HorseState {
        let s = this.states.get(id);
        if (!s) {
            s = {
                state: STATE_CRUISE,
                ticks: 0,
                cooldown: 0,
                globalTick: 0,
                lastTransitionTick: -999,
                defending: false,
                settleFromLane: 0,
            };
            this.states.set(id, s);
        }
        return s;
    }

    private transition(st: HorseState, newState: number): void {
        st.state = newState;
        st.ticks = 0;
        st.lastTransitionTick = st.globalTick;
    }

    // ---- Utility scoring ----

    private scoreCruise(obs: Float64Array, staminaFrac: number): number {
        let score = 1.0;
        if (this.isDrafting(obs)) {
            score += (0.2 + (1.0 - staminaFrac) * 0.3) * this.config.wDraft;
        }
        return score;
    }

    private scorePass(obs: Float64Array): number {
        const cfg = this.config;
        let best = -10;
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
            if (obs[base] < 0.5) continue;
            const progressDelta = obs[base + 1];
            const tvelDelta = obs[base + 2];
            const normalOffset = obs[base + 3];
            if (!(progressDelta > 0 && progressDelta < cfg.blockProgressMax)) continue;
            if (Math.abs(normalOffset) > cfg.blockLateralTol) continue;
            if (tvelDelta >= -cfg.blockMinSlowness) continue;
            const severity = Math.abs(tvelDelta);
            const lateralCost = Math.abs(normalOffset);
            best = Math.max(best, 0.3 + severity * 5.0 - lateralCost * 2.0);
        }
        return best < 0 ? -10 : best * cfg.wPass;
    }

    private scoreKick(progress: number, staminaFrac: number): number {
        const cfg = this.config;
        const remaining = 1.0 - progress;
        const earlyPhase = cfg.kickPhase - cfg.kickEarlyMargin;
        const latePhase = Math.min(cfg.kickPhase + cfg.kickEarlyMargin, cfg.kickLateCap);
        if (progress < earlyPhase) return -10;
        if (progress >= latePhase) return 10;
        const sustainability = staminaFrac - remaining * 1.5;
        if (sustainability <= 0) return -1;
        return (0.5 + sustainability * 3.0) * cfg.wKick;
    }

    // ---- Perception helpers ----

    private isDrafting(obs: Float64Array): boolean {
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
            if (obs[base] < 0.5) continue;
            if (obs[base + 1] > 0.01 && obs[base + 1] < 0.05
                && Math.abs(obs[base + 3]) < 0.10
                && obs[base + 2] >= -0.02) {
                return true;
            }
        }
        return false;
    }

    private stillBlocked(obs: Float64Array): boolean {
        const cfg = this.config;
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
            if (obs[base] < 0.5) continue;
            const progressDelta = obs[base + 1];
            const normalOffset = obs[base + 3];
            if (progressDelta > -0.01 && progressDelta < cfg.blockProgressMax
                && normalOffset < -cfg.passClearLateral) {
                return true;
            }
        }
        return false;
    }

    private isBlockedDuringKick(obs: Float64Array): boolean {
        const cfg = this.config;
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
            if (obs[base] < 0.5) continue;
            if (obs[base + 1] > 0 && obs[base + 1] < cfg.blockProgressMax
                && Math.abs(obs[base + 3]) < cfg.blockLateralTol
                && obs[base + 2] < -cfg.blockMinSlowness) {
                return true;
            }
        }
        return false;
    }

    private computeThreatScore(obs: Float64Array): number {
        let max = 0;
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
            if (obs[base] < 0.5) continue;
            const pd = obs[base + 1];
            const tv = obs[base + 2];
            const no = obs[base + 3];
            if (pd >= -0.03 && pd < 0 && tv > 0.03 && no > 0.05) {
                max = Math.max(max, tv * 5.0 + (1.0 - Math.abs(pd) / 0.03) * 0.3);
            }
        }
        return max;
    }

    // ---- Defensive overlay ----

    private applyDefense(
        input: InputState,
        obs: Float64Array,
        st: HorseState,
        staminaFrac: number,
    ): InputState {
        const cfg = this.config;
        const threat = this.computeThreatScore(obs);
        if (!st.defending && threat > cfg.defendOnScore) st.defending = true;
        else if (st.defending && threat < cfg.defendOffScore) st.defending = false;
        if (!st.defending || staminaFrac < 0.30) return input;
        return {
            tangential: Math.max(input.tangential, cfg.defendTangMin),
            normal: input.normal + cfg.defendDrift,
        };
    }

    // ---- Shared steering / speed helpers ----

    private steerToLane(lateralNorm: number, targetLane: number): number {
        const err = lateralNorm - targetLane;
        if (Math.abs(err) < 0.05) return 0;
        return err > 0
            ? -0.5 * this.config.lateralAggression
            : 0.5 * this.config.lateralAggression;
    }

    private cruiseSpeed(speedRatio: number, staminaFrac: number): number {
        const cfg = this.config;
        let tang: number;
        if (speedRatio < cfg.cruiseLow - 0.05) tang = 0.5;
        else if (speedRatio > cfg.cruiseHigh + 0.05) tang = 0.0;
        else tang = 0.25;
        if (staminaFrac < cfg.conserveThreshold) tang = Math.min(tang, 0.25);
        return tang;
    }

    /**
     * Reduce tangential when far from lane target so the field does not stay
     * perfectly abreast on straights — horses "rate" slightly while changing lanes.
     * Applied in CRUISE and SETTLING only (not PASSING / KICK).
     */
    private rateForLaneConvergence(
        tang: number,
        lateralNorm: number,
        targetLane: number,
    ): number {
        const cfg = this.config;
        const err = Math.abs(lateralNorm - targetLane);
        if (err <= cfg.offLanePenaltyStart) return tang;
        const excess = err - cfg.offLanePenaltyStart;
        const raw = excess * cfg.offLaneTangPenaltyScale * cfg.offLaneDecelScale;
        const penalty = Math.min(cfg.offLaneTangPenaltyMax, raw);
        let out = tang - penalty + cfg.offLaneAccelRelief;
        out = Math.max(0, Math.min(tang, out));
        return out;
    }

    // ---- State actions ----

    private doCruise(
        speedRatio: number,
        staminaFrac: number,
        lateralNorm: number,
    ): InputState {
        const cfg = this.config;
        let tang = this.cruiseSpeed(speedRatio, staminaFrac);
        tang = this.rateForLaneConvergence(tang, lateralNorm, cfg.targetLane);
        return {
            tangential: tang,
            normal: this.steerToLane(lateralNorm, cfg.targetLane),
        };
    }

    private doPass(staminaFrac: number): InputState {
        const tang = staminaFrac > this.config.conserveThreshold ? 0.75 : 0.5;
        return { tangential: tang, normal: 0.5 };
    }

    private doKick(obs: Float64Array, lateralNorm: number): InputState {
        if (this.isBlockedDuringKick(obs)) {
            return { tangential: 1.0, normal: 0.5 };
        }
        return { tangential: 1.0, normal: this.steerToLane(lateralNorm, this.config.targetLane) };
    }

    private doSettle(
        st: HorseState,
        speedRatio: number,
        staminaFrac: number,
        lateralNorm: number,
    ): InputState {
        const cfg = this.config;
        const t = Math.min(st.ticks / cfg.settleTicks, 1.0);
        const target = st.settleFromLane + (cfg.targetLane - st.settleFromLane) * t;
        let tang = this.cruiseSpeed(speedRatio, staminaFrac);
        tang = this.rateForLaneConvergence(tang, lateralNorm, target);
        return {
            tangential: tang,
            normal: this.steerToLane(lateralNorm, target),
        };
    }

    // ---- Main decision loop ----

    private decide(obs: Float64Array, horseId: number): InputState {
        const cfg = this.config;
        const progress = obs[0];
        const speedRatio = obs[1];
        const staminaFrac = obs[3];
        const lateralNorm = obs[15];
        const st = this.getState(horseId);
        st.globalTick++;

        // KICK is absorbing — once entered, never leave
        if (st.state === STATE_KICK) {
            st.ticks++;
            return this.applyDefense(this.doKick(obs, lateralNorm), obs, st, staminaFrac);
        }

        // PASSING: committed for passMinTicks
        if (st.state === STATE_PASSING) {
            st.ticks++;
            if (progress >= cfg.kickLateCap) {
                this.transition(st, STATE_KICK);
                return this.applyDefense(this.doKick(obs, lateralNorm), obs, st, staminaFrac);
            }
            if (st.ticks >= cfg.passMinTicks && !this.stillBlocked(obs)) {
                this.transition(st, STATE_SETTLING);
                st.settleFromLane = lateralNorm;
            } else {
                return this.applyDefense(this.doPass(staminaFrac), obs, st, staminaFrac);
            }
        }

        // SETTLING: interpolate lane position back toward archetype target
        if (st.state === STATE_SETTLING) {
            st.ticks++;
            if (progress >= cfg.kickLateCap) {
                this.transition(st, STATE_KICK);
                return this.applyDefense(this.doKick(obs, lateralNorm), obs, st, staminaFrac);
            }
            if (st.ticks >= cfg.settleTicks) {
                this.transition(st, STATE_CRUISE);
                st.cooldown = cfg.passCooldownTicks;
            } else {
                return this.applyDefense(
                    this.doSettle(st, speedRatio, staminaFrac, lateralNorm),
                    obs, st, staminaFrac,
                );
            }
        }

        // CRUISE: utility-based action selection
        if (st.cooldown > 0) st.cooldown--;

        const canTransition =
            st.globalTick - st.lastTransitionTick >= cfg.transitionMinTicks;

        const kickU = this.scoreKick(progress, staminaFrac);
        const passU = st.cooldown <= 0 && canTransition
            ? this.scorePass(obs) : -10;
        const cruiseU = this.scoreCruise(obs, staminaFrac);

        if (kickU >= cruiseU && kickU >= passU && kickU > 0) {
            this.transition(st, STATE_KICK);
            return this.applyDefense(this.doKick(obs, lateralNorm), obs, st, staminaFrac);
        }

        if (passU > cruiseU && passU > 0 && canTransition) {
            this.transition(st, STATE_PASSING);
            return this.applyDefense(this.doPass(staminaFrac), obs, st, staminaFrac);
        }

        st.ticks++;
        return this.applyDefense(
            this.doCruise(speedRatio, staminaFrac, lateralNorm),
            obs, st, staminaFrac,
        );
    }

    private computeActions(
        race: Race,
        horseIds?: number[],
    ): Map<number, InputState> {
        if (this.disposed) return new Map();

        const horses = race.state.horses;
        const playerId = race.state.playerHorseId;

        const targets: number[] = [];
        if (horseIds) {
            for (const id of horseIds) {
                const h = horses[id];
                if (h && !h.finished) targets.push(id);
            }
        } else {
            for (const h of horses) {
                if (h.id !== playerId && !h.finished) {
                    targets.push(h.id);
                }
            }
        }

        if (targets.length === 0) return new Map();

        const allObs = buildObservations(race);
        const actions = new Map<number, InputState>();
        for (const id of targets) {
            actions.set(id, this.decide(allObs[id], id));
        }
        return actions;
    }

    dispose(): void {
        this.disposed = true;
    }
}
