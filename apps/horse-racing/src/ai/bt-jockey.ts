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

interface BTConfig {
    cruiseLow: number;
    cruiseHigh: number;
    kickPhase: number;
    blockProgressMax: number;
    blockLateralTol: number;
    blockMinSlowness: number;
    conserveThreshold: number;
    passMinTicks: number;
    passClearLateral: number;
    passCooldownTicks: number;
}

const DEFAULT_CONFIG: BTConfig = {
    // obs speed_ratio = tvel/max_speed. Natural cruise ~13 m/s → ratio ~0.65.
    cruiseLow: 0.55,        // ~11 m/s
    cruiseHigh: 0.70,       // ~14 m/s
    kickPhase: 0.75,
    blockProgressMax: 0.03,
    blockLateralTol: 0.15,
    blockMinSlowness: 0.03, // blocker must be meaningfully slower
    conserveThreshold: 0.30,
    passMinTicks: 40,
    passClearLateral: 0.25,
    passCooldownTicks: 80,  // no repeat passing for this many ticks after a pass
};

const STATE_CRUISE = 0;
const STATE_PASSING = 1;
const STATE_KICK = 2;

function isBlocked(obs: Float64Array, cfg: BTConfig): boolean {
    for (let s = 0; s < OPPONENT_SLOTS; s++) {
        const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
        if (obs[base + 0] < 0.5) continue;
        const progressDelta = obs[base + 1];
        const tvelDelta = obs[base + 2];
        const normalOffset = obs[base + 3];
        if (!(progressDelta > 0 && progressDelta < cfg.blockProgressMax)) continue;
        if (Math.abs(normalOffset) > cfg.blockLateralTol) continue;
        if (tvelDelta >= -cfg.blockMinSlowness) continue;
        return true;
    }
    return false;
}

function stillBlocked(obs: Float64Array, cfg: BTConfig): boolean {
    for (let s = 0; s < OPPONENT_SLOTS; s++) {
        const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
        if (obs[base + 0] < 0.5) continue;
        const progressDelta = obs[base + 1];
        const normalOffset = obs[base + 3];
        if (progressDelta > -0.01 && progressDelta < cfg.blockProgressMax) {
            if (normalOffset < -cfg.passClearLateral) {
                return true;
            }
        }
    }
    return false;
}

interface HorseState {
    state: number;
    ticks: number;
    cooldown: number;
}

/**
 * Behavior-tree jockey with committed maneuvers (CRUISE / PASSING / KICK).
 *
 * Holds per-horse state so passing commits for pass_min_ticks instead of
 * flipping back and forth every frame. Uses only the agent's observation
 * vector — no privileged access to race state.
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
            s = { state: STATE_CRUISE, ticks: 0, cooldown: 0 };
            this.states.set(id, s);
        }
        return s;
    }

    private decide(obs: Float64Array, horseId: number): InputState {
        const cfg = this.config;
        const progress = obs[0];
        const speedRatio = obs[1];
        const staminaFrac = obs[3];
        const lateralNorm = obs[15];
        const st = this.getState(horseId);

        // Transition to KICK (absorbing)
        if (progress >= cfg.kickPhase) {
            if (st.state !== STATE_KICK) {
                st.state = STATE_KICK;
                st.ticks = 0;
            }
        }

        if (st.state === STATE_KICK) {
            st.ticks++;
            return this.doKick(obs, lateralNorm);
        }

        if (st.state === STATE_PASSING) {
            st.ticks++;
            if (st.ticks >= cfg.passMinTicks && !stillBlocked(obs, cfg)) {
                st.state = STATE_CRUISE;
                st.ticks = 0;
                st.cooldown = cfg.passCooldownTicks;
            } else {
                return this.doPass(staminaFrac);
            }
        }

        // CRUISE state
        if (st.state === STATE_CRUISE) {
            if (st.cooldown > 0) {
                st.cooldown--;
            } else if (isBlocked(obs, cfg)) {
                st.state = STATE_PASSING;
                st.ticks = 0;
                return this.doPass(staminaFrac);
            }
            st.ticks++;
            return this.doCruise(speedRatio, staminaFrac, lateralNorm);
        }

        return { tangential: 0.25, normal: -0.25 };
    }

    private doCruise(
        speedRatio: number,
        staminaFrac: number,
        lateralNorm: number
    ): InputState {
        const cfg = this.config;
        let tang: number;
        // Default cruise is 0.25; wider tolerance (±0.05) to avoid overshoot flips.
        if (speedRatio < cfg.cruiseLow - 0.05) tang = 0.5;
        else if (speedRatio > cfg.cruiseHigh + 0.05) tang = 0.0;
        else tang = 0.25;
        if (staminaFrac < cfg.conserveThreshold) tang = Math.min(tang, 0.25);

        const normal = lateralNorm > -0.80 ? -0.5 : -0.25;
        return { tangential: tang, normal };
    }

    private doPass(staminaFrac: number): InputState {
        const cfg = this.config;
        const tang = staminaFrac > cfg.conserveThreshold ? 0.75 : 0.5;
        return { tangential: tang, normal: 0.5 };
    }

    private doKick(obs: Float64Array, lateralNorm: number): InputState {
        if (isBlocked(obs, this.config)) {
            return { tangential: 1.0, normal: 0.5 };
        }
        const normal = lateralNorm > -0.80 ? -0.5 : -0.25;
        return { tangential: 1.0, normal };
    }

    private computeActions(
        race: Race,
        horseIds?: number[]
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
