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
    conserveThreshold: number;
}

const DEFAULT_CONFIG: BTConfig = {
    // obs[1] is tvel/max_speed (20). cruise_speed=13, so cruise = 0.65 ratio.
    // Band: 65-80% of cruise speed → 8.45-10.4 m/s → 0.42-0.52 ratio.
    cruiseLow: 0.42,
    cruiseHigh: 0.52,
    kickPhase: 0.75,
    blockProgressMax: 0.03,
    blockLateralTol: 0.15,
    conserveThreshold: 0.30,
};

/**
 * Check if opponent slot contains a slower horse directly ahead in same lane.
 */
function isBlocked(obs: Float64Array, cfg: BTConfig): boolean {
    for (let s = 0; s < OPPONENT_SLOTS; s++) {
        const base = OPP_BASE + s * OPPONENT_SLOT_SIZE;
        const active = obs[base + 0];
        if (active < 0.5) continue;
        const progressDelta = obs[base + 1];
        const tvelDelta = obs[base + 2];
        const normalOffset = obs[base + 3];
        if (!(progressDelta > 0 && progressDelta < cfg.blockProgressMax)) continue;
        if (Math.abs(normalOffset) > cfg.blockLateralTol) continue;
        if (tvelDelta >= 0) continue;
        return true;
    }
    return false;
}

function decide(obs: Float64Array, cfg: BTConfig): InputState {
    const progress = obs[0];
    const speedRatio = obs[1]; // tvel / max_speed
    const staminaFrac = obs[3];
    const lateralNorm = obs[15];

    // Phase 1: Final kick
    if (progress >= cfg.kickPhase) {
        const tang = 1.0;
        let normal: number;
        if (isBlocked(obs, cfg)) {
            normal = 0.5; // swing wide to pass
        } else if (lateralNorm > -0.75) {
            normal = -0.75; // pull inside
        } else {
            normal = -0.25;
        }
        return { tangential: tang, normal };
    }

    // Phase 2: Unbox
    if (isBlocked(obs, cfg)) {
        const tang = staminaFrac > cfg.conserveThreshold ? 0.75 : 0.5;
        return { tangential: tang, normal: 0.5 };
    }

    // Phase 3: Cruise + hold inside
    let tang: number;
    if (speedRatio < cfg.cruiseLow) {
        tang = 0.75;
    } else if (speedRatio > cfg.cruiseHigh) {
        tang = 0.0;
    } else {
        tang = 0.25;
    }
    if (staminaFrac < cfg.conserveThreshold) {
        tang = Math.min(tang, 0.25);
    }

    let normal: number;
    if (lateralNorm > -0.75) {
        normal = -0.75;
    } else {
        normal = -0.25;
    }

    return { tangential: tang, normal };
}

/**
 * Behavior-tree jockey — reactive, tactical opponent using the agent's obs.
 *
 * Decisions:
 * 1. Final kick (past 75% progress): full push, pull inside unless blocked.
 * 2. Unbox: if slower horse directly ahead in same lane, swing wide.
 * 3. Cruise: hold speed in band, pull to inside rail.
 */
export class BTJockey implements Jockey {
    private config: BTConfig;
    private disposed = false;

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
            actions.set(id, decide(allObs[id], this.config));
        }
        return actions;
    }

    dispose(): void {
        this.disposed = true;
    }
}
