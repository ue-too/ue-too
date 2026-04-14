/**
 * A {@link JointDirectionManager} that follows a named route's joint sequence
 * instead of using the default "prefer occupied branch" heuristic.
 *
 * @module timetable/timetable-joint-direction-manager
 */
import {
    DefaultJointDirectionManager,
    type JointDirectionManager,
} from '@/trains/input-state-machine/train-kmt-state-machine';
import type { JointDirectionPreferenceMap } from '@/trains/tracks/joint-direction-preference-map';
import type { TrackGraph } from '@/trains/tracks/track';

import type { RouteJointStep } from './types';

/**
 * Route-aware junction decision maker.
 *
 * @remarks
 * At each junction the manager looks ahead in the route's joint sequence to
 * find the current joint, then picks the next joint from the sequence.  If
 * the junction is not in the route (e.g. the train has gone off-route), it
 * falls back to {@link DefaultJointDirectionManager}.
 *
 * The {@link currentIndex} must be kept in sync with the train's progress
 * along the route — typically updated by the {@link AutoDriver} whenever the
 * train passes a joint.
 *
 * @example
 * ```typescript
 * const mgr = new TimetableJointDirectionManager(trackGraph, route.joints, 0);
 * train.setJointDirectionManager(mgr);
 * // As the train passes joints, advance the index:
 * mgr.setCurrentIndex(3);
 * ```
 */
export class TimetableJointDirectionManager implements JointDirectionManager {
    private _trackGraph: TrackGraph;
    private _routeJoints: RouteJointStep[];
    private _currentIndex: number;
    private _fallback: DefaultJointDirectionManager;

    /**
     * @param trackGraph - The track graph for segment lookup.
     * @param routeJoints - Ordered joint sequence from the active route.
     * @param startIndex - Initial position in the joint sequence.
     * @param preferenceMap - Optional preference map passed to the fallback manager.
     */
    constructor(
        trackGraph: TrackGraph,
        routeJoints: RouteJointStep[],
        startIndex: number,
        preferenceMap?: JointDirectionPreferenceMap
    ) {
        this._trackGraph = trackGraph;
        this._routeJoints = routeJoints;
        this._currentIndex = startIndex;
        this._fallback = new DefaultJointDirectionManager(trackGraph, preferenceMap);
    }

    /** Current position in the route's joint sequence. */
    get currentIndex(): number {
        return this._currentIndex;
    }

    /** Advance (or set) the route progress index. */
    setCurrentIndex(index: number): void {
        this._currentIndex = index;
    }

    /** Get the current route joint sequence. */
    getRouteJoints(): readonly RouteJointStep[] {
        return this._routeJoints;
    }

    /** Replace the route joints (e.g. when moving to the next leg). */
    setRouteJoints(joints: RouteJointStep[], startIndex: number = 0): void {
        this._routeJoints = joints;
        this._currentIndex = startIndex;
    }

    getNextJoint(
        jointNumber: number,
        direction: 'tangent' | 'reverseTangent',
        occupiedJoints?: {
            jointNumber: number;
            direction: 'tangent' | 'reverseTangent';
        }[],
        occupiedTrackSegments?: {
            trackNumber: number;
            inTrackDirection: 'tangent' | 'reverseTangent';
        }[]
    ): {
        jointNumber: number;
        direction: 'tangent' | 'reverseTangent';
        curveNumber: number;
    } | null {
        // Search forward from the current index for the joint we're at.
        for (let i = this._currentIndex; i < this._routeJoints.length; i++) {
            if (this._routeJoints[i].jointNumber !== jointNumber) continue;

            // Found the current joint in the route.  The next step tells us
            // which branch to take.
            if (i + 1 >= this._routeJoints.length) break; // at the end of route

            const nextStep = this._routeJoints[i + 1];
            const joint = this._trackGraph.getJoint(jointNumber);
            if (joint === null) break;

            // Verify that the next joint is reachable in the given direction.
            if (!joint.direction[direction].has(nextStep.jointNumber)) break;

            const curveNumber = joint.connections.get(nextStep.jointNumber);
            if (curveNumber === undefined) break;

            const nextTrackSegment =
                this._trackGraph.getTrackSegmentWithJoints(curveNumber);
            if (nextTrackSegment === null) break;

            // Determine the direction on the next segment.
            const nextDirection: 'tangent' | 'reverseTangent' =
                nextTrackSegment.t0Joint === jointNumber
                    ? 'tangent'
                    : 'reverseTangent';

            return {
                jointNumber: nextStep.jointNumber,
                direction: nextDirection,
                curveNumber,
            };
        }

        // Route doesn't cover this junction — fall back to default behaviour.
        return this._fallback.getNextJoint(jointNumber, direction);
    }
}
