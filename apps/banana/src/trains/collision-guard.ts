import type { OccupancyRegistry } from './occupancy-registry';
import type { PlacedTrainEntry } from './train-manager';
import type { TrackGraph } from './tracks/track';
import type { TrainPosition } from './formation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Arc-length distance threshold (world units) for an immediate emergency stop. */
const CRITICAL_DISTANCE = 5;

/** Safety margin multiplier applied to the kinematic braking distance for Tier 1 throttle reduction. */
const BRAKING_SAFETY_MARGIN = 1.8;

/**
 * Emergency brake deceleration magnitude (world units / s²).
 * Must match the `er` entry in DEFAULT_THROTTLE_STEPS (absolute value).
 */
const EMERGENCY_BRAKE_DECEL = 1.3;

// ---------------------------------------------------------------------------
// CrossingMap
// ---------------------------------------------------------------------------

export type CrossingEntry = {
    crossingSegment: number;
    selfT: number;
    otherT: number;
};

/**
 * Bidirectional registry of track-level crossings.
 * When segment A crosses segment B at (tA, tB), both
 * A→B and B→A entries are maintained so lookups are O(1).
 *
 * @group Train System
 */
export class CrossingMap {
    private _map: Map<number, CrossingEntry[]> = new Map();

    /**
     * Record a crossing between two track segments.
     * Inserts a pair of symmetric entries so both segments know about each other.
     */
    addCrossing(segmentA: number, tA: number, segmentB: number, tB: number): void {
        this._getOrCreate(segmentA).push({ crossingSegment: segmentB, selfT: tA, otherT: tB });
        this._getOrCreate(segmentB).push({ crossingSegment: segmentA, selfT: tB, otherT: tA });
    }

    /**
     * Remove all crossing data for `segmentNumber`, and also remove the
     * back-references in partner segments that pointed to it.
     */
    removeSegment(segmentNumber: number): void {
        const entries = this._map.get(segmentNumber);
        if (entries) {
            for (const entry of entries) {
                const partner = this._map.get(entry.crossingSegment);
                if (partner) {
                    const filtered = partner.filter(e => e.crossingSegment !== segmentNumber);
                    if (filtered.length === 0) {
                        this._map.delete(entry.crossingSegment);
                    } else {
                        this._map.set(entry.crossingSegment, filtered);
                    }
                }
            }
        }
        this._map.delete(segmentNumber);
    }

    /**
     * Return all crossings for a given segment, or an empty array if none exist.
     */
    getCrossings(segmentNumber: number): readonly CrossingEntry[] {
        return this._map.get(segmentNumber) ?? EMPTY_CROSSINGS;
    }

    private _getOrCreate(segmentNumber: number): CrossingEntry[] {
        let arr = this._map.get(segmentNumber);
        if (!arr) {
            arr = [];
            this._map.set(segmentNumber, arr);
        }
        return arr;
    }
}

const EMPTY_CROSSINGS: readonly CrossingEntry[] = [];

// ---------------------------------------------------------------------------
// CollisionGuard
// ---------------------------------------------------------------------------

/**
 * Per-frame collision prevention system.
 *
 * Reads colocated train pairs from {@link OccupancyRegistry} and applies
 * graduated braking interventions:
 *
 * - **Tier 2** (≤ {@link CRITICAL_DISTANCE} world units): `emergencyStop()` on both trains — speed zeroed, train locked.
 * - **Tier 1** (≤ brakingDistance × {@link BRAKING_SAFETY_MARGIN}): `setThrottleStep('er')` on both trains.
 *
 * Trains that are no longer in danger have their collision lock cleared automatically each frame.
 *
 * @group Train System
 */
export class CollisionGuard {
    private _trackGraph: TrackGraph;
    private _crossingMap: CrossingMap;

    /** IDs of trains currently hard-stopped by Tier 2. */
    private _lockedTrains: Set<number> = new Set();

    constructor(trackGraph: TrackGraph, crossingMap: CrossingMap) {
        this._trackGraph = trackGraph;
        this._crossingMap = crossingMap;
    }

    /**
     * Run one frame of collision detection and response.
     * Call after all trains have moved and after `OccupancyRegistry.updateFromTrains()`.
     */
    update(placedTrains: readonly PlacedTrainEntry[], occupancyRegistry: OccupancyRegistry): void {
        // Build a fast ID → entry lookup for this frame.
        const trainMap = new Map<number, PlacedTrainEntry>();
        for (const entry of placedTrains) {
            trainMap.set(entry.id, entry);
        }

        // Track which trains are still in danger this frame so we can clear stale locks.
        const dangerousThisFrame = new Set<number>();

        // --- Same-track detection ---
        const colocatedPairs = occupancyRegistry.getColocatedPairs();
        for (const pairKey of colocatedPairs) {
            const colonIdx = pairKey.indexOf(':');
            const idA = parseInt(pairKey.slice(0, colonIdx), 10);
            const idB = parseInt(pairKey.slice(colonIdx + 1), 10);

            const entryA = trainMap.get(idA);
            const entryB = trainMap.get(idB);
            if (!entryA || !entryB) continue;

            this._checkSameTrack(idA, entryA.train, idB, entryB.train, dangerousThisFrame);
        }

        // --- Crossing detection (Task 4 placeholder) ---
        this._checkCrossings();

        // --- Clear locks for trains no longer in danger ---
        for (const lockedId of this._lockedTrains) {
            if (!dangerousThisFrame.has(lockedId)) {
                const entry = trainMap.get(lockedId);
                if (entry) {
                    entry.train.clearCollisionLock();
                }
                this._lockedTrains.delete(lockedId);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Same-track detection
    // -----------------------------------------------------------------------

    private _checkSameTrack(
        idA: number,
        trainA: PlacedTrainEntry['train'],
        idB: number,
        trainB: PlacedTrainEntry['train'],
        dangerousThisFrame: Set<number>,
    ): void {
        const posA = trainA.position;
        const posB = trainB.position;
        if (!posA || !posB) return;

        // Both must be on the same segment.
        if (posA.trackSegment !== posB.trackSegment) return;

        // Skip if both stopped.
        if (trainA.speed === 0 && trainB.speed === 0) return;

        const seg = this._trackGraph.getTrackSegmentWithJoints(posA.trackSegment);
        if (!seg) return;

        const arcA = seg.curve.lengthAtT(posA.tValue);
        const arcB = seg.curve.lengthAtT(posB.tValue);
        const distance = Math.abs(arcA - arcB);

        // Check if the two trains are approaching each other.
        if (!this._areApproaching(posA, posB, arcA, arcB)) return;

        const closingSpeed = trainA.speed + trainB.speed;

        if (distance <= CRITICAL_DISTANCE) {
            // Tier 2: hard stop
            trainA.emergencyStop();
            trainB.emergencyStop();
            this._lockedTrains.add(idA);
            this._lockedTrains.add(idB);
            dangerousThisFrame.add(idA);
            dangerousThisFrame.add(idB);
        } else {
            const brakingDistance = (closingSpeed * closingSpeed) / (2 * EMERGENCY_BRAKE_DECEL);
            if (distance <= brakingDistance * BRAKING_SAFETY_MARGIN) {
                // Tier 1: reduce throttle to emergency brake without locking
                trainA.setThrottleStep('er');
                trainB.setThrottleStep('er');
                dangerousThisFrame.add(idA);
                dangerousThisFrame.add(idB);
            }
        }
    }

    /**
     * Determine if two trains on the same segment are moving toward each other.
     *
     * Convention:
     * - `'tangent'` → moving in the direction of increasing t-value (higher arc-length).
     * - `'reverseTangent'` → moving in the direction of decreasing t-value (lower arc-length).
     *
     * Two trains approach when:
     * - the train with **lower** arc-length is moving **toward** higher t (tangent), AND
     * - the train with **higher** arc-length is moving **toward** lower t (reverseTangent).
     */
    private _areApproaching(
        posA: TrainPosition,
        posB: TrainPosition,
        arcA: number,
        arcB: number,
    ): boolean {
        let lowerDir: 'tangent' | 'reverseTangent';
        let higherDir: 'tangent' | 'reverseTangent';

        if (arcA <= arcB) {
            lowerDir = posA.direction;
            higherDir = posB.direction;
        } else {
            lowerDir = posB.direction;
            higherDir = posA.direction;
        }

        // Approaching: lower is moving up (tangent) AND higher is moving down (reverseTangent).
        return lowerDir === 'tangent' && higherDir === 'reverseTangent';
    }

    // -----------------------------------------------------------------------
    // Crossing detection (placeholder — implemented in Task 4)
    // -----------------------------------------------------------------------

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private _checkCrossings(): void {
        // Implemented in Task 4
    }
}
