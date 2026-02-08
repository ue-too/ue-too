import { GenericEntityManager } from '../../utils';
import { TrackJointWithElevation } from './types';

export class TrackJointManager {
    private _internalTrackJointManager: GenericEntityManager<TrackJointWithElevation>;

    constructor(initialCount = 10) {
        this._internalTrackJointManager =
            new GenericEntityManager<TrackJointWithElevation>(initialCount);
    }

    createJoint(joint: TrackJointWithElevation): number {
        return this._internalTrackJointManager.createEntity(joint);
    }

    getJoints(): { jointNumber: number; joint: TrackJointWithElevation }[] {
        return this._internalTrackJointManager
            .getLivingEntitiesWithIndex()
            .map(({ index, entity }) => ({
                jointNumber: index,
                joint: entity,
            }));
    }

    getJoint(jointNumber: number): TrackJointWithElevation | null {
        return this._internalTrackJointManager.getEntity(jointNumber);
    }

    destroyJoint(jointNumber: number): void {
        this._internalTrackJointManager.destroyEntity(jointNumber);
    }
}