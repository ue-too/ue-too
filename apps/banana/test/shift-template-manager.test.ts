import {
  ShiftTemplateManager,
  weekdaysMask,
  everydayMask,
  type ShiftTemplateChangeEvent,
} from '../src/timetable/shift-template-manager';
import { DayOfWeek, type ShiftTemplate, type ScheduledStop, type ShiftLeg } from '../src/timetable/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStop(overrides: Partial<ScheduledStop> = {}): ScheduledStop {
  return {
    stationId: 1,
    platformKind: 'island',
    platformId: 1,
    stopPositionIndex: 0,
    arrivalTime: null,
    departureTime: null,
    ...overrides,
  };
}

function makeLeg(routeId: string = 'route-1'): ShiftLeg {
  return { routeId };
}

/** Create a valid 2-stop shift template with 1 leg. */
function makeTemplate(id: string = 'shift-1'): ShiftTemplate {
  return {
    id,
    name: `Shift ${id}`,
    activeDays: weekdaysMask(),
    stops: [
      makeStop({ departureTime: 1000 }),
      makeStop({ arrivalTime: 5000 }),
    ],
    legs: [makeLeg()],
  };
}

/** Create a 3-stop / 2-leg template. */
function makeThreeStopTemplate(id: string = 'shift-3s'): ShiftTemplate {
  return {
    id,
    name: 'Three Stop',
    activeDays: everydayMask(),
    stops: [
      makeStop({ departureTime: 1000 }),
      makeStop({ arrivalTime: 3000, departureTime: 4000 }),
      makeStop({ arrivalTime: 7000 }),
    ],
    legs: [makeLeg('r1'), makeLeg('r2')],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShiftTemplateManager', () => {
  let mgr: ShiftTemplateManager;

  beforeEach(() => {
    mgr = new ShiftTemplateManager();
  });

  // -- CRUD ---------------------------------------------------------------

  describe('addTemplate', () => {
    it('adds and retrieves a template', () => {
      const t = makeTemplate();
      mgr.addTemplate(t);
      expect(mgr.getTemplate(t.id)).toBe(t);
    });

    it('throws on duplicate id', () => {
      mgr.addTemplate(makeTemplate('dup'));
      expect(() => mgr.addTemplate(makeTemplate('dup'))).toThrow(/already exists/);
    });

    it('throws when stops/legs invariant is violated (too few stops)', () => {
      const bad: ShiftTemplate = {
        id: 'bad',
        name: 'Bad',
        activeDays: weekdaysMask(),
        stops: [makeStop()],
        legs: [makeLeg(), makeLeg()],
      };
      expect(() => mgr.addTemplate(bad)).toThrow(/stops\.length/);
    });

    it('throws when stops/legs invariant is violated (too many stops)', () => {
      const bad: ShiftTemplate = {
        id: 'bad',
        name: 'Bad',
        activeDays: weekdaysMask(),
        stops: [makeStop(), makeStop(), makeStop()],
        legs: [makeLeg()],
      };
      expect(() => mgr.addTemplate(bad)).toThrow(/stops\.length/);
    });
  });

  describe('updateTemplate', () => {
    it('replaces an existing template', () => {
      mgr.addTemplate(makeTemplate('u'));
      const updated = { ...makeTemplate('u'), name: 'Updated' };
      mgr.updateTemplate(updated);
      expect(mgr.getTemplate('u')!.name).toBe('Updated');
    });

    it('throws when updating a non-existent template', () => {
      expect(() => mgr.updateTemplate(makeTemplate('nope'))).toThrow(/does not exist/);
    });

    it('validates invariant on update', () => {
      mgr.addTemplate(makeTemplate('v'));
      const bad: ShiftTemplate = {
        id: 'v',
        name: 'Bad Update',
        activeDays: weekdaysMask(),
        stops: [makeStop()],
        legs: [],
      };
      // stops=1, legs=0 → stops.length (1) should equal legs.length + 1 (1) — this is valid
      expect(() => mgr.updateTemplate(bad)).not.toThrow();

      const bad2: ShiftTemplate = {
        id: 'v',
        name: 'Bad Update 2',
        activeDays: weekdaysMask(),
        stops: [makeStop(), makeStop()],
        legs: [],
      };
      expect(() => mgr.updateTemplate(bad2)).toThrow(/stops\.length/);
    });
  });

  describe('removeTemplate', () => {
    it('removes an existing template', () => {
      mgr.addTemplate(makeTemplate('rm'));
      expect(mgr.removeTemplate('rm')).toBe(true);
      expect(mgr.getTemplate('rm')).toBeNull();
    });

    it('returns false for non-existent template', () => {
      expect(mgr.removeTemplate('nope')).toBe(false);
    });
  });

  describe('getAllTemplates', () => {
    it('returns all added templates', () => {
      mgr.addTemplate(makeTemplate('a'));
      mgr.addTemplate(makeTemplate('b'));
      mgr.addTemplate(makeTemplate('c'));
      expect(mgr.getAllTemplates()).toHaveLength(3);
    });

    it('returns a copy (not the internal map values iterator)', () => {
      mgr.addTemplate(makeTemplate('a'));
      const all1 = mgr.getAllTemplates();
      mgr.addTemplate(makeTemplate('b'));
      const all2 = mgr.getAllTemplates();
      expect(all1).toHaveLength(1);
      expect(all2).toHaveLength(2);
    });
  });

  // -- Observable ---------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on add', () => {
      const events: ShiftTemplateChangeEvent[] = [];
      mgr.subscribe((e) => events.push(e));
      mgr.addTemplate(makeTemplate('x'));
      expect(events).toEqual([{ type: 'add', shiftTemplateId: 'x' }]);
    });

    it('notifies on update', () => {
      mgr.addTemplate(makeTemplate('x'));
      const events: ShiftTemplateChangeEvent[] = [];
      mgr.subscribe((e) => events.push(e));
      mgr.updateTemplate({ ...makeTemplate('x'), name: 'Changed' });
      expect(events).toEqual([{ type: 'update', shiftTemplateId: 'x' }]);
    });

    it('notifies on remove', () => {
      mgr.addTemplate(makeTemplate('x'));
      const events: ShiftTemplateChangeEvent[] = [];
      mgr.subscribe((e) => events.push(e));
      mgr.removeTemplate('x');
      expect(events).toEqual([{ type: 'remove', shiftTemplateId: 'x' }]);
    });

    it('does not notify on failed remove', () => {
      const events: ShiftTemplateChangeEvent[] = [];
      mgr.subscribe((e) => events.push(e));
      mgr.removeTemplate('nonexistent');
      expect(events).toHaveLength(0);
    });

    it('unsubscribe stops notifications', () => {
      const events: ShiftTemplateChangeEvent[] = [];
      const unsub = mgr.subscribe((e) => events.push(e));
      mgr.addTemplate(makeTemplate('a'));
      unsub();
      mgr.addTemplate(makeTemplate('b'));
      expect(events).toHaveLength(1);
    });
  });

  // -- Serialization ------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('round-trips a single template', () => {
      const t = makeTemplate('s');
      mgr.addTemplate(t);
      const serialized = mgr.serialize();
      const restored = ShiftTemplateManager.deserialize(serialized);
      const rt = restored.getTemplate('s');
      expect(rt).not.toBeNull();
      expect(rt!.name).toBe(t.name);
      expect(rt!.stops).toEqual(t.stops);
      expect(rt!.legs).toEqual(t.legs);
    });

    it('round-trips activeDays correctly through string key conversion', () => {
      const t = makeTemplate('days');
      t.activeDays = {
        [DayOfWeek.Monday]: true,
        [DayOfWeek.Tuesday]: false,
        [DayOfWeek.Wednesday]: true,
        [DayOfWeek.Thursday]: false,
        [DayOfWeek.Friday]: true,
        [DayOfWeek.Saturday]: false,
        [DayOfWeek.Sunday]: true,
      };
      mgr.addTemplate(t);
      const serialized = mgr.serialize();
      const restored = ShiftTemplateManager.deserialize(serialized);
      const rt = restored.getTemplate('days')!;
      expect(rt.activeDays[DayOfWeek.Monday]).toBe(true);
      expect(rt.activeDays[DayOfWeek.Tuesday]).toBe(false);
      expect(rt.activeDays[DayOfWeek.Wednesday]).toBe(true);
      expect(rt.activeDays[DayOfWeek.Sunday]).toBe(true);
    });

    it('round-trips multiple templates', () => {
      mgr.addTemplate(makeTemplate('a'));
      mgr.addTemplate(makeThreeStopTemplate('b'));
      const restored = ShiftTemplateManager.deserialize(mgr.serialize());
      expect(restored.getAllTemplates()).toHaveLength(2);
      expect(restored.getTemplate('b')!.stops).toHaveLength(3);
      expect(restored.getTemplate('b')!.legs).toHaveLength(2);
    });
  });

  // -- Mask helpers -------------------------------------------------------

  describe('weekdaysMask', () => {
    it('has Mon-Fri true and Sat-Sun false', () => {
      const mask = weekdaysMask();
      expect(mask[DayOfWeek.Monday]).toBe(true);
      expect(mask[DayOfWeek.Friday]).toBe(true);
      expect(mask[DayOfWeek.Saturday]).toBe(false);
      expect(mask[DayOfWeek.Sunday]).toBe(false);
    });
  });

  describe('everydayMask', () => {
    it('has all days true', () => {
      const mask = everydayMask();
      for (let d = DayOfWeek.Monday; d <= DayOfWeek.Sunday; d++) {
        expect(mask[d as DayOfWeek]).toBe(true);
      }
    });
  });
});
