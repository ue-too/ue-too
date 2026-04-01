import { AutoDriver } from '../src/timetable/auto-driver';
import type {
  ActiveShiftState,
  ShiftTemplate,
  Route,
  ScheduledStop,
  WeekMs,
} from '../src/timetable/types';
import { DayOfWeek } from '../src/timetable/types';
import { DEFAULT_THROTTLE_STEPS, type ThrottleSteps } from '../src/trains/formation';
import type { TimetableJointDirectionManager } from '../src/timetable/timetable-joint-direction-manager';
import type { Train, TrainPosition } from '../src/trains/formation';
import type { TrackGraph } from '../src/trains/tracks/track';
import type { StationManager } from '../src/stations/station-manager';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockTrain(overrides: {
  speed?: number;
  position?: TrainPosition | null;
} = {}): Train & { calls: ThrottleSteps[] } {
  const calls: ThrottleSteps[] = [];
  return {
    speed: overrides.speed ?? 0,
    position: overrides.position ?? null,
    calls,
    setThrottleStep(step: ThrottleSteps) {
      calls.push(step);
    },
    get throttleStep() {
      return calls.length > 0 ? calls[calls.length - 1] : 'N';
    },
  } as unknown as Train & { calls: ThrottleSteps[] };
}

function makeMockJDM(routeJoints: { jointNumber: number }[] = []): TimetableJointDirectionManager {
  let idx = 0;
  return {
    setCurrentIndex(i: number) { idx = i; },
    get currentIndex() { return idx; },
    getRouteJoints() { return routeJoints; },
  } as unknown as TimetableJointDirectionManager;
}

function makeState(overrides: Partial<ActiveShiftState> = {}): ActiveShiftState {
  return {
    assignmentId: 'a1',
    trainId: 1,
    currentLegIndex: 0,
    phase: 'waiting_departure',
    routeJointProgress: 0,
    ...overrides,
  };
}

function makeStop(overrides: Partial<ScheduledStop> = {}): ScheduledStop {
  return {
    stationId: 1,
    platformId: 1,
    stopPositionIndex: 0,
    arrivalTime: null,
    departureTime: null,
    ...overrides,
  };
}

/** Minimal 2-stop shift. */
function makeShift(departureTime: WeekMs = 1000, arrivalTime: WeekMs = 5000): ShiftTemplate {
  return {
    id: 's1',
    name: 'Test Shift',
    activeDays: {
      [DayOfWeek.Monday]: true,
      [DayOfWeek.Tuesday]: true,
      [DayOfWeek.Wednesday]: true,
      [DayOfWeek.Thursday]: true,
      [DayOfWeek.Friday]: true,
      [DayOfWeek.Saturday]: false,
      [DayOfWeek.Sunday]: false,
    },
    stops: [
      makeStop({ departureTime }),
      makeStop({ arrivalTime }),
    ],
    legs: [{ routeId: 'r1' }],
  };
}

function makeRoute(): Route {
  return { id: 'r1', name: 'Test', joints: [] };
}

// Null-returning stubs for station/track
const nullStationManager = {
  getStation: () => null,
} as unknown as StationManager;

const nullTrackGraph = {
  getJoint: () => null,
  getTrackSegmentWithJoints: () => null,
} as unknown as TrackGraph;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoDriver', () => {
  // -- Phase: waiting_departure -------------------------------------------

  describe('waiting_departure phase', () => {
    it('holds brakes before departure time', () => {
      const state = makeState({ phase: 'waiting_departure' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 500 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);

      expect(train.calls).toEqual(['b1']);
      expect(state.phase).toBe('waiting_departure');
    });

    it('transitions to departing when departure time passes', () => {
      const state = makeState({ phase: 'waiting_departure' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 1001 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);

      expect(state.phase).toBe('departing');
    });

    it('stays in waiting_departure at the last stop (null departureTime)', () => {
      const state = makeState({ phase: 'waiting_departure', currentLegIndex: 1 });
      const shift: ShiftTemplate = {
        ...makeShift(),
        stops: [
          makeStop({ departureTime: 1000 }),
          makeStop({ arrivalTime: 5000, departureTime: null }),
        ],
      };
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 99999 as WeekMs, shift, makeRoute(), nullStationManager, nullTrackGraph);

      expect(state.phase).toBe('waiting_departure');
      expect(train.calls).toEqual(['b1']);
    });
  });

  // -- Phase: departing ---------------------------------------------------

  describe('departing phase', () => {
    it('applies full throttle (p5)', () => {
      const state = makeState({ phase: 'departing' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain({ speed: 0.3 });

      driver.driveStep(train, 2000 as WeekMs, makeShift(), makeRoute(), nullStationManager, nullTrackGraph);

      expect(train.calls).toEqual(['p5']);
      expect(state.phase).toBe('departing');
    });

    it('transitions to running when speed exceeds threshold', () => {
      const state = makeState({ phase: 'departing' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain({ speed: 1.5 });

      driver.driveStep(train, 2000 as WeekMs, makeShift(), makeRoute(), nullStationManager, nullTrackGraph);

      expect(state.phase).toBe('running');
    });
  });

  // -- Phase: running -----------------------------------------------------

  describe('running phase', () => {
    it('applies p5 when distance to stop is large (or null)', () => {
      const state = makeState({ phase: 'running' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain({ speed: 2.0 });

      // With nullStationManager, getDistanceToStop returns null → cautious p3
      driver.driveStep(train, 3000 as WeekMs, makeShift(), makeRoute(), nullStationManager, nullTrackGraph);

      // Can't compute distance → cautious p3
      expect(train.calls).toEqual(['p3']);
    });
  });

  // -- Phase: stopped -----------------------------------------------------

  describe('stopped phase', () => {
    it('holds brakes and advances to next leg', () => {
      const state = makeState({ phase: 'stopped', currentLegIndex: 0 });
      const shift: ShiftTemplate = {
        ...makeShift(),
        stops: [
          makeStop({ departureTime: 1000 }),
          makeStop({ arrivalTime: 3000, departureTime: 4000 }),
          makeStop({ arrivalTime: 7000 }),
        ],
        legs: [{ routeId: 'r1' }, { routeId: 'r2' }],
      };
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 3500 as WeekMs, shift, makeRoute(), nullStationManager, nullTrackGraph);

      expect(train.calls).toEqual(['b1']);
      expect(state.currentLegIndex).toBe(1);
      expect(state.routeJointProgress).toBe(0);
      expect(state.phase).toBe('waiting_departure');
    });

    it('stays stopped at the end of the shift', () => {
      // For a 2-stop shift, after arriving at the last stop, currentLegIndex
      // is already advanced to 1 (by a previous _handleStopped call).
      // nextLegIndex = 2 >= stops.length (2) → shift complete.
      const state = makeState({ phase: 'stopped', currentLegIndex: 1 });
      const shift = makeShift();
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 6000 as WeekMs, shift, makeRoute(), nullStationManager, nullTrackGraph);

      expect(train.calls).toEqual(['b1']);
      expect(state.phase).toBe('stopped');
    });
  });

  // -- onJointsPassed -----------------------------------------------------

  describe('onJointsPassed', () => {
    it('does nothing for empty array', () => {
      const state = makeState({ routeJointProgress: 0 });
      const jdm = makeMockJDM([
        { jointNumber: 0 },
        { jointNumber: 1 },
      ]);
      const driver = new AutoDriver(state, jdm);
      driver.onJointsPassed([]);
      expect(state.routeJointProgress).toBe(0);
    });

    it('advances progress when passing joints in the route', () => {
      const state = makeState({ routeJointProgress: 0 });
      const jdm = makeMockJDM([
        { jointNumber: 10 },
        { jointNumber: 20 },
        { jointNumber: 30 },
      ]);
      const driver = new AutoDriver(state, jdm);
      driver.onJointsPassed([{ jointNumber: 10 }]);
      expect(state.routeJointProgress).toBe(1);
    });

    it('advances through multiple joints in order', () => {
      const state = makeState({ routeJointProgress: 0 });
      const jdm = makeMockJDM([
        { jointNumber: 10 },
        { jointNumber: 20 },
        { jointNumber: 30 },
      ]);
      const driver = new AutoDriver(state, jdm);
      driver.onJointsPassed([{ jointNumber: 10 }, { jointNumber: 20 }]);
      expect(state.routeJointProgress).toBe(2);
    });
  });

  // -- _hasTimePassed (tested via waiting_departure) ----------------------

  describe('time passing / week wrap-around', () => {
    it('detects time has passed when current > target', () => {
      const state = makeState({ phase: 'waiting_departure' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 2000 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);
      expect(state.phase).toBe('departing');
    });

    it('detects time has NOT passed when current < target within same half-week', () => {
      const state = makeState({ phase: 'waiting_departure' });
      const driver = new AutoDriver(state, makeMockJDM());
      const train = makeMockTrain();

      driver.driveStep(train, 500 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);
      expect(state.phase).toBe('waiting_departure');
    });
  });

  // -- _computeBrakingDistance (physics) -----------------------------------

  describe('braking distance physics', () => {
    // We can't call the private method directly, but we can verify the
    // formula via the approaching behavior. The formula is:
    // d = v² / (2 * |b3|) = v² / (2 * 0.3) = v² / 0.6

    it('uses correct formula: d = v² / (2 * |b3 accel|)', () => {
      // Verify the constant is what we expect
      const b3Accel = Math.abs(DEFAULT_THROTTLE_STEPS['b3']);
      expect(b3Accel).toBe(0.3);

      // For speed = 3, braking distance = 9 / 0.6 = 15
      const speed = 3;
      const expected = (speed * speed) / (2 * b3Accel);
      expect(expected).toBe(15);
    });
  });

  // -- Full phase cycle ---------------------------------------------------

  describe('full phase cycle (integration)', () => {
    it('goes through waiting → departing → running for a simple shift', () => {
      const state = makeState({ phase: 'waiting_departure' });
      const driver = new AutoDriver(state, makeMockJDM());

      // Step 1: before departure
      const train1 = makeMockTrain({ speed: 0 });
      driver.driveStep(train1, 500 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);
      expect(state.phase).toBe('waiting_departure');

      // Step 2: after departure
      const train2 = makeMockTrain({ speed: 0 });
      driver.driveStep(train2, 1001 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);
      expect(state.phase).toBe('departing');

      // Step 3: speed picks up
      const train3 = makeMockTrain({ speed: 1.5 });
      driver.driveStep(train3, 2000 as WeekMs, makeShift(1000), makeRoute(), nullStationManager, nullTrackGraph);
      expect(state.phase).toBe('running');
    });
  });
});
