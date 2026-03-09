import { GenericEntityManager } from '../../utils';
import { SerializedTrackJoint, TrackJointWithElevation } from './types';

export class TrackJointManager {
    private _internalTrackJointManager: GenericEntityManager<TrackJointWithElevation>;

    constructor(initialCount = 10) {
        this._internalTrackJointManager =
            new GenericEntityManager<TrackJointWithElevation>(initialCount);
    }

    createJoint(joint: TrackJointWithElevation): number {
        return this._internalTrackJointManager.createEntity(joint);
    }

    createJointWithId(jointNumber: number, joint: TrackJointWithElevation): void {
        this._internalTrackJointManager.createEntityWithId(jointNumber, joint);
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

    /**
     * Serializes all living joints into a JSON-safe format.
     * Maps and Sets are converted to arrays for JSON compatibility.
     */
    serialize(): SerializedTrackJoint[] {
        return this._internalTrackJointManager
            .getLivingEntitiesWithIndex()
            .map(({ index, entity }) => ({
                jointNumber: index,
                position: { x: entity.position.x, y: entity.position.y },
                connections: Array.from(entity.connections.entries()),
                tangent: { x: entity.tangent.x, y: entity.tangent.y },
                direction: {
                    tangent: Array.from(entity.direction.tangent),
                    reverseTangent: Array.from(entity.direction.reverseTangent),
                },
                elevation: entity.elevation,
            }));
    }

    /**
     * Reconstructs a TrackJointManager from serialized data,
     * preserving all original joint numbers.
     */
    static deserialize(data: SerializedTrackJoint[]): TrackJointManager {
        const maxId = data.reduce((max, j) => Math.max(max, j.jointNumber), -1);
        const manager = new TrackJointManager(Math.max(maxId + 1, 10));
        for (const joint of data) {
            manager.createJointWithId(joint.jointNumber, {
                position: joint.position,
                connections: new Map(joint.connections),
                tangent: joint.tangent,
                direction: {
                    tangent: new Set(joint.direction.tangent),
                    reverseTangent: new Set(joint.direction.reverseTangent),
                },
                elevation: joint.elevation,
            });
        }
        return manager;
    }
}
