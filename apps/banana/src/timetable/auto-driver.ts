/**
 * Per-train automatic driving controller.
 *
 * @remarks
 * The AutoDriver implements a 5-phase state machine that sets a train's
 * throttle step each frame to follow a shift template.  It runs *before*
 * {@link Train.update} so the existing physics loop applies the chosen
 * throttle normally.
 *
 * @module timetable/auto-driver
 */

import type { TrackGraph } from '@/trains/tracks/track';
import type { Train, TrainPosition } from '@/trains/formation';
import { DEFAULT_THROTTLE_STEPS } from '@/trains/formation';
import type { StationManager } from '@/stations/station-manager';
import type { StopPosition } from '@/stations/types';

import type {
  ActiveShiftState,
  AutoDriverPhase,
  Route,
  ShiftTemplate,
  WeekMs,
} from './types';
import type { TimetableJointDirectionManager } from './timetable-joint-direction-manager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Speed (world units / s) below which the train is considered stopped. */
const STOP_SPEED_THRESHOLD = 0.05;

/** Distance (world units) at which to start creeping rather than full brake. */
const CREEP_DISTANCE = 3;

/** Safety factor applied to the ideal braking distance. */
const BRAKING_SAFETY_MARGIN = 1.8;

/** Speed threshold to transition from DEPARTING to RUNNING. */
const DEPARTING_SPEED_THRESHOLD = 1.0;

// ---------------------------------------------------------------------------
// AutoDriver
// ---------------------------------------------------------------------------

/**
 * Controls a single train's throttle to follow an assigned shift.
 *
 * @example
 * ```typescript
 * const driver = new AutoDriver(activeState, jdm);
 * // Each frame, before train.update():
 * driver.driveStep(train, virtualWeekMs, shiftTemplate, route, stationManager, trackGraph);
 * ```
 */
export class AutoDriver {
  private _state: ActiveShiftState;
  private _jdm: TimetableJointDirectionManager;

  constructor(
    state: ActiveShiftState,
    jdm: TimetableJointDirectionManager,
  ) {
    this._state = state;
    this._jdm = jdm;
  }

  /** The current runtime state. */
  get state(): ActiveShiftState {
    return this._state;
  }

  /**
   * Main per-frame entry point.  Sets the train's throttle step based on the
   * current shift state, virtual clock, and distance to the next stop.
   *
   * @param train - The train to control.
   * @param virtualTime - Current virtual week-ms from {@link ScheduleClock}.
   * @param shift - The active shift template.
   * @param route - The route for the current leg.
   * @param stationManager - For resolving station/platform stop positions.
   * @param trackGraph - The track graph for distance computation.
   */
  driveStep(
    train: Train,
    virtualTime: WeekMs,
    shift: ShiftTemplate,
    route: Route,
    stationManager: StationManager,
    trackGraph: TrackGraph,
  ): void {
    switch (this._state.phase) {
      case 'waiting_departure':
        this._handleWaitingDeparture(train, virtualTime, shift);
        break;
      case 'departing':
        this._handleDeparting(train);
        break;
      case 'running':
        this._handleRunning(train, shift, route, stationManager, trackGraph);
        break;
      case 'approaching':
        this._handleApproaching(train, shift, route, stationManager, trackGraph);
        break;
      case 'stopped':
        this._handleStopped(train, shift);
        break;
    }
  }

  /**
   * Notify the driver that the train passed through joints, so the route
   * progress and distance cache can be updated.
   *
   * @param passedJoints - Joint numbers the train just passed.
   */
  onJointsPassed(passedJoints: { jointNumber: number }[]): void {
    if (passedJoints.length === 0) return;

    // Advance route progress
    const routeJoints = this._currentRouteJoints();
    for (const passed of passedJoints) {
      for (let i = this._state.routeJointProgress; i < routeJoints.length; i++) {
        if (routeJoints[i].jointNumber === passed.jointNumber) {
          this._state.routeJointProgress = i + 1;
          this._jdm.setCurrentIndex(i + 1);
          break;
        }
      }
    }

  }

  // -----------------------------------------------------------------------
  // Phase handlers
  // -----------------------------------------------------------------------

  private _handleWaitingDeparture(
    train: Train,
    virtualTime: WeekMs,
    shift: ShiftTemplate,
  ): void {
    // Hold brakes
    train.setThrottleStep('b1');

    const currentStop = shift.stops[this._state.currentLegIndex];
    if (currentStop.departureTime === null) {
      // Last stop — shift complete.  Stay stopped.
      return;
    }

    if (this._hasTimePassed(virtualTime, currentStop.departureTime)) {
      this._transition('departing');
    }
  }

  private _handleDeparting(train: Train): void {
    train.setThrottleStep('p5');

    if (train.speed >= DEPARTING_SPEED_THRESHOLD) {
      this._transition('running');
    }
  }

  private _handleRunning(
    train: Train,
    shift: ShiftTemplate,
    route: Route,
    stationManager: StationManager,
    trackGraph: TrackGraph,
  ): void {
    const distanceToStop = this._getDistanceToStop(
      train,
      shift,
      route,
      stationManager,
      trackGraph,
    );

    if (distanceToStop === null) {
      // Can't compute distance — maintain current speed cautiously
      train.setThrottleStep('p3');
      return;
    }

    const brakingDistance = this._computeBrakingDistance(train.speed);

    if (distanceToStop <= brakingDistance * BRAKING_SAFETY_MARGIN) {
      this._transition('approaching');
      this._handleApproaching(train, shift, route, stationManager, trackGraph);
      return;
    }

    // Cruise — use high power to reach cruising speed
    train.setThrottleStep('p5');
  }

  private _handleApproaching(
    train: Train,
    shift: ShiftTemplate,
    route: Route,
    stationManager: StationManager,
    trackGraph: TrackGraph,
  ): void {
    const distanceToStop = this._getDistanceToStop(
      train,
      shift,
      route,
      stationManager,
      trackGraph,
    );

    if (distanceToStop === null) {
      train.setThrottleStep('b3');
      if (train.speed <= STOP_SPEED_THRESHOLD) {
        this._onArrived(train, shift);
      }
      return;
    }

    if (train.speed <= STOP_SPEED_THRESHOLD && distanceToStop <= CREEP_DISTANCE) {
      this._onArrived(train, shift);
      return;
    }

    // Proportional braking: the closer we are relative to ideal braking
    // distance, the harder we brake.
    const idealBraking = this._computeBrakingDistance(train.speed);
    const ratio = idealBraking > 0 ? distanceToStop / idealBraking : 0;

    if (distanceToStop <= CREEP_DISTANCE) {
      // Very close — strong brake to crawl to a stop
      train.setThrottleStep('b6');
    } else if (ratio < 0.3) {
      // Way too close for current speed — emergency brake
      train.setThrottleStep('er');
    } else if (ratio < 0.6) {
      train.setThrottleStep('b7');
    } else if (ratio < 0.9) {
      train.setThrottleStep('b5');
    } else if (ratio < 1.2) {
      train.setThrottleStep('b3');
    } else {
      // Still have margin — light brake to start decelerating
      train.setThrottleStep('b2');
    }
  }

  private _handleStopped(train: Train, shift: ShiftTemplate): void {
    train.setThrottleStep('b1');

    // Advance to next leg
    const nextLegIndex = this._state.currentLegIndex + 1;
    if (nextLegIndex >= shift.stops.length) {
      // Shift complete — could loop or go idle.  For now, stay stopped.
      return;
    }

    this._state.currentLegIndex = nextLegIndex;
    this._state.routeJointProgress = 0;

    // Update the JDM to use the next leg's route if available
    if (nextLegIndex < shift.legs.length) {
      // The TimetableManager will update the route joints on the JDM
      // when it detects a leg change.  For now, reset progress.
      this._jdm.setCurrentIndex(0);
    }

    this._transition('waiting_departure');
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private _onArrived(train: Train, shift: ShiftTemplate): void {
    train.setThrottleStep('b7');
    this._transition('stopped');
  }

  private _transition(phase: AutoDriverPhase): void {
    this._state.phase = phase;
  }

  /**
   * Compute the distance from the train's current position to the next stop.
   *
   * @remarks
   * Walks forward along the route's track segments, summing arc lengths.
   * Recomputed every frame so braking decisions use up-to-date values.
   */
  private _getDistanceToStop(
    train: Train,
    shift: ShiftTemplate,
    route: Route,
    stationManager: StationManager,
    trackGraph: TrackGraph,
  ): number | null {
    const nextStopIndex = this._state.currentLegIndex + 1;
    if (nextStopIndex >= shift.stops.length) return null;

    const nextScheduledStop = shift.stops[nextStopIndex];
    const station = stationManager.getStation(nextScheduledStop.stationId);
    if (station === null) return null;

    const platform = station.platforms.find(
      (p) => p.id === nextScheduledStop.platformId,
    );
    if (!platform) return null;

    const stopPos = platform.stopPositions[nextScheduledStop.stopPositionIndex];
    if (!stopPos) return null;

    const position = train.position;
    if (position === null) return null;

    return this._computeDistanceAlongRoute(
      position,
      stopPos,
      route,
      trackGraph,
    );
  }

  /**
   * Compute distance from a train position to a stop position by walking
   * the route's track segments.
   */
  private _computeDistanceAlongRoute(
    from: TrainPosition,
    to: StopPosition,
    route: Route,
    trackGraph: TrackGraph,
  ): number | null {
    // Simple case: same segment
    if (from.trackSegment === to.trackSegmentId) {
      const seg = trackGraph.getTrackSegmentWithJoints(from.trackSegment);
      if (seg === null) return null;

      const fromLength = seg.curve.lengthAtT(from.tValue);
      const toLength = seg.curve.lengthAtT(to.tValue);
      const diff = from.direction === 'tangent'
        ? toLength - fromLength
        : fromLength - toLength;
      return diff > 0 ? diff : null;
    }

    // Walk forward through segments from current position
    let totalDistance = 0;

    // Distance from current position to end of current segment
    const currentSeg = trackGraph.getTrackSegmentWithJoints(from.trackSegment);
    if (currentSeg === null) return null;

    const currentPosLength = currentSeg.curve.lengthAtT(from.tValue);
    if (from.direction === 'tangent') {
      totalDistance += currentSeg.curve.fullLength - currentPosLength;
    } else {
      totalDistance += currentPosLength;
    }

    // Walk through route joints to find intermediate segments
    const routeJoints = route.joints;
    let foundTarget = false;

    for (let i = this._state.routeJointProgress; i < routeJoints.length - 1; i++) {
      const fromJoint = routeJoints[i];
      const toJoint = routeJoints[i + 1];

      const joint = trackGraph.getJoint(fromJoint.jointNumber);
      if (joint === null) return null;

      const segNumber = joint.connections.get(toJoint.jointNumber);
      if (segNumber === undefined) return null;

      // Skip the current segment (already accounted for)
      if (segNumber === from.trackSegment) continue;

      const seg = trackGraph.getTrackSegmentWithJoints(segNumber);
      if (seg === null) return null;

      if (segNumber === to.trackSegmentId) {
        // This is the target segment — add partial distance
        const toLength = seg.curve.lengthAtT(to.tValue);
        if (to.direction === 'tangent') {
          totalDistance += toLength;
        } else {
          totalDistance += seg.curve.fullLength - toLength;
        }
        foundTarget = true;
        break;
      }

      // Full segment
      totalDistance += seg.curve.fullLength;
    }

    return foundTarget ? totalDistance : null;
  }

  /**
   * Compute the ideal braking distance from the current speed using the
   * default brake deceleration (`b3` as baseline).
   *
   * @remarks
   * `d = v² / (2 * |a|)`
   */
  private _computeBrakingDistance(speed: number): number {
    const brakeAccel = Math.abs(DEFAULT_THROTTLE_STEPS['b3']);
    if (brakeAccel === 0) return Infinity;
    return (speed * speed) / (2 * brakeAccel);
  }

  /**
   * Check whether a target time has passed, accounting for week wrap-around.
   *
   * @remarks
   * Uses a simple heuristic: if the difference is within half a week, the
   * target is considered "in the past" when `current >= target`.  Larger
   * differences are treated as "target is next week".
   */
  private _hasTimePassed(current: WeekMs, target: WeekMs): boolean {
    const diff = current - target;
    // Within the same half-week window, positive diff means we've passed it.
    if (diff >= 0 && diff < 302_400_000) return true; // half week
    // Negative diff but very close to a full week means we've wrapped.
    if (diff < 0 && diff > -302_400_000) return false;
    // Edge case: treat as passed if we're very close to wrapping
    return diff >= 0;
  }

  private _currentRouteJoints() {
    // Placeholder — the actual route joints should be sourced from the
    // TimetableManager via the JDM.  For now return empty to avoid crashes.
    return this._jdm['_routeJoints'] ?? [];
  }
}
