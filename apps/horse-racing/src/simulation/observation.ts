import { type CoreAttributes, TRAIT_RANGES } from './attributes';
import type { Race } from './race';
import type { TrackFrame } from './track-navigator';
import { type Horse, MAX_HORSES, TRACK_HALF_WIDTH } from './types';

// --- Constants ---

export const SELF_STATE_SIZE = 14;
export const TRACK_CONTEXT_SIZE = 10;
export const OPPONENT_SLOT_SIZE = 5;
export const OPPONENT_SLOTS = MAX_HORSES - 1; // 23
export const OBS_SIZE =
    SELF_STATE_SIZE + TRACK_CONTEXT_SIZE + OPPONENT_SLOTS * OPPONENT_SLOT_SIZE; // 139

// Lookahead distances in meters
const LOOKAHEAD_DISTANCES = [25, 50, 100, 200];

// --- Helpers ---

/**
 * Normalize a trait value to [0, 1] using TRAIT_RANGES.
 */
export function normalizeTrait(
    value: number,
    key: keyof CoreAttributes
): number {
    const [min, max] = TRAIT_RANGES[key];
    if (max - min < 1e-12) return 0;
    return (value - min) / (max - min);
}

/**
 * Convert a turn radius to curvature.
 * Returns 0 for straights (radius >= 1e6).
 */
export function curvature(turnRadius: number): number {
    return turnRadius < 1e6 ? 1 / turnRadius : 0;
}

/**
 * Compute relative lateral offset of opponent projected onto self's track
 * normal, normalized by TRACK_HALF_WIDTH.
 */
export function normalOffset(
    opponent: Horse,
    self: Horse,
    selfFrame: TrackFrame
): number {
    const dx = opponent.pos.x - self.pos.x;
    const dy = opponent.pos.y - self.pos.y;
    const projection = dx * selfFrame.normal.x + dy * selfFrame.normal.y;
    return projection / TRACK_HALF_WIDTH;
}

// --- Main function ---

/**
 * Build a 139-float observation vector per horse from the current Race state.
 *
 * @returns One Float64Array per horse, each of length OBS_SIZE (139).
 */
export function buildObservations(race: Race): Float64Array[] {
    const horses = race.state.horses;
    const result: Float64Array[] = [];

    for (const self of horses) {
        const obs = new Float64Array(OBS_SIZE);
        const base = self.baseAttributes;
        const eff = self.effectiveAttributes;
        const frame = self.navigator.getTrackFrame(self.pos);

        // --- Self State (indices 0-13) ---
        obs[0] = self.trackProgress;
        obs[1] = self.tangentialVel / base.maxSpeed;
        obs[2] = self.normalVel / base.maxSpeed;
        obs[3] = self.currentStamina / base.maxStamina;
        obs[4] = eff.cruiseSpeed / base.cruiseSpeed;
        obs[5] = eff.maxSpeed / base.maxSpeed;
        obs[6] = eff.forwardAccel / base.forwardAccel;
        obs[7] = eff.turnAccel / base.turnAccel;
        obs[8] = normalizeTrait(base.cruiseSpeed, 'cruiseSpeed');
        obs[9] = normalizeTrait(base.maxSpeed, 'maxSpeed');
        obs[10] = normalizeTrait(base.forwardAccel, 'forwardAccel');
        obs[11] = normalizeTrait(base.turnAccel, 'turnAccel');
        obs[12] = normalizeTrait(base.corneringGrip, 'corneringGrip');
        obs[13] = normalizeTrait(base.weight, 'weight');

        // --- Track Context (indices 14-23) ---
        obs[14] = curvature(frame.turnRadius);
        obs[15] = frame.slope;

        for (let i = 0; i < LOOKAHEAD_DISTANCES.length; i++) {
            const lookahead = self.navigator.sampleTrackAhead(
                self.pos,
                LOOKAHEAD_DISTANCES[i]
            );
            obs[16 + i * 2] = curvature(lookahead.turnRadius);
            obs[16 + i * 2 + 1] = lookahead.slope;
        }

        // --- Opponents (indices 24-138) ---
        // Collect opponents sorted by absolute track progress distance
        const opponents = horses
            .filter(h => h.id !== self.id)
            .sort(
                (a, b) =>
                    Math.abs(a.trackProgress - self.trackProgress) -
                    Math.abs(b.trackProgress - self.trackProgress)
            );

        const opponentBase = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        for (let s = 0; s < OPPONENT_SLOTS; s++) {
            const offset = opponentBase + s * OPPONENT_SLOT_SIZE;
            if (s < opponents.length) {
                const opp = opponents[s];
                obs[offset + 0] = 1.0; // active
                obs[offset + 1] = opp.trackProgress - self.trackProgress;
                obs[offset + 2] =
                    (opp.tangentialVel - self.tangentialVel) / base.maxSpeed;
                obs[offset + 3] = normalOffset(opp, self, frame);
                obs[offset + 4] =
                    (opp.normalVel - self.normalVel) / base.maxSpeed;
            }
            // else: already zero-initialized by Float64Array constructor
        }

        result.push(obs);
    }

    return result;
}
