/**
 * Orchestrates the timetable system: manages routes, shift templates,
 * assignments, and per-train {@link AutoDriver} instances.
 *
 * @module timetable/timetable-manager
 */
import type { SignalStateEngine } from '@/signals/signal-state-engine';
import type { StationManager } from '@/stations/station-manager';
import type { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import type { Train } from '@/trains/formation';
import {
    DefaultJointDirectionManager,
    type JointDirectionManager,
} from '@/trains/input-state-machine/train-kmt-state-machine';
import type { JointDirectionPreferenceMap } from '@/trains/tracks/joint-direction-preference-map';
import type { TrackGraph } from '@/trains/tracks/track';
import type { TrainManager } from '@/trains/train-manager';

import { AutoDriver } from './auto-driver';
import { RouteManager } from './route-manager';
import { ScheduleClock } from './schedule-clock';
import { ShiftTemplateManager } from './shift-template-manager';
import { TimetableJointDirectionManager } from './timetable-joint-direction-manager';
import type {
    ActiveShiftState,
    Route,
    SerializedShiftAssignment,
    SerializedTimetableData,
    ShiftAssignment,
    ShiftAssignmentId,
} from './types';

// ---------------------------------------------------------------------------
// TimetableManager
// ---------------------------------------------------------------------------

/**
 * Central coordinator for the timetable system.
 *
 * @remarks
 * - Holds the {@link ScheduleClock}, {@link RouteManager}, and
 *   {@link ShiftTemplateManager}.
 * - Maintains shift assignments (formation → shift template bindings).
 * - Creates and drives {@link AutoDriver} instances for placed trains.
 * - Listens to {@link TrainManager} for coupling/decoupling events to
 *   suspend and resume shift assignments.
 *
 * @example
 * ```typescript
 * const timetable = new TimetableManager(scheduleClock, trackGraph, trainManager, stationManager);
 * // Subscribe to TimeManager for per-frame updates:
 * timeManager.subscribe((currentTime, scaledDelta) => {
 *   timetable.update(currentTime, scaledDelta);
 * });
 * ```
 */
export class TimetableManager {
    private _scheduleClock: ScheduleClock;
    private _routeManager: RouteManager;
    private _shiftTemplateManager: ShiftTemplateManager;
    private _assignments: Map<ShiftAssignmentId, ShiftAssignment> = new Map();

    /** Active auto-drivers, keyed by train ID. */
    private _drivers: Map<number, AutoDriver> = new Map();

    /** Map from train ID → the original JointDirectionManager before we swapped it. */
    private _originalJdms: Map<number, JointDirectionManager> = new Map();

    private _trackGraph: TrackGraph;
    private _trainManager: TrainManager;
    private _stationManager: StationManager;
    private _trackAlignedPlatformManager: TrackAlignedPlatformManager | null =
        null;
    private _signalStateEngine: SignalStateEngine | null = null;
    private _preferenceMap: JointDirectionPreferenceMap | null = null;

    private _unsubTrainChanges: (() => void) | null = null;

    constructor(
        scheduleClock: ScheduleClock,
        trackGraph: TrackGraph,
        trainManager: TrainManager,
        stationManager: StationManager,
        routeManager?: RouteManager,
        shiftTemplateManager?: ShiftTemplateManager,
        preferenceMap?: JointDirectionPreferenceMap
    ) {
        this._scheduleClock = scheduleClock;
        this._trackGraph = trackGraph;
        this._trainManager = trainManager;
        this._stationManager = stationManager;
        this._routeManager = routeManager ?? new RouteManager();
        this._shiftTemplateManager =
            shiftTemplateManager ?? new ShiftTemplateManager();
        this._preferenceMap = preferenceMap ?? null;

        // Listen for train add/remove to handle coupling/decoupling
        this._unsubTrainChanges = this._trainManager.subscribeToChanges(
            (id, type) => {
                if (type === 'remove') {
                    this._onTrainRemoved(id);
                }
                // Note: 'add' events for coupling-created trains are handled
                // by the coupling logic in TrainManager which keeps the surviving
                // train.  Decoupling creates a new train via addTrain which fires
                // 'add' — we check for suspended assignments there.
                if (type === 'add') {
                    this._onTrainAdded(id);
                }
            }
        );
    }

    // -----------------------------------------------------------------------
    // Public accessors
    // -----------------------------------------------------------------------

    get scheduleClock(): ScheduleClock {
        return this._scheduleClock;
    }

    get routeManager(): RouteManager {
        return this._routeManager;
    }

    get shiftTemplateManager(): ShiftTemplateManager {
        return this._shiftTemplateManager;
    }

    /** Set the signal state engine for block signal awareness. */
    set signalStateEngine(engine: SignalStateEngine | null) {
        this._signalStateEngine = engine;
    }

    /** Set the track-aligned platform manager for resolving track-aligned stop positions. */
    set trackAlignedPlatformManager(
        manager: TrackAlignedPlatformManager | null
    ) {
        this._trackAlignedPlatformManager = manager;
    }

    /** Get all shift assignments. */
    getAssignments(): ShiftAssignment[] {
        return [...this._assignments.values()];
    }

    /** Get the assignment for a specific formation, if any. */
    getAssignmentForFormation(formationId: string): ShiftAssignment | null {
        for (const a of this._assignments.values()) {
            if (a.formationId === formationId) return a;
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Shift assignment
    // -----------------------------------------------------------------------

    /**
     * Assign a shift template to a formation.
     *
     * @param assignmentId - Unique ID for this assignment.
     * @param formationId - The formation to assign the shift to.
     * @param shiftTemplateId - The shift template to assign.
     */
    assignShift(
        assignmentId: ShiftAssignmentId,
        formationId: string,
        shiftTemplateId: string
    ): void {
        const assignment: ShiftAssignment = {
            id: assignmentId,
            formationId,
            shiftTemplateId,
            suspended: false,
            suspendedAtStopIndex: null,
        };
        this._assignments.set(assignmentId, assignment);

        // If the formation is already placed as a train, activate immediately
        this._tryActivateAssignment(assignment);
    }

    /** Remove a shift assignment. Stops the auto-driver if active. */
    unassignShift(assignmentId: ShiftAssignmentId): void {
        const assignment = this._assignments.get(assignmentId);
        if (!assignment) return;

        // Find and stop the associated driver
        for (const [trainId, driver] of this._drivers) {
            if (driver.state.assignmentId === assignmentId) {
                this._deactivateDriver(trainId);
                break;
            }
        }

        this._assignments.delete(assignmentId);
    }

    // -----------------------------------------------------------------------
    // Per-frame update
    // -----------------------------------------------------------------------

    /**
     * Called each frame (via TimeManager subscription).
     *
     * @param currentTime - Elapsed simulation ms from TimeManager.
     * @param _scaledDelta - Scaled delta ms (unused here but available).
     */
    update(currentTime: number, _scaledDelta: number): void {
        const virtualTime = this._scheduleClock.toWeekMs(currentTime);

        for (const [trainId, driver] of this._drivers) {
            const train = this._getTrainById(trainId);
            if (train === null) {
                // Train was removed without going through the event handler
                this._drivers.delete(trainId);
                continue;
            }

            const assignment = this._assignments.get(driver.state.assignmentId);
            if (!assignment || assignment.suspended) continue;

            const shift = this._shiftTemplateManager.getTemplate(
                assignment.shiftTemplateId
            );
            if (shift === null) continue;

            // Get the route for the current leg
            const legIndex = driver.state.currentLegIndex;
            if (legIndex >= shift.legs.length) continue;

            const route = this._routeManager.getRoute(
                shift.legs[legIndex].routeId
            );
            if (route === null) continue;

            driver.driveStep(
                train,
                virtualTime,
                shift,
                route,
                this._stationManager,
                this._trackGraph,
                this._signalStateEngine ?? undefined,
                this._trackAlignedPlatformManager ?? undefined
            );
        }
    }

    // -----------------------------------------------------------------------
    // Train events
    // -----------------------------------------------------------------------

    /**
     * When a train is removed (e.g. due to coupling), suspend its assignment.
     */
    private _onTrainRemoved(trainId: number): void {
        const driver = this._drivers.get(trainId);
        if (!driver) return;

        const assignment = this._assignments.get(driver.state.assignmentId);
        if (assignment) {
            assignment.suspended = true;
            assignment.suspendedAtStopIndex = driver.state.currentLegIndex;
        }

        this._deactivateDriver(trainId);
    }

    /**
     * When a train is added (e.g. placement or decoupling), check if its
     * formation has a shift assignment and activate it.
     */
    private _onTrainAdded(trainId: number): void {
        const train = this._getTrainById(trainId);
        if (train === null) return;

        const formationId = train.formation.id;

        // Check direct assignment
        for (const assignment of this._assignments.values()) {
            if (assignment.formationId === formationId) {
                if (assignment.suspended) {
                    assignment.suspended = false;
                    // Resume from the suspended stop index
                    this._activateDriver(
                        trainId,
                        assignment,
                        assignment.suspendedAtStopIndex ?? 0
                    );
                    assignment.suspendedAtStopIndex = null;
                } else {
                    this._tryActivateAssignment(assignment);
                }
                return;
            }
        }

        // Check nested formations for suspended assignments
        this._checkNestedFormationsForAssignments(trainId, train);
    }

    /**
     * Walk the formation tree looking for sub-formations with suspended
     * assignments.
     */
    private _checkNestedFormationsForAssignments(
        trainId: number,
        train: Train
    ): void {
        // The formation tree is walked via flatCars — but we need formation IDs.
        // For now, only check the top-level formation.
        // TODO: walk nested formation tree for suspended assignments after decoupling.
    }

    // -----------------------------------------------------------------------
    // Driver lifecycle
    // -----------------------------------------------------------------------

    private _tryActivateAssignment(assignment: ShiftAssignment): void {
        if (assignment.suspended) return;

        // Find the train with this formation
        for (const { id, train } of this._trainManager.getPlacedTrains()) {
            if (train.formation.id === assignment.formationId) {
                this._activateDriver(id, assignment, 0);
                return;
            }
        }
    }

    private _activateDriver(
        trainId: number,
        assignment: ShiftAssignment,
        startStopIndex: number
    ): void {
        if (this._drivers.has(trainId)) return; // already active

        const shift = this._shiftTemplateManager.getTemplate(
            assignment.shiftTemplateId
        );
        if (shift === null) return;

        // Get the route for the first (or resumed) leg
        const legIndex = startStopIndex;
        if (legIndex >= shift.legs.length) return;

        const route = this._routeManager.getRoute(shift.legs[legIndex].routeId);
        if (route === null) return;

        const train = this._getTrainById(trainId);
        if (train === null) return;

        // Create a route-aware JDM
        const jdm = new TimetableJointDirectionManager(
            this._trackGraph,
            route.joints,
            0,
            this._preferenceMap ?? undefined
        );

        // Save the original JDM so we can restore it later
        // (We can't easily read it since it's private, so we just track that
        // we've overridden it)
        const defaultJdm = new DefaultJointDirectionManager(
            this._trackGraph,
            this._preferenceMap ?? undefined
        );
        this._originalJdms.set(trainId, defaultJdm);

        // Swap in the timetable JDM
        train.setJointDirectionManager(jdm);

        const state: ActiveShiftState = {
            assignmentId: assignment.id,
            trainId,
            currentLegIndex: startStopIndex,
            phase: 'waiting_departure',
            routeJointProgress: 0,
        };

        const driver = new AutoDriver(state, jdm);
        this._drivers.set(trainId, driver);
    }

    private _deactivateDriver(trainId: number): void {
        this._drivers.delete(trainId);

        // Restore original JDM
        const originalJdm = this._originalJdms.get(trainId);
        if (originalJdm) {
            const train = this._getTrainById(trainId);
            if (train) {
                train.setJointDirectionManager(originalJdm);
            }
            this._originalJdms.delete(trainId);
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private _getTrainById(trainId: number): Train | null {
        return this._trainManager.getTrainById(trainId);
    }

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    /** Unsubscribe from TrainManager events. Call when tearing down. */
    dispose(): void {
        if (this._unsubTrainChanges) {
            this._unsubTrainChanges();
            this._unsubTrainChanges = null;
        }
        this._drivers.clear();
        this._originalJdms.clear();
    }

    // -----------------------------------------------------------------------
    // Serialization
    // -----------------------------------------------------------------------

    serialize(): SerializedTimetableData {
        return {
            clock: this._scheduleClock.serialize(),
            routes: this._routeManager.serialize(),
            shiftTemplates: this._shiftTemplateManager.serialize(),
            assignments: [...this._assignments.values()].map(a => ({
                id: a.id,
                formationId: a.formationId,
                shiftTemplateId: a.shiftTemplateId,
                suspended: a.suspended,
                suspendedAtStopIndex: a.suspendedAtStopIndex,
            })),
        };
    }

    static deserialize(
        data: SerializedTimetableData,
        trackGraph: TrackGraph,
        trainManager: TrainManager,
        stationManager: StationManager,
        signalStateEngine?: SignalStateEngine | null
    ): TimetableManager {
        const clock = ScheduleClock.deserialize(data.clock);
        const routeManager = RouteManager.deserialize(data.routes);
        const shiftTemplateManager = ShiftTemplateManager.deserialize(
            data.shiftTemplates
        );

        const manager = new TimetableManager(
            clock,
            trackGraph,
            trainManager,
            stationManager,
            routeManager,
            shiftTemplateManager
        );

        // Connect the signal engine before activating drivers so that
        // auto-drivers have signal awareness from the first frame.
        if (signalStateEngine) {
            manager._signalStateEngine = signalStateEngine;
        }

        // Restore assignments
        for (const sa of data.assignments) {
            const assignment: ShiftAssignment = {
                id: sa.id,
                formationId: sa.formationId,
                shiftTemplateId: sa.shiftTemplateId,
                suspended: sa.suspended,
                suspendedAtStopIndex: sa.suspendedAtStopIndex,
            };
            manager._assignments.set(sa.id, assignment);

            // Try to activate if the formation is already placed
            if (!assignment.suspended) {
                manager._tryActivateAssignment(assignment);
            }
        }

        return manager;
    }
}
