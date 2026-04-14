/**
 * Core type definitions for the timetable system.
 *
 * @module timetable/types
 */

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Day of the virtual week. */
export enum DayOfWeek {
  Monday = 0,
  Tuesday = 1,
  Wednesday = 2,
  Thursday = 3,
  Friday = 4,
  Saturday = 5,
  Sunday = 6,
}

/** Virtual time within a single day. */
export type TimeOfDay = {
  hours: number;   // 0–23
  minutes: number; // 0–59
  seconds: number; // 0–59
};

/** Full virtual datetime (day of week + time of day). */
export type VirtualDateTime = {
  day: DayOfWeek;
  time: TimeOfDay;
};

/**
 * Milliseconds elapsed since Monday 00:00:00 within a virtual week.
 *
 * @remarks
 * Range: `[0, MS_PER_WEEK)`.  Used as the canonical unit for all
 * schedule-related comparisons so that day-of-week boundaries are handled
 * naturally.
 */
export type WeekMs = number;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Opaque identifier for a {@link Route}. */
export type RouteId = string;

/**
 * A single step in a route: which joint the train passes through and in which
 * direction along the track tangent.
 */
export type RouteJointStep = {
  jointNumber: number;
  direction: 'tangent' | 'reverseTangent';
};

/**
 * A named, reusable path through the track graph.
 *
 * @remarks
 * Routes are defined as an ordered sequence of joints.  At runtime the
 * {@link TimetableJointDirectionManager} consults this sequence to decide
 * which branch to take at every junction.
 */
export type Route = {
  id: RouteId;
  name: string;
  /** Ordered sequence of joints the train must traverse. */
  joints: RouteJointStep[];
};

// ---------------------------------------------------------------------------
// Shift templates
// ---------------------------------------------------------------------------

/** Opaque identifier for a {@link ShiftTemplate}. */
export type ShiftTemplateId = string;

/** Which days of the virtual week a shift is active. */
export type DayMask = {
  [K in DayOfWeek]: boolean;
};

/**
 * A single scheduled stop within a shift.
 *
 * @remarks
 * `arrivalTime` is `null` for the very first stop (the train starts there).
 * `departureTime` is `null` for the very last stop (the train terminates).
 */
export type ScheduledStop = {
  stationId: number;
  /** Discriminator for the platform type — `'island'` for rectangle platforms
   *  stored in `station.platforms`, `'trackAligned'` for platforms managed by
   *  `TrackAlignedPlatformManager`. Defaults to `'island'` for backward compat. */
  platformKind: 'island' | 'trackAligned';
  platformId: number;
  /** Index into the platform's `stopPositions` array. */
  stopPositionIndex: number;
  /** Virtual week-ms when the train should arrive, or `null` for the first stop. */
  arrivalTime: WeekMs | null;
  /** Virtual week-ms when the train should depart, or `null` for the last stop. */
  departureTime: WeekMs | null;
};

/** A leg connecting two consecutive stops via a named route. */
export type ShiftLeg = {
  routeId: RouteId;
};

/**
 * A complete shift template defining a repeating timetable.
 *
 * @remarks
 * Invariant: `stops.length === legs.length + 1`.  Each leg connects
 * `stops[i]` to `stops[i+1]`.
 */
export type ShiftTemplate = {
  id: ShiftTemplateId;
  name: string;
  /** Which days of the virtual week this shift is active. */
  activeDays: DayMask;
  /** Ordered station stops.  Length is `legs.length + 1`. */
  stops: ScheduledStop[];
  /** Route for each leg between consecutive stops. */
  legs: ShiftLeg[];
};

// ---------------------------------------------------------------------------
// Shift assignments
// ---------------------------------------------------------------------------

/** Opaque identifier for a {@link ShiftAssignment}. */
export type ShiftAssignmentId = string;

/**
 * Binds a formation to a shift template.
 *
 * @remarks
 * When a formation is placed as a train the {@link TimetableManager} reads
 * this assignment to create an {@link AutoDriver}.  On coupling the inner
 * formation's assignment is suspended; on decoupling it resumes.
 */
export type ShiftAssignment = {
  id: ShiftAssignmentId;
  formationId: string;
  shiftTemplateId: ShiftTemplateId;
  /** `true` while the formation is coupled inside a larger formation. */
  suspended: boolean;
  /** When suspended, the stop index to resume from on decouple. */
  suspendedAtStopIndex: number | null;
};

// ---------------------------------------------------------------------------
// Runtime state (not serialized)
// ---------------------------------------------------------------------------

/** Phase of the auto-driver for a single leg. */
export type AutoDriverPhase =
  | 'waiting_departure'
  | 'departing'
  | 'running'
  | 'approaching'
  | 'stopped';

/**
 * Live runtime state for an auto-driven train.
 *
 * @remarks
 * Created by {@link TimetableManager} when a train with a shift assignment is
 * placed on the track.  Not persisted — rebuilt on load from the current
 * virtual clock and shift template.
 */
export type ActiveShiftState = {
  assignmentId: ShiftAssignmentId;
  trainId: number;
  /** Index of the current leg (between `stops[currentLegIndex]` and `stops[currentLegIndex + 1]`). */
  currentLegIndex: number;
  /** Current phase of the auto-driver for this leg. */
  phase: AutoDriverPhase;
  /** How far along the current route's joint sequence the train has progressed. */
  routeJointProgress: number;
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export type SerializedRouteJointStep = RouteJointStep;

export type SerializedRoute = {
  id: string;
  name: string;
  joints: SerializedRouteJointStep[];
};

export type SerializedScheduledStop = {
  stationId: number;
  /** Optional for backward compat — defaults to `'island'` when absent. */
  platformKind?: 'island' | 'trackAligned';
  platformId: number;
  stopPositionIndex: number;
  arrivalTime: number | null;
  departureTime: number | null;
};

export type SerializedShiftLeg = {
  routeId: string;
};

export type SerializedShiftTemplate = {
  id: string;
  name: string;
  activeDays: Record<string, boolean>;
  stops: SerializedScheduledStop[];
  legs: SerializedShiftLeg[];
};

export type SerializedShiftAssignment = {
  id: string;
  formationId: string;
  shiftTemplateId: string;
  suspended: boolean;
  suspendedAtStopIndex: number | null;
};

/**
 * Legacy type kept for backward compatibility with saved scenes.
 * The clock is now stateless — this data is ignored on deserialization.
 */
export type SerializedScheduleClock = Record<string, unknown>;

export type SerializedTimetableData = {
  clock: SerializedScheduleClock;
  routes: SerializedRoute[];
  shiftTemplates: SerializedShiftTemplate[];
  assignments: SerializedShiftAssignment[];
};
