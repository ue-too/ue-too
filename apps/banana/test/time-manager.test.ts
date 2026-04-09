// ---------------------------------------------------------------------------
// Minimal document mock for non-browser test environments
// ---------------------------------------------------------------------------

type EventHandler = () => void;
const visibilityListeners: EventHandler[] = [];
let mockHidden = false;

if (typeof document === 'undefined') {
  (globalThis as any).document = {
    get hidden() { return mockHidden; },
    addEventListener(_event: string, handler: EventHandler) {
      visibilityListeners.push(handler);
    },
    removeEventListener(_event: string, handler: EventHandler) {
      const idx = visibilityListeners.indexOf(handler);
      if (idx >= 0) visibilityListeners.splice(idx, 1);
    },
    dispatchEvent(_e: any) {
      for (const h of visibilityListeners) h();
    },
  };
}

function simulateVisibilityChange(hidden: boolean) {
  mockHidden = hidden;
  if (typeof Event !== 'undefined') {
    document.dispatchEvent(new Event('visibilitychange'));
  } else {
    // Fallback for environments without Event constructor
    for (const h of visibilityListeners) h();
  }
}

import { TimeManager } from '../src/time/time-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TickerCallback = (time: { deltaMS: number }) => void;

/** Minimal mock of a Pixi Application with a controllable ticker. */
function makeMockApp() {
  let callback: TickerCallback | null = null;

  const ticker = {
    lastTime: 0,
    add(cb: TickerCallback) {
      callback = cb;
    },
    remove(_cb: TickerCallback) {
      callback = null;
    },
  };

  return {
    app: { ticker } as unknown as import('pixi.js').Application,
    ticker,
    /** Simulate a Pixi ticker frame with a given deltaMS. */
    tick(deltaMS: number) {
      callback?.({ deltaMS });
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimeManager', () => {
  let mock: ReturnType<typeof makeMockApp>;
  let tm: TimeManager;

  beforeEach(() => {
    mock = makeMockApp();
    tm = new TimeManager(mock.app);
  });

  afterEach(() => {
    tm.dispose();
  });

  // -----------------------------------------------------------------------
  // Basic update behaviour
  // -----------------------------------------------------------------------

  describe('update', () => {
    it('notifies subscribers with the current time and delta', () => {
      const calls: [number, number][] = [];
      tm.subscribe((currentTime, delta) => calls.push([currentTime, delta]));

      mock.tick(16);

      expect(calls.length).toBeGreaterThan(0);
      const totalDelta = calls.reduce((s, [, d]) => s + d, 0);
      expect(totalDelta).toBeCloseTo(16, 5);
    });

    it('accumulates current time across multiple ticks', () => {
      let firstTime = 0;
      let lastTime = 0;
      let callCount = 0;
      tm.subscribe((currentTime) => {
        if (callCount === 0) firstTime = currentTime;
        lastTime = currentTime;
        callCount++;
      });

      mock.tick(10);
      const afterFirst = lastTime;
      mock.tick(20);

      // The delta between first tick end and final should be ~20
      expect(lastTime - afterFirst).toBeCloseTo(20, 5);
    });

    it('does not notify when paused', () => {
      const calls: number[] = [];
      tm.subscribe((_, delta) => calls.push(delta));

      tm.pause();
      mock.tick(16);

      expect(calls).toHaveLength(0);
    });

    it('resumes correctly after pause', () => {
      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));

      mock.tick(10);
      tm.pause();
      mock.tick(100); // should be ignored
      tm.resume();
      mock.tick(5);

      // Total accumulated delta should be 15 (10 + 5, skipping 100 while paused)
      const total = deltas.reduce((s, d) => s + d, 0);
      expect(total).toBeCloseTo(15, 5);
    });
  });

  // -----------------------------------------------------------------------
  // Speed scaling
  // -----------------------------------------------------------------------

  describe('speed', () => {
    it('scales delta by the speed multiplier', () => {
      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));

      tm.setSpeed(2);
      mock.tick(10);

      const total = deltas.reduce((s, d) => s + d, 0);
      expect(total).toBeCloseTo(20, 5);
    });

    it('reports current speed', () => {
      expect(tm.speed).toBe(1);
      tm.setSpeed(3);
      expect(tm.speed).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Sub-stepping
  // -----------------------------------------------------------------------

  describe('sub-stepping', () => {
    it('breaks a large delta into sub-steps of at most ~16.667ms', () => {
      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));

      // Simulate a 100ms frame (e.g., browser throttle)
      mock.tick(100);

      // Every sub-step should be ≤ 16.667ms
      for (const d of deltas) {
        expect(d).toBeLessThanOrEqual(16.667 + 1e-6);
      }

      // Total should equal the original delta
      const total = deltas.reduce((s, d) => s + d, 0);
      expect(total).toBeCloseTo(100, 5);
    });

    it('does not sub-step deltas that are already small', () => {
      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));

      mock.tick(10);

      expect(deltas).toHaveLength(1);
      expect(deltas[0]).toBeCloseTo(10, 5);
    });

    it('sub-steps correctly with speed multiplier', () => {
      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));

      tm.setSpeed(4);
      mock.tick(50); // scaled = 200ms

      for (const d of deltas) {
        expect(d).toBeLessThanOrEqual(16.667 + 1e-6);
      }

      const total = deltas.reduce((s, d) => s + d, 0);
      expect(total).toBeCloseTo(200, 5);
    });

    it('produces consistent accumulated delta regardless of step size', () => {
      // Run 1: one large 100ms tick
      const mock1 = makeMockApp();
      const tm1 = new TimeManager(mock1.app);
      const deltas1: number[] = [];
      tm1.subscribe((_, d) => deltas1.push(d));
      mock1.tick(100);

      // Run 2: many small 1ms ticks totalling 100ms
      const mock2 = makeMockApp();
      const tm2 = new TimeManager(mock2.app);
      const deltas2: number[] = [];
      tm2.subscribe((_, d) => deltas2.push(d));
      for (let i = 0; i < 100; i++) {
        mock2.tick(1);
      }

      const total1 = deltas1.reduce((s, d) => s + d, 0);
      const total2 = deltas2.reduce((s, d) => s + d, 0);
      expect(total1).toBeCloseTo(total2, 3);

      tm1.dispose();
      tm2.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // Visibility change (tab switching)
  // -----------------------------------------------------------------------

  describe('visibility change', () => {
    it('resets ticker.lastTime when tab becomes visible', () => {
      const before = performance.now();

      // Simulate tab hidden → visible
      simulateVisibilityChange(true);
      simulateVisibilityChange(false);

      const after = performance.now();

      // ticker.lastTime should have been reset to approximately now
      expect(mock.ticker.lastTime).toBeGreaterThanOrEqual(before);
      expect(mock.ticker.lastTime).toBeLessThanOrEqual(after);
    });
  });

  // -----------------------------------------------------------------------
  // setCurrentTime
  // -----------------------------------------------------------------------

  describe('setCurrentTime', () => {
    it('overrides the current time', () => {
      const target = Date.UTC(2026, 3, 9, 12, 0, 0);
      tm.setCurrentTime(target);

      let reported = 0;
      tm.subscribe((t) => { reported = t; });
      mock.tick(10);

      expect(reported).toBeCloseTo(target + 10, 5);
    });

    it('is readable via currentTime getter', () => {
      const target = 123456789;
      tm.setCurrentTime(target);
      expect(tm.currentTime).toBe(target);
    });

    it('subsequent ticks accumulate from the restored time', () => {
      const saved = Date.UTC(2025, 0, 6, 8, 0, 0); // Monday 08:00 UTC
      tm.setCurrentTime(saved);

      const times: number[] = [];
      tm.subscribe((t) => { times.push(t); });

      mock.tick(100);
      mock.tick(200);

      const totalDelta = times[times.length - 1] - saved;
      expect(totalDelta).toBeCloseTo(300, 5);
    });

    it('respects speed after time restoration', () => {
      const saved = Date.UTC(2025, 5, 1, 12, 0, 0);
      tm.setCurrentTime(saved);
      tm.setSpeed(5);

      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));
      mock.tick(20);

      const total = deltas.reduce((s, d) => s + d, 0);
      expect(total).toBeCloseTo(100, 5); // 20 * 5
    });

    it('respects pause after time restoration', () => {
      const saved = Date.UTC(2025, 5, 1, 12, 0, 0);
      tm.setCurrentTime(saved);
      tm.pause();

      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));
      mock.tick(100);

      expect(deltas).toHaveLength(0);
      expect(tm.currentTime).toBe(saved);
    });

    it('schedule clock produces correct day/time from restored time', () => {
      // Import ScheduleClock here to test integration
      const { ScheduleClock } = require('../src/timetable/schedule-clock');
      const clock = new ScheduleClock();

      // Monday 08:30:00 UTC — 2025-01-06 is a Monday
      const saved = Date.UTC(2025, 0, 6, 8, 30, 0);
      tm.setCurrentTime(saved);

      const vdt = clock.toVirtualDateTime(tm.currentTime);
      expect(vdt.day).toBe(0); // DayOfWeek.Monday
      expect(vdt.time.hours).toBe(8);
      expect(vdt.time.minutes).toBe(30);
      expect(vdt.time.seconds).toBe(0);
    });

    it('schedule clock advances correctly after restoration and ticks', () => {
      const { ScheduleClock } = require('../src/timetable/schedule-clock');
      const clock = new ScheduleClock();

      // Wednesday 14:00:00 UTC — 2025-01-08 is a Wednesday
      const saved = Date.UTC(2025, 0, 8, 14, 0, 0);
      tm.setCurrentTime(saved);

      // Tick forward 2 hours worth of deltas
      let lastTime = 0;
      tm.subscribe((t) => { lastTime = t; });
      const twoHoursMs = 2 * 3_600_000;
      const steps = 100;
      for (let i = 0; i < steps; i++) {
        mock.tick(twoHoursMs / steps);
      }

      // Verify the total accumulated time is ~2 hours past saved
      expect(lastTime - saved).toBeCloseTo(twoHoursMs, -2); // within 100ms

      const vdt = clock.toVirtualDateTime(lastTime);
      expect(vdt.day).toBe(2); // DayOfWeek.Wednesday
      // Hours should be 16 (14 + 2), allow for minor sub-step rounding
      expect(vdt.time.hours).toBeGreaterThanOrEqual(15);
      expect(vdt.time.hours).toBeLessThanOrEqual(16);
    });
  });

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  describe('dispose', () => {
    it('removes the ticker callback', () => {
      const deltas: number[] = [];
      tm.subscribe((_, d) => deltas.push(d));

      tm.dispose();
      mock.tick(16);

      expect(deltas).toHaveLength(0);
    });
  });
});
