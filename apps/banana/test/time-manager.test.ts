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
      let lastTime = 0;
      tm.subscribe((currentTime) => { lastTime = currentTime; });

      mock.tick(10);
      mock.tick(20);

      expect(lastTime).toBeCloseTo(30, 5);
    });

    it('does not notify when paused', () => {
      const calls: number[] = [];
      tm.subscribe((_, delta) => calls.push(delta));

      tm.pause();
      mock.tick(16);

      expect(calls).toHaveLength(0);
    });

    it('resumes correctly after pause', () => {
      let lastTime = 0;
      tm.subscribe((t) => { lastTime = t; });

      mock.tick(10);
      tm.pause();
      mock.tick(100);
      tm.resume();
      mock.tick(5);

      expect(lastTime).toBeCloseTo(15, 5);
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

    it('produces consistent accumulated time regardless of step size', () => {
      // Run 1: one large 100ms tick
      const mock1 = makeMockApp();
      const tm1 = new TimeManager(mock1.app);
      let time1 = 0;
      tm1.subscribe((t) => { time1 = t; });
      mock1.tick(100);

      // Run 2: many small 1ms ticks totalling 100ms
      const mock2 = makeMockApp();
      const tm2 = new TimeManager(mock2.app);
      let time2 = 0;
      tm2.subscribe((t) => { time2 = t; });
      for (let i = 0; i < 100; i++) {
        mock2.tick(1);
      }

      expect(time1).toBeCloseTo(time2, 3);

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
