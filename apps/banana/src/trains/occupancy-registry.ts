import type { PlacedTrainEntry } from './train-manager';

const EMPTY_SET: ReadonlySet<number> = new Set();

/**
 * Centralized registry mapping track segments and joints to the trains
 * that currently occupy them. Rebuilt each frame from per-train occupancy data.
 *
 * Also provides a broad-phase spatial index: {@link getColocatedPairs} returns
 * all train pairs that share at least one segment or joint, so the
 * {@link ProximityDetector} only needs to check those pairs.
 *
 * @group Train System
 */
export class OccupancyRegistry {
    /** segment number → set of train entity IDs */
    private _segmentOccupants: Map<number, Set<number>> = new Map();
    /** joint number → set of train entity IDs */
    private _jointOccupants: Map<number, Set<number>> = new Map();
    /** Deduplicated colocated pairs as "smallerId:largerId" */
    private _colocatedPairs: Set<string> = new Set();

    /**
     * Rebuild all occupancy data from the current set of placed trains.
     * Called once per frame after all trains have been updated.
     */
    updateFromTrains(trains: readonly PlacedTrainEntry[]): void {
        // Clear previous frame data
        for (const set of this._segmentOccupants.values()) set.clear();
        for (const set of this._jointOccupants.values()) set.clear();
        this._colocatedPairs.clear();

        // Populate segment and joint maps
        for (const { id, train } of trains) {
            // From incrementally tracked occupancy (built during movement)
            for (const seg of train.occupiedTrackSegments) {
                this._addSegment(seg.trackNumber, id);
            }
            for (const joint of train.occupiedJointNumbers) {
                this._addJoint(joint.jointNumber, id);
            }
            // From bogie positions — catches stationary trains that never
            // populated occupiedTrackSegments (e.g. freshly placed trains)
            const bogies = train.getBogiePositions();
            if (bogies) {
                for (const bogie of bogies) {
                    this._addSegment(bogie.trackSegment, id);
                }
            } else if (train.position) {
                // Fallback: at least register the head segment
                this._addSegment(train.position.trackSegment, id);
            }
        }

        // Build colocated pairs from segments and joints
        this._collectColocatedPairs(this._segmentOccupants);
        this._collectColocatedPairs(this._jointOccupants);
    }

    /** Reusable scratch array for iterating small sets without allocation. */
    private _scratchIds: number[] = [];

    private _collectColocatedPairs(map: Map<number, Set<number>>): void {
        for (const occupants of map.values()) {
            if (occupants.size < 2) continue;
            // Copy into scratch array to avoid Array.from() allocation
            this._scratchIds.length = 0;
            for (const id of occupants) this._scratchIds.push(id);
            for (let i = 0; i < this._scratchIds.length; i++) {
                for (let j = i + 1; j < this._scratchIds.length; j++) {
                    const a = Math.min(this._scratchIds[i], this._scratchIds[j]);
                    const b = Math.max(this._scratchIds[i], this._scratchIds[j]);
                    this._colocatedPairs.add(`${a}:${b}`);
                }
            }
        }
    }

    private _addSegment(segmentNumber: number, trainId: number): void {
        let set = this._segmentOccupants.get(segmentNumber);
        if (!set) {
            set = new Set();
            this._segmentOccupants.set(segmentNumber, set);
        }
        set.add(trainId);
    }

    private _addJoint(jointNumber: number, trainId: number): void {
        let set = this._jointOccupants.get(jointNumber);
        if (!set) {
            set = new Set();
            this._jointOccupants.set(jointNumber, set);
        }
        set.add(trainId);
    }

    /** Which trains occupy a given segment? */
    getTrainsOnSegment(segmentNumber: number): ReadonlySet<number> {
        return this._segmentOccupants.get(segmentNumber) ?? EMPTY_SET;
    }

    /** Which trains occupy a given joint? */
    getTrainsAtJoint(jointNumber: number): ReadonlySet<number> {
        return this._jointOccupants.get(jointNumber) ?? EMPTY_SET;
    }

    /** Do two specific trains share any segment or joint? */
    sharesTrack(trainIdA: number, trainIdB: number): boolean {
        const a = Math.min(trainIdA, trainIdB);
        const b = Math.max(trainIdA, trainIdB);
        return this._colocatedPairs.has(`${a}:${b}`);
    }

    /**
     * All train pairs that share at least one segment or joint.
     * Keys are `"smallerId:largerId"` strings.
     */
    getColocatedPairs(): ReadonlySet<string> {
        return this._colocatedPairs;
    }
}
