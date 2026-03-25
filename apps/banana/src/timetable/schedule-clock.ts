/**
 * Maps elapsed simulation milliseconds to a virtual day-of-week + time-of-day.
 *
 * @remarks
 * `ScheduleClock` is a pure conversion utility — it holds no subscriptions and
 * mutates no external state.  Call {@link toWeekMs} or {@link toVirtualDateTime}
 * on demand with the current elapsed time from {@link TimeManager}.
 *
 * @module timetable/schedule-clock
 */

import {
  DayOfWeek,
  type TimeOfDay,
  type VirtualDateTime,
  type WeekMs,
  type SerializedScheduleClock,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @group Time constants */
export const MS_PER_SECOND = 1_000;
/** @group Time constants */
export const MS_PER_MINUTE = 60_000;
/** @group Time constants */
export const MS_PER_HOUR = 3_600_000;
/** @group Time constants */
export const MS_PER_DAY = 86_400_000;
/** @group Time constants */
export const MS_PER_WEEK = 604_800_000;

// ---------------------------------------------------------------------------
// ScheduleClock
// ---------------------------------------------------------------------------

/**
 * Converts elapsed simulation time into a virtual weekly clock.
 *
 * @example
 * ```typescript
 * const clock = new ScheduleClock(DayOfWeek.Monday, { hours: 6, minutes: 0, seconds: 0 });
 * // When TimeManager reports 0 ms elapsed, virtual time is Monday 06:00:00.
 * const vdt = clock.toVirtualDateTime(0);
 * // vdt.day === DayOfWeek.Monday, vdt.time === { hours: 6, minutes: 0, seconds: 0 }
 * ```
 */
export class ScheduleClock {
  /**
   * Offset in milliseconds from Monday 00:00:00 that corresponds to
   * `elapsedMs === 0` (i.e. the moment the simulation starts).
   */
  private _epochOffsetMs: number;

  /**
   * @param startDay - The virtual day when the simulation begins.
   * @param startTime - The virtual time of day when the simulation begins.
   */
  constructor(startDay: DayOfWeek, startTime: TimeOfDay) {
    this._epochOffsetMs =
      startDay * MS_PER_DAY +
      startTime.hours * MS_PER_HOUR +
      startTime.minutes * MS_PER_MINUTE +
      startTime.seconds * MS_PER_SECOND;
  }

  /** The epoch offset in milliseconds (from Monday 00:00:00). */
  get epochOffsetMs(): number {
    return this._epochOffsetMs;
  }

  /**
   * Convert elapsed simulation milliseconds to a position within the virtual
   * week (wraps every 7 days).
   *
   * @param elapsedMs - Current value of `TimeManager._currentTime`.
   * @returns Milliseconds since Monday 00:00:00 in the virtual week.
   */
  toWeekMs(elapsedMs: number): WeekMs {
    // Modulo handles week wrap-around.  Adding a full week before modulo
    // guards against negative elapsed values (shouldn't happen, but safe).
    return ((this._epochOffsetMs + elapsedMs) % MS_PER_WEEK + MS_PER_WEEK) % MS_PER_WEEK;
  }

  /**
   * Convert elapsed simulation milliseconds to a full virtual datetime.
   *
   * @param elapsedMs - Current value of `TimeManager._currentTime`.
   */
  toVirtualDateTime(elapsedMs: number): VirtualDateTime {
    const weekMs = this.toWeekMs(elapsedMs);
    return ScheduleClock.weekMsToDateTime(weekMs);
  }

  /**
   * Convert a {@link VirtualDateTime} to its {@link WeekMs} representation.
   *
   * @remarks
   * Useful for comparing schedule times against the current virtual clock.
   */
  static dateTimeToWeekMs(dt: VirtualDateTime): WeekMs {
    return (
      dt.day * MS_PER_DAY +
      dt.time.hours * MS_PER_HOUR +
      dt.time.minutes * MS_PER_MINUTE +
      dt.time.seconds * MS_PER_SECOND
    );
  }

  /**
   * Convert a {@link WeekMs} value back to a {@link VirtualDateTime}.
   */
  static weekMsToDateTime(weekMs: WeekMs): VirtualDateTime {
    let remaining = weekMs;
    const day = Math.floor(remaining / MS_PER_DAY) as DayOfWeek;
    remaining -= day * MS_PER_DAY;
    const hours = Math.floor(remaining / MS_PER_HOUR);
    remaining -= hours * MS_PER_HOUR;
    const minutes = Math.floor(remaining / MS_PER_MINUTE);
    remaining -= minutes * MS_PER_MINUTE;
    const seconds = Math.floor(remaining / MS_PER_SECOND);
    return { day, time: { hours, minutes, seconds } };
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  serialize(): SerializedScheduleClock {
    const dt = ScheduleClock.weekMsToDateTime(this._epochOffsetMs);
    return {
      startDay: dt.day,
      startHours: dt.time.hours,
      startMinutes: dt.time.minutes,
      startSeconds: dt.time.seconds,
    };
  }

  static deserialize(data: SerializedScheduleClock): ScheduleClock {
    return new ScheduleClock(data.startDay as DayOfWeek, {
      hours: data.startHours,
      minutes: data.startMinutes,
      seconds: data.startSeconds,
    });
  }
}
