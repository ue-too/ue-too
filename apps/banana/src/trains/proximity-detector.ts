import type { TrainPosition } from './formation';
import type { OccupancyRegistry } from './occupancy-registry';
import type { PlacedTrainEntry } from './train-manager';

/**
 * Distance threshold (world units) for coupling proximity.
 * Must cover bogieToEdge + physical gap + edgeToBogie between two trains.
 * Default cars have 2.5 + 2.5 = 5m of bogie-to-edge clearance alone.
 */
const COUPLING_THRESHOLD = 8;
const COUPLING_THRESHOLD_SQ = COUPLING_THRESHOLD * COUPLING_THRESHOLD;

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
        if (colocatedPairs.size === 0) return;

        // Build id → entry lookup
        const trainMap = new Map<number, PlacedTrainEntry>();
        for (const e of trains) trainMap.set(e.id, e);

        for (const pairKey of colocatedPairs) {
            const colonIdx = pairKey.indexOf(':');
            const idA = parseInt(pairKey.slice(0, colonIdx), 10);
            const idB = parseInt(pairKey.slice(colonIdx + 1), 10);

            const entryA = trainMap.get(idA);
            const entryB = trainMap.get(idB);
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

            // Check all 4 endpoint combinations, record closest per pair
            this._checkEndpoints(idA, 'tail', tailA, idB, 'head', headB);
            this._checkEndpoints(idA, 'head', headA, idB, 'tail', tailB);
            this._checkEndpoints(idA, 'tail', tailA, idB, 'tail', tailB);
            this._checkEndpoints(idA, 'head', headA, idB, 'head', headB);
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
    ): void {
        const dx = ptA.x - ptB.x;
        const dy = ptA.y - ptB.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= COUPLING_THRESHOLD_SQ) {
            this._matches.push({
                trainA: { id: idA, end: endA },
                trainB: { id: idB, end: endB },
                distance: Math.sqrt(distSq),
            });
        }
    }
}
