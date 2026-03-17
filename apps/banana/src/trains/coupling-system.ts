import type { TrainManager, PlacedTrainEntry } from './train-manager';
import type { Train, TrainPosition } from './formation';

/**
 * Detects contact between moving trains and triggers automatic coupling.
 * A moving train's head tip is checked against other trains' head and tail tips.
 */
export class CouplingSystem {
    private _trainManager: TrainManager;
    private _tolerance: number;

    constructor(trainManager: TrainManager, tolerance: number = 0.5) {
        this._trainManager = trainManager;
        this._tolerance = tolerance;
    }

    /** Check all moving trains for coupling contacts. Returns true if any coupling occurred. */
    update(): boolean {
        let anyCoupled = false;
        const absorbedIds = new Set<number>();

        const placed = this._trainManager.getPlacedTrains();
        // Pre-compute tip positions for all trains
        const tips = new Map<number, { head: TrainPosition | null; tail: TrainPosition | null; train: Train }>();
        for (const entry of placed) {
            tips.set(entry.id, {
                head: entry.train.getHeadTipPosition(),
                tail: entry.train.getTailTipPosition(),
                train: entry.train,
            });
        }

        for (const mover of placed) {
            if (absorbedIds.has(mover.id)) continue;
            const moverTips = tips.get(mover.id)!;
            // Only moving trains initiate coupling
            if (!moverTips.head) continue;

            for (const other of placed) {
                if (other.id === mover.id || absorbedIds.has(other.id)) continue;
                const otherTips = tips.get(other.id)!;

                // Head-to-tail: mover's head meets other's tail → append other to mover
                if (otherTips.tail && this._isNear(moverTips.head, otherTips.tail)) {
                    if (!mover.train.frontCouplerLocked && !other.train.rearCouplerLocked) {
                        // Append other's children to mover's tail
                        const success = this._trainManager.coupleTrains(mover.id, other.id, false);
                        if (success) {
                            absorbedIds.add(other.id);
                            anyCoupled = true;
                            continue;
                        }
                    }
                }

                // Head-to-head: mover's head meets other's head → flip other, prepend to mover
                if (otherTips.head && this._isNear(moverTips.head, otherTips.head)) {
                    if (!mover.train.frontCouplerLocked && !other.train.frontCouplerLocked) {
                        other.train.formation.switchDirection();
                        const success = this._trainManager.coupleTrains(mover.id, other.id, true);
                        if (success) {
                            absorbedIds.add(other.id);
                            anyCoupled = true;
                        }
                    }
                }
            }
        }

        return anyCoupled;
    }

    /**
     * Find trains adjacent to the given train within a coupling radius.
     * Used by the manual couple UI.
     */
    getAdjacentTrains(trainId: number): { id: number; orientation: 'tail-ahead' | 'head-ahead' }[] {
        const placed = this._trainManager.getPlacedTrains();
        const target = placed.find(e => e.id === trainId);
        if (!target) return [];

        const targetHead = target.train.getHeadTipPosition();
        const targetTail = target.train.getTailTipPosition();
        const results: { id: number; orientation: 'tail-ahead' | 'head-ahead' }[] = [];
        const couplingRadius = 2.0;

        for (const other of placed) {
            if (other.id === trainId) continue;
            const otherHead = other.train.getHeadTipPosition();
            const otherTail = other.train.getTailTipPosition();

            // Target's head near other's tail
            if (targetHead && otherTail && this._distance(targetHead, otherTail) <= couplingRadius) {
                results.push({ id: other.id, orientation: 'tail-ahead' });
            }
            // Target's tail near other's head
            if (targetTail && otherHead && this._distance(targetTail, otherHead) <= couplingRadius) {
                results.push({ id: other.id, orientation: 'head-ahead' });
            }
        }

        return results;
    }

    private _isNear(a: TrainPosition, b: TrainPosition): boolean {
        return this._distance(a, b) <= this._tolerance;
    }

    private _distance(a: TrainPosition, b: TrainPosition): number {
        const dx = a.point.x - b.point.x;
        const dy = a.point.y - b.point.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
