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

/** Time window (seconds) within which two trains approaching a crossing are considered a conflict. */
const CROSSING_TIME_WINDOW = 3;

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

        // --- Crossing detection ---
        this._checkCrossings(placedTrains, occupancyRegistry, trainMap, dangerousThisFrame);

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
    // Crossing detection
    // -----------------------------------------------------------------------

    private _checkCrossings(
        placedTrains: readonly PlacedTrainEntry[],
        occupancyRegistry: OccupancyRegistry,
        trainMap: Map<number, PlacedTrainEntry>,
        dangerousThisFrame: Set<number>,
    ): void {
        // Build segment → trains lookup (keyed by head position segment).
        const segmentToTrains = new Map<number, { id: number; train: PlacedTrainEntry['train'] }[]>();
        for (const entry of placedTrains) {
            const pos = entry.train.position;
            if (!pos) continue;
            const seg = pos.trackSegment;
            let list = segmentToTrains.get(seg);
            if (!list) {
                list = [];
                segmentToTrains.set(seg, list);
            }
            list.push({ id: entry.id, train: entry.train });
        }

        // Deduplicate pair checks.
        const checkedPairs = new Set<string>();

        for (const [segNum, trainsOnSeg] of segmentToTrains) {
            const crossings = this._crossingMap.getCrossings(segNum);
            if (crossings.length === 0) continue;

            const segData = this._trackGraph.getTrackSegmentWithJoints(segNum);
            if (!segData) continue;

            for (const crossing of crossings) {
                const partnerTrains = segmentToTrains.get(crossing.crossingSegment);
                if (!partnerTrains || partnerTrains.length === 0) continue;

                const partnerSegData = this._trackGraph.getTrackSegmentWithJoints(
                    crossing.crossingSegment,
                );
                if (!partnerSegData) continue;

                for (const trainA of trainsOnSeg) {
                    for (const trainB of partnerTrains) {
                        const smallerId = Math.min(trainA.id, trainB.id);
                        const largerId = Math.max(trainA.id, trainB.id);
                        const pairKey = `${smallerId}:${largerId}`;
                        if (checkedPairs.has(pairKey)) continue;
                        checkedPairs.add(pairKey);

                        const posA = trainA.train.position;
                        const posB = trainB.train.position;
                        if (!posA || !posB) continue;

                        const distA = this._distanceToCrossingOrOccupying(
                            trainA.train, posA, crossing.selfT, segData,
                        );
                        const distB = this._distanceToCrossingOrOccupying(
                            trainB.train, posB, crossing.otherT, partnerSegData,
                        );

                        // If either train is past the crossing AND not occupying it, skip.
                        if (distA === null || distB === null) continue;

                        // Tier 2: both within critical distance → emergencyStop.
                        if (distA <= CRITICAL_DISTANCE && distB <= CRITICAL_DISTANCE) {
                            trainA.train.emergencyStop();
                            trainB.train.emergencyStop();
                            this._lockedTrains.add(trainA.id);
                            this._lockedTrains.add(trainB.id);
                            dangerousThisFrame.add(trainA.id);
                            dangerousThisFrame.add(trainB.id);
                            continue;
                        }

                        // Tier 1a: one train is stopped at/near the crossing — the
                        // other must brake regardless of time-to-arrival.
                        const speedA = trainA.train.speed;
                        const speedB = trainB.train.speed;
                        const aAtCrossing = distA <= CRITICAL_DISTANCE && speedA === 0;
                        const bAtCrossing = distB <= CRITICAL_DISTANCE && speedB === 0;

                        if (aAtCrossing && speedB > 0) {
                            trainB.train.setThrottleStep('er');
                            dangerousThisFrame.add(trainA.id);
                            dangerousThisFrame.add(trainB.id);
                            continue;
                        }
                        if (bAtCrossing && speedA > 0) {
                            trainA.train.setThrottleStep('er');
                            dangerousThisFrame.add(trainA.id);
                            dangerousThisFrame.add(trainB.id);
                            continue;
                        }

                        // Tier 1b: both moving — check time-to-arrival window.
                        if (speedA === 0 || speedB === 0) continue;

                        const timeA = distA / speedA;
                        const timeB = distB / speedB;

                        if (isFinite(timeA) && isFinite(timeB) && Math.abs(timeA - timeB) < CROSSING_TIME_WINDOW) {
                            trainA.train.setThrottleStep('er');
                            trainB.train.setThrottleStep('er');
                            dangerousThisFrame.add(trainA.id);
                            dangerousThisFrame.add(trainB.id);
                        }
                    }
                }
            }
        }
    }

    /**
     * Compute the arc-length distance from a train to a crossing t-value.
     *
     * Returns:
     * - Positive number if the train's head is approaching the crossing
     * - `0` if the train's body is currently occupying the crossing
     *   (head has passed but bogies still span the crossing point)
     * - `null` if the train is entirely past the crossing
     */
    private _distanceToCrossingOrOccupying(
        train: PlacedTrainEntry['train'],
        pos: TrainPosition,
        crossingT: number,
        segData: { curve: { lengthAtT(t: number): number } },
    ): number | null {
        const posLen = segData.curve.lengthAtT(pos.tValue);
        const crossingLen = segData.curve.lengthAtT(crossingT);
        const diff = crossingLen - posLen;

        // Head is approaching the crossing
        if (pos.direction === 'tangent' && diff >= 0) return diff;
        if (pos.direction === 'reverseTangent' && diff <= 0) return -diff;

        // Head has passed — check if the body still covers the crossing.
        // The train's body extends behind the head. If any bogie on this
        // segment is on the other side of the crossing, the train spans it.
        const bogies = train.getBogiePositions();
        if (bogies) {
            for (const bogie of bogies) {
                if (bogie.trackSegment !== pos.trackSegment) continue;
                const bogieLen = segData.curve.lengthAtT(bogie.tValue);
                const bogieDiff = crossingLen - bogieLen;
                // Head and bogie are on opposite sides of the crossing → occupying
                if ((diff < 0 && bogieDiff >= 0) || (diff > 0 && bogieDiff <= 0)) {
                    return 0; // occupying the crossing
                }
            }
        }

        return null; // entirely past
    }
}
