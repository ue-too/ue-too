import type { TrainPosition } from './formation';
import type { OccupancyRegistry } from './occupancy-registry';
import type { PlacedTrainEntry } from './train-manager';

/**
 * Base gap tolerance (world units) added on top of the two coupler lengths.
 * Accounts for placement imprecision and the physical gap between couplers.
 */
const COUPLING_GAP_TOLERANCE = 2;

/**
 * Describes a proximity match between two train endpoints that are
 * close enough for a potential coupling operation.
 *
 * @group Train System
 */
export type ProximityMatch = {
    trainA: { id: number; end: 'head' | 'tail' };
    trainB: { id: number; end: 'head' | 'tail' };
    distance: number;
};

/**
 * Detects when two placed trains have endpoints close enough for coupling.
 *
 * Uses {@link OccupancyRegistry} as a broad-phase filter so that only
 * trains sharing at least one track segment or joint are checked,
 * avoiding O(n²) comparisons.
 *
 * @group Train System
 */
export class ProximityDetector {
    private _matches: ProximityMatch[] = [];
    private _lastFingerprint = '';
    private _listeners: (() => void)[] = [];
    /** Reusable map to avoid per-frame allocation in update(). */
    private _trainMap: Map<number, PlacedTrainEntry> = new Map();

    /**
     * Subscribe to proximity match changes. The listener is called only when
     * the set of couplable pairs actually changes between frames.
     * Returns an unsubscribe function.
     */
    subscribe(listener: () => void): () => void {
        this._listeners.push(listener);
        return () => {
            const i = this._listeners.indexOf(listener);
            if (i >= 0) this._listeners.splice(i, 1);
        };
    }

    private _notifyListeners(): void {
        for (const fn of this._listeners) fn();
    }

    /**
     * Build a fingerprint string from the current matches so we can detect
     * when the couplable set actually changes between frames.
     */
    private _fingerprintParts: string[] = [];

    private _computeFingerprint(): string {
        if (this._matches.length === 0) return '';
        // Reuse array to avoid per-frame allocation
        this._fingerprintParts.length = this._matches.length;
        for (let i = 0; i < this._matches.length; i++) {
            const m = this._matches[i];
            this._fingerprintParts[i] = `${m.trainA.id}:${m.trainA.end}-${m.trainB.id}:${m.trainB.end}`;
        }
        this._fingerprintParts.sort();
        return this._fingerprintParts.join('|');
    }

    /**
     * Re-evaluate proximity for all colocated train pairs.
     * Called once per frame after trains have been updated and the
     * occupancy registry has been rebuilt.
     */
    update(
        trains: readonly PlacedTrainEntry[],
        registry: OccupancyRegistry,
    ): void {
        this._matches.length = 0;

        const colocatedPairs = registry.getColocatedPairs();
        if (colocatedPairs.size === 0) {
            if (this._lastFingerprint !== '') {
                this._lastFingerprint = '';
                this._notifyListeners();
            }
            return;
        }

        // Build id → entry lookup (reuse map to avoid allocation)
        this._trainMap.clear();
        for (const e of trains) this._trainMap.set(e.id, e);

        for (const pairKey of colocatedPairs) {
            const colonIdx = pairKey.indexOf(':');
            const idA = parseInt(pairKey.slice(0, colonIdx), 10);
            const idB = parseInt(pairKey.slice(colonIdx + 1), 10);

            const entryA = this._trainMap.get(idA);
            const entryB = this._trainMap.get(idB);
            if (!entryA || !entryB) continue;

            const trainA = entryA.train;
            const trainB = entryB.train;

            // Skip moving trains
            if (trainA.speed > 0 || trainB.speed > 0) continue;

            const posA = trainA.position;
            const posB = trainB.position;
            if (!posA || !posB) continue;

            const bogiesA = trainA.getBogiePositions();
            const bogiesB = trainB.getBogiePositions();
            if (!bogiesA || bogiesA.length === 0 || !bogiesB || bogiesB.length === 0) continue;

            const headA = posA.point;
            const tailA = bogiesA[bogiesA.length - 1].point;
            const headB = posB.point;
            const tailB = bogiesB[bogiesB.length - 1].point;

            const formA = trainA.formation;
            const formB = trainB.formation;
            const headCouplerA = formA.headCouplerLength;
            const tailCouplerA = formA.tailCouplerLength;
            const headCouplerB = formB.headCouplerLength;
            const tailCouplerB = formB.tailCouplerLength;

            // Check all 4 endpoint combinations with per-pair dynamic thresholds
            this._checkEndpoints(idA, 'tail', tailA, idB, 'head', headB, tailCouplerA + headCouplerB + COUPLING_GAP_TOLERANCE);
            this._checkEndpoints(idA, 'head', headA, idB, 'tail', tailB, headCouplerA + tailCouplerB + COUPLING_GAP_TOLERANCE);
            this._checkEndpoints(idA, 'tail', tailA, idB, 'tail', tailB, tailCouplerA + tailCouplerB + COUPLING_GAP_TOLERANCE);
            this._checkEndpoints(idA, 'head', headA, idB, 'head', headB, headCouplerA + headCouplerB + COUPLING_GAP_TOLERANCE);
        }

        const fingerprint = this._computeFingerprint();
        if (fingerprint !== this._lastFingerprint) {
            this._lastFingerprint = fingerprint;
            this._notifyListeners();
        }
    }

    /** Current coupling-ready pairs (within threshold). */
    getMatches(): readonly ProximityMatch[] {
        return this._matches;
    }

    /** Return only matches involving a specific train. */
    getMatchesForTrain(trainId: number): readonly ProximityMatch[] {
        return this._matches.filter(
            m => m.trainA.id === trainId || m.trainB.id === trainId,
        );
    }

    private _checkEndpoints(
        idA: number, endA: 'head' | 'tail', ptA: { x: number; y: number },
        idB: number, endB: 'head' | 'tail', ptB: { x: number; y: number },
        threshold: number,
    ): void {
        const dx = ptA.x - ptB.x;
        const dy = ptA.y - ptB.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= threshold * threshold) {
            this._matches.push({
                trainA: { id: idA, end: endA },
                trainB: { id: idB, end: endB },
                distance: Math.sqrt(distSq),
            });
        }
    }
}
