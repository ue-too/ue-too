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

// Avoid unused-import errors — CollisionGuard uses these (added in Task 3)
export type { OccupancyRegistry, PlacedTrainEntry, TrackGraph, TrainPosition };
