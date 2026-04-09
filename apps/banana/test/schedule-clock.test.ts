import { ScheduleClock, MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY, MS_PER_WEEK } from '../src/timetable/schedule-clock';
import { DayOfWeek } from '../src/timetable/types';

/**
 * Helper: build an epoch-ms value for a known UTC day-of-week and time.
 *
 * 1970-01-05 is the first Monday after the epoch (epoch 0 = Thursday).
 */
function mondayEpoch(dayOffset: DayOfWeek, hours: number, minutes: number, seconds: number): number {
  // 1970-01-05 00:00:00 UTC is Monday
  const FIRST_MONDAY = 4 * MS_PER_DAY; // 4 days after epoch 0 (Thu)
  return FIRST_MONDAY + dayOffset * MS_PER_DAY + hours * MS_PER_HOUR + minutes * MS_PER_MINUTE + seconds * MS_PER_SECOND;
}

describe('ScheduleClock', () => {
  // -----------------------------------------------------------------------
  // toWeekMs
  // -----------------------------------------------------------------------

  describe('toWeekMs', () => {
    it('returns Monday 06:00 for an epoch timestamp at Monday 06:00 UTC', () => {
      const clock = new ScheduleClock();
      const epoch = mondayEpoch(DayOfWeek.Monday, 6, 0, 0);
      expect(clock.toWeekMs(epoch)).toBe(6 * MS_PER_HOUR);
    });

    it('returns correct weekMs for a Monday 00:00 epoch', () => {
      const clock = new ScheduleClock();
      const epoch = mondayEpoch(DayOfWeek.Monday, 0, 0, 0);
      expect(clock.toWeekMs(epoch)).toBe(0);
    });

    it('wraps around at the end of the week', () => {
      const clock = new ScheduleClock();
      // Sunday 23:59:59 + 2 seconds → Monday 00:00:01
      const epoch = mondayEpoch(DayOfWeek.Sunday, 23, 59, 59) + 2 * MS_PER_SECOND;
      expect(clock.toWeekMs(epoch)).toBe(1 * MS_PER_SECOND);
    });

    it('handles multiple week wraps', () => {
      const clock = new ScheduleClock();
      const epoch = mondayEpoch(DayOfWeek.Monday, 0, 0, 0) + 2 * MS_PER_WEEK + MS_PER_HOUR;
      expect(clock.toWeekMs(epoch)).toBe(MS_PER_HOUR);
    });

    it('computes correctly for mid-week timestamp', () => {
      const clock = new ScheduleClock();
      // Wednesday 14:30:00
      const epoch = mondayEpoch(DayOfWeek.Wednesday, 14, 30, 0);
      const expected = DayOfWeek.Wednesday * MS_PER_DAY + 14 * MS_PER_HOUR + 30 * MS_PER_MINUTE;
      expect(clock.toWeekMs(epoch)).toBe(expected);
    });
  });

  // -----------------------------------------------------------------------
  // toVirtualDateTime
  // -----------------------------------------------------------------------

  describe('toVirtualDateTime', () => {
    it('returns the correct day/time for a Tuesday 08:15:30 epoch', () => {
      const clock = new ScheduleClock();
      const epoch = mondayEpoch(DayOfWeek.Tuesday, 8, 15, 30);
      const vdt = clock.toVirtualDateTime(epoch);
      expect(vdt.day).toBe(DayOfWeek.Tuesday);
      expect(vdt.time).toEqual({ hours: 8, minutes: 15, seconds: 30 });
    });

    it('advances correctly within the same day', () => {
      const clock = new ScheduleClock();
      const epoch = mondayEpoch(DayOfWeek.Monday, 12, 0, 0);
      const vdt = clock.toVirtualDateTime(epoch);
      expect(vdt.day).toBe(DayOfWeek.Monday);
      expect(vdt.time.hours).toBe(12);
    });

    it('crosses day boundary correctly', () => {
      const clock = new ScheduleClock();
      // Tuesday 01:00
      const epoch = mondayEpoch(DayOfWeek.Tuesday, 1, 0, 0);
      const vdt = clock.toVirtualDateTime(epoch);
      expect(vdt.day).toBe(DayOfWeek.Tuesday);
      expect(vdt.time.hours).toBe(1);
    });

    it('wraps from Sunday to Monday', () => {
      const clock = new ScheduleClock();
      // Monday 01:00 (next week)
      const epoch = mondayEpoch(DayOfWeek.Monday, 1, 0, 0) + MS_PER_WEEK;
      const vdt = clock.toVirtualDateTime(epoch);
      expect(vdt.day).toBe(DayOfWeek.Monday);
      expect(vdt.time.hours).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Static conversions (bidirectional)
  // -----------------------------------------------------------------------

  describe('dateTimeToWeekMs / weekMsToDateTime round-trip', () => {
    const cases = [
      { day: DayOfWeek.Monday, time: { hours: 0, minutes: 0, seconds: 0 } },
      { day: DayOfWeek.Wednesday, time: { hours: 12, minutes: 30, seconds: 45 } },
      { day: DayOfWeek.Sunday, time: { hours: 23, minutes: 59, seconds: 59 } },
      { day: DayOfWeek.Friday, time: { hours: 7, minutes: 0, seconds: 0 } },
    ];

    for (const dt of cases) {
      it(`round-trips ${DayOfWeek[dt.day]} ${dt.time.hours}:${dt.time.minutes}:${dt.time.seconds}`, () => {
        const weekMs = ScheduleClock.dateTimeToWeekMs(dt);
        const back = ScheduleClock.weekMsToDateTime(weekMs);
        expect(back.day).toBe(dt.day);
        expect(back.time).toEqual(dt.time);
      });
    }
  });

  describe('dateTimeToWeekMs', () => {
    it('Monday 00:00:00 is 0', () => {
      expect(
        ScheduleClock.dateTimeToWeekMs({
          day: DayOfWeek.Monday,
          time: { hours: 0, minutes: 0, seconds: 0 },
        }),
      ).toBe(0);
    });

    it('Tuesday 00:00:00 is MS_PER_DAY', () => {
      expect(
        ScheduleClock.dateTimeToWeekMs({
          day: DayOfWeek.Tuesday,
          time: { hours: 0, minutes: 0, seconds: 0 },
        }),
      ).toBe(MS_PER_DAY);
    });
  });

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('deserialize returns a functional clock regardless of input', () => {
      const restored = ScheduleClock.deserialize({ startDay: 3, startHours: 9 });
      const epoch = mondayEpoch(DayOfWeek.Monday, 0, 0, 0);
      expect(restored.toWeekMs(epoch)).toBe(0);
    });

    it('serialize returns an empty object', () => {
      const clock = new ScheduleClock();
      const s = clock.serialize();
      expect(Object.keys(s).length).toBe(0);
    });
  });
});
