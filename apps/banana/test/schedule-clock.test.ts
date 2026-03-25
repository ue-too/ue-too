import { ScheduleClock, MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY, MS_PER_WEEK } from '../src/timetable/schedule-clock';
import { DayOfWeek } from '../src/timetable/types';

describe('ScheduleClock', () => {
  // -----------------------------------------------------------------------
  // toWeekMs
  // -----------------------------------------------------------------------

  describe('toWeekMs', () => {
    it('returns the epoch offset when elapsed is 0', () => {
      const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 6, minutes: 0, seconds: 0 });
      expect(clock.toWeekMs(0)).toBe(6 * MS_PER_HOUR);
    });

    it('adds elapsed time to the epoch offset', () => {
      const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 0, minutes: 0, seconds: 0 });
      expect(clock.toWeekMs(5000)).toBe(5000);
    });

    it('wraps around at the end of the week', () => {
      // Start at Sunday 23:59:59
      const clock = new ScheduleClock(DayOfWeek.Sunday, { hours: 23, minutes: 59, seconds: 59 });
      // After 2 seconds, should wrap to Monday 00:00:01
      expect(clock.toWeekMs(2 * MS_PER_SECOND)).toBe(1 * MS_PER_SECOND);
    });

    it('handles multiple week wraps', () => {
      const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 0, minutes: 0, seconds: 0 });
      // 2 full weeks + 1 hour
      const elapsed = 2 * MS_PER_WEEK + MS_PER_HOUR;
      expect(clock.toWeekMs(elapsed)).toBe(MS_PER_HOUR);
    });

    it('combines day and time correctly for mid-week start', () => {
      // Wednesday 14:30:00
      const clock = new ScheduleClock(DayOfWeek.Wednesday, { hours: 14, minutes: 30, seconds: 0 });
      const expected = DayOfWeek.Wednesday * MS_PER_DAY + 14 * MS_PER_HOUR + 30 * MS_PER_MINUTE;
      expect(clock.toWeekMs(0)).toBe(expected);
    });
  });

  // -----------------------------------------------------------------------
  // toVirtualDateTime
  // -----------------------------------------------------------------------

  describe('toVirtualDateTime', () => {
    it('returns the start day/time when elapsed is 0', () => {
      const clock = new ScheduleClock(DayOfWeek.Tuesday, { hours: 8, minutes: 15, seconds: 30 });
      const vdt = clock.toVirtualDateTime(0);
      expect(vdt.day).toBe(DayOfWeek.Tuesday);
      expect(vdt.time).toEqual({ hours: 8, minutes: 15, seconds: 30 });
    });

    it('advances correctly within the same day', () => {
      const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 10, minutes: 0, seconds: 0 });
      // 2 hours later
      const vdt = clock.toVirtualDateTime(2 * MS_PER_HOUR);
      expect(vdt.day).toBe(DayOfWeek.Monday);
      expect(vdt.time.hours).toBe(12);
    });

    it('crosses day boundary correctly', () => {
      const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 23, minutes: 0, seconds: 0 });
      // 2 hours later → Tuesday 01:00
      const vdt = clock.toVirtualDateTime(2 * MS_PER_HOUR);
      expect(vdt.day).toBe(DayOfWeek.Tuesday);
      expect(vdt.time.hours).toBe(1);
    });

    it('wraps from Sunday to Monday', () => {
      const clock = new ScheduleClock(DayOfWeek.Sunday, { hours: 23, minutes: 0, seconds: 0 });
      // 2 hours later → Monday 01:00
      const vdt = clock.toVirtualDateTime(2 * MS_PER_HOUR);
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
  // epochOffsetMs
  // -----------------------------------------------------------------------

  describe('epochOffsetMs', () => {
    it('is 0 for Monday 00:00:00', () => {
      const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 0, minutes: 0, seconds: 0 });
      expect(clock.epochOffsetMs).toBe(0);
    });

    it('includes full day+time calculation', () => {
      const clock = new ScheduleClock(DayOfWeek.Friday, { hours: 18, minutes: 30, seconds: 0 });
      const expected = DayOfWeek.Friday * MS_PER_DAY + 18 * MS_PER_HOUR + 30 * MS_PER_MINUTE;
      expect(clock.epochOffsetMs).toBe(expected);
    });
  });

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('round-trips correctly', () => {
      const original = new ScheduleClock(DayOfWeek.Thursday, { hours: 9, minutes: 45, seconds: 10 });
      const serialized = original.serialize();
      const restored = ScheduleClock.deserialize(serialized);

      expect(restored.epochOffsetMs).toBe(original.epochOffsetMs);
      expect(restored.toWeekMs(0)).toBe(original.toWeekMs(0));
      expect(restored.toWeekMs(123456)).toBe(original.toWeekMs(123456));
    });

    it('serialized format has the expected fields', () => {
      const clock = new ScheduleClock(DayOfWeek.Wednesday, { hours: 14, minutes: 30, seconds: 0 });
      const s = clock.serialize();
      expect(s.startDay).toBe(DayOfWeek.Wednesday);
      expect(s.startHours).toBe(14);
      expect(s.startMinutes).toBe(30);
      expect(s.startSeconds).toBe(0);
    });
  });
});
