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
import type { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import type { StopPosition } from '@/stations/types';
import type { SignalStateEngine } from '@/signals/signal-state-engine';

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

/**
 * Speed below which the train is considered fully stopped.
 * Unit: world units per second.
 */
const STOP_SPEED_THRESHOLD = 0.05;

/**
 * Distance at which the driver switches from proportional braking to a hard
 * creep brake, allowing the train to inch up to the exact stop position.
 * Unit: world units (≈ metres in the simulation coordinate system).
 */
const CREEP_DISTANCE = 3;

/**
 * Multiplier applied to the ideal (physics-based) braking distance so the
 * driver begins braking earlier than the theoretical minimum, providing a
 * safety buffer for frame-rate jitter and delayed throttle response.
 * Dimensionless ratio.
 */
const BRAKING_SAFETY_MARGIN = 1.8;

/**
 * Speed the train must reach before the DEPARTING phase transitions to
 * RUNNING. Prevents the driver from entering cruise logic while still
 * accelerating from a standstill.
 * Unit: world units per second.
 */
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
   * @param signalStateEngine - Optional signal engine for block signal awareness.
   */
  driveStep(
    train: Train,
    virtualTime: WeekMs,
    shift: ShiftTemplate,
    route: Route,
    stationManager: StationManager,
    trackGraph: TrackGraph,
    signalStateEngine?: SignalStateEngine,
    trackAlignedPlatformManager?: TrackAlignedPlatformManager,
  ): void {
    switch (this._state.phase) {
      case 'waiting_departure':
        this._handleWaitingDeparture(train, virtualTime, shift);
        break;
      case 'departing':
        this._handleDeparting(train, trackGraph, signalStateEngine);
        break;
      case 'running':
        this._handleRunning(train, shift, route, stationManager, trackGraph, signalStateEngine, trackAlignedPlatformManager);
        break;
      case 'approaching':
        this._handleApproaching(train, shift, route, stationManager, trackGraph, signalStateEngine, trackAlignedPlatformManager);
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

  private _handleDeparting(
    train: Train,
    trackGraph: TrackGraph,
    signalStateEngine?: SignalStateEngine,
  ): void {
    // Don't depart into a red signal
    if (signalStateEngine && train.position) {
      const signalInfo = signalStateEngine.getDistanceToRestrictiveSignal(
        train.position,
        trackGraph,
        this._jdm,
      );
      if (signalInfo && signalInfo.aspect === 'red' && signalInfo.distance < CREEP_DISTANCE) {
        train.setThrottleStep('b1');
        return;
      }
    }

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
    signalStateEngine?: SignalStateEngine,
    trackAlignedPlatformManager?: TrackAlignedPlatformManager,
  ): void {
    const distanceToStop = this._getDistanceToStop(
      train,
      shift,
      route,
      stationManager,
      trackGraph,
      trackAlignedPlatformManager,
    );

    // Check for restrictive signals ahead
    const signalInfo = this._getSignalInfo(train, trackGraph, signalStateEngine);

    // Use the closer of station stop or red signal as the effective target
    let effectiveDistance = distanceToStop;
    let targetIsSignal = false;
    let signalAspect: 'red' | 'yellow' | undefined;

    if (signalInfo) {
      signalAspect = signalInfo.aspect;
      if (signalInfo.aspect === 'red') {
        if (effectiveDistance === null || signalInfo.distance < effectiveDistance) {
          effectiveDistance = signalInfo.distance;
          targetIsSignal = true;
        }
      } else if (signalInfo.aspect === 'yellow') {
        // For yellow: slow to caution speed, don't treat as a hard stop
        const cautionSpeed = train.maxSpeed * 0.5;
        if (train.speed > cautionSpeed) {
          const brakingDist = this._computeBrakingDistance(train.speed - cautionSpeed);
          if (signalInfo.distance <= brakingDist * BRAKING_SAFETY_MARGIN) {
            this._transition('approaching');
            this._handleApproaching(train, shift, route, stationManager, trackGraph, signalStateEngine, trackAlignedPlatformManager);
            return;
          }
        }
      }
    }

    if (effectiveDistance === null) {
      // Can't compute distance — maintain current speed cautiously
      train.setThrottleStep('p3');
      return;
    }

    const brakingDistance = this._computeBrakingDistance(train.speed);

    if (effectiveDistance <= brakingDistance * BRAKING_SAFETY_MARGIN) {
      this._transition('approaching');
      this._handleApproaching(train, shift, route, stationManager, trackGraph, signalStateEngine, trackAlignedPlatformManager);
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
    signalStateEngine?: SignalStateEngine,
    trackAlignedPlatformManager?: TrackAlignedPlatformManager,
  ): void {
    const distanceToStop = this._getDistanceToStop(
      train,
      shift,
      route,
      stationManager,
      trackGraph,
      trackAlignedPlatformManager,
    );

    // Check signals
    const signalInfo = this._getSignalInfo(train, trackGraph, signalStateEngine);

    // Determine effective stopping distance and whether we're targeting a signal
    let effectiveDistance = distanceToStop;
    let isYellowSignal = false;

    if (signalInfo) {
      if (signalInfo.aspect === 'red') {
        if (effectiveDistance === null || signalInfo.distance < effectiveDistance) {
          effectiveDistance = signalInfo.distance;
        }
      } else if (signalInfo.aspect === 'yellow') {
        isYellowSignal = true;
        // For yellow, only use signal distance if no closer station stop
        if (effectiveDistance === null || signalInfo.distance < effectiveDistance) {
          effectiveDistance = signalInfo.distance;
        }
      }
    }

    // If the signal ahead has cleared (no restrictive signal and no station stop nearby),
    // return to running phase
    if (effectiveDistance === null && signalInfo === null) {
      // No signal or stop ahead — may have cleared while approaching
      if (distanceToStop === null) {
        train.setThrottleStep('b3');
        if (train.speed <= STOP_SPEED_THRESHOLD) {
          this._onArrived(train, shift);
        }
        return;
      }
    }

    if (effectiveDistance === null) {
      train.setThrottleStep('b3');
      if (train.speed <= STOP_SPEED_THRESHOLD) {
        this._onArrived(train, shift);
      }
      return;
    }

    // Yellow signal with no station stop ahead: slow to caution speed, then
    // resume running.  When a station stop *is* present we let the normal
    // braking logic handle both targets together so the train doesn't ignore
    // the station.
    if (isYellowSignal && distanceToStop === null) {
      const cautionSpeed = train.maxSpeed * 0.5;
      if (train.speed <= cautionSpeed) {
        // Reached caution speed — hold it and return to running
        train.setThrottleStep('N');
        this._transition('running');
        return;
      }
    }

    if (train.speed <= STOP_SPEED_THRESHOLD && effectiveDistance <= CREEP_DISTANCE) {
      // Check if this is a signal stop — if so, don't advance the station leg
      if (signalInfo && signalInfo.aspect === 'red' &&
          (distanceToStop === null || signalInfo.distance <= effectiveDistance)) {
        // Stopped at signal — hold brakes, stay in approaching to re-check
        train.setThrottleStep('b1');
        // If the signal clears, we'll transition back to running
        if (signalStateEngine && train.position) {
          const freshSignal = signalStateEngine.getDistanceToRestrictiveSignal(
            train.position,
            trackGraph,
            this._jdm,
          );
          if (!freshSignal || freshSignal.aspect !== 'red') {
            this._transition('running');
          }
        }
        return;
      }
      this._onArrived(train, shift);
      return;
    }

    // Proportional braking: the closer we are relative to ideal braking
    // distance, the harder we brake.
    this._applyProportionalBraking(train, effectiveDistance);
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
    trackAlignedPlatformManager?: TrackAlignedPlatformManager,
  ): number | null {
    const nextStopIndex = this._state.currentLegIndex + 1;
    if (nextStopIndex >= shift.stops.length) return null;

    const nextScheduledStop = shift.stops[nextStopIndex];
    const station = stationManager.getStation(nextScheduledStop.stationId);
    if (station === null) return null;

    let stopPos: StopPosition | undefined;

    if (nextScheduledStop.platformKind === 'trackAligned') {
      const tap = trackAlignedPlatformManager?.getPlatform(nextScheduledStop.platformId);
      stopPos = tap?.stopPositions[nextScheduledStop.stopPositionIndex];
    } else {
      const platform = station.platforms.find(
        (p) => p.id === nextScheduledStop.platformId,
      );
      stopPos = platform?.stopPositions[nextScheduledStop.stopPositionIndex];
    }

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
    return this._jdm.getRouteJoints();
  }

  // -----------------------------------------------------------------------
  // Signal helpers
  // -----------------------------------------------------------------------

  /**
   * Query the signal state engine for the nearest restrictive signal ahead.
   * Returns `null` if no signal engine or no restrictive signal found.
   */
  private _getSignalInfo(
    train: Train,
    trackGraph: TrackGraph,
    signalStateEngine?: SignalStateEngine,
  ): { distance: number; aspect: 'red' | 'yellow'; signalId: number } | null {
    if (!signalStateEngine || !train.position) return null;
    return signalStateEngine.getDistanceToRestrictiveSignal(
      train.position,
      trackGraph,
      this._jdm,
    );
  }

  /**
   * Apply proportional braking based on distance to target.
   * Extracted to share between station-stop and signal-stop logic.
   */
  private _applyProportionalBraking(train: Train, distance: number): void {
    const idealBraking = this._computeBrakingDistance(train.speed);
    const ratio = idealBraking > 0 ? distance / idealBraking : 0;

    if (distance <= CREEP_DISTANCE) {
      train.setThrottleStep('b6');
    } else if (ratio < 0.3) {
      train.setThrottleStep('er');
    } else if (ratio < 0.6) {
      train.setThrottleStep('b7');
    } else if (ratio < 0.9) {
      train.setThrottleStep('b5');
    } else if (ratio < 1.2) {
      train.setThrottleStep('b3');
    } else {
      train.setThrottleStep('b2');
    }
  }
}
