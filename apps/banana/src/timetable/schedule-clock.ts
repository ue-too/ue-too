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
  type VirtualDateTime,
  type WeekMs,
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

/**
 * Epoch 0 (1970-01-01) is a Thursday.  DayOfWeek.Thursday === 3, so shifting
 * by 3 days aligns the epoch with Monday 00:00 in the virtual week.
 */
const EPOCH_THURSDAY_OFFSET = 3 * MS_PER_DAY;

// ---------------------------------------------------------------------------
// ScheduleClock
// ---------------------------------------------------------------------------

/**
 * Converts epoch-based simulation time into a virtual weekly clock.
 *
 * @remarks
 * `ScheduleClock` is a stateless conversion utility.  {@link TimeManager}
 * tracks the current time as epoch milliseconds; this class maps that value
 * to a position within a 7-day virtual week.
 *
 * @example
 * ```typescript
 * const clock = new ScheduleClock();
 * const vdt = clock.toVirtualDateTime(Date.now());
 * ```
 */
export class ScheduleClock {
  /**
   * Convert epoch milliseconds to a position within the virtual week
   * (wraps every 7 days).
   *
   * @param epochMs - Current value of `TimeManager._currentTime` (epoch ms).
   * @returns Milliseconds since Monday 00:00:00 in the virtual week.
   */
  toWeekMs(epochMs: number): WeekMs {
    return ((epochMs + EPOCH_THURSDAY_OFFSET) % MS_PER_WEEK + MS_PER_WEEK) % MS_PER_WEEK;
  }

  /**
   * Convert epoch milliseconds to a full virtual datetime.
   *
   * @param epochMs - Current value of `TimeManager._currentTime` (epoch ms).
   */
  toVirtualDateTime(epochMs: number): VirtualDateTime {
    const weekMs = this.toWeekMs(epochMs);
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

  /** Serialize is a no-op — the clock is stateless. Kept for format compat. */
  serialize(): Record<string, never> {
    return {};
  }

  /** Deserialize ignores saved data — the clock is stateless. */
  static deserialize(_data: unknown): ScheduleClock {
    return new ScheduleClock();
  }
}
