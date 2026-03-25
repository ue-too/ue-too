import { ChevronLeft, ChevronRight, Pause, Play } from '@/assets/icons';
import { useCallback, useEffect, useState } from 'react';

import { useBananaApp } from '@/contexts/pixi';
import { DayOfWeek } from '@/timetable/types';

const SPEED_STEPS = [1, 2, 5, 10, 50, 100];

/** Base Monday date for the virtual calendar. */
const BASE_MONDAY = Date.UTC(2026, 2, 16); // 2026-03-16 is a Monday

const DAY_NAMES: Record<DayOfWeek, string> = {
    [DayOfWeek.Monday]: 'Mon',
    [DayOfWeek.Tuesday]: 'Tue',
    [DayOfWeek.Wednesday]: 'Wed',
    [DayOfWeek.Thursday]: 'Thu',
    [DayOfWeek.Friday]: 'Fri',
    [DayOfWeek.Saturday]: 'Sat',
    [DayOfWeek.Sunday]: 'Sun',
};

/** Format elapsed ms into the virtual schedule clock time with date. */
function formatScheduleTime(
    elapsedMs: number,
    toVirtualDateTime: (ms: number) => { day: DayOfWeek; time: { hours: number; minutes: number; seconds: number } },
    epochOffsetMs: number,
): string {
    const vdt = toVirtualDateTime(elapsedMs);
    const day = DAY_NAMES[vdt.day] ?? '???';

    // Compute a calendar date by adding elapsed + epoch offset to the base Monday
    const totalMs = epochOffsetMs + elapsedMs;
    const date = new Date(BASE_MONDAY + totalMs);
    const y = date.getUTCFullYear();
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');

    const h = String(vdt.time.hours).padStart(2, '0');
    const mi = String(vdt.time.minutes).padStart(2, '0');
    const s = String(vdt.time.seconds).padStart(2, '0');
    return `${y}/${mo}/${d} ${day} ${h}:${mi}:${s}`;
}

export function TimeDisplay() {
    const app = useBananaApp();
    const [time, setTime] = useState(0);
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState(1);

    useEffect(() => {
        if (!app) return;
        const unsubTime = app.timeManager.subscribe((currentTime: number) => {
            setTime(currentTime);
        });
        const unsubPause = app.timeManager.subscribePause((isPaused: boolean) => {
            setPaused(isPaused);
        });
        const unsubSpeed = app.timeManager.subscribeSpeed((s: number) => {
            setSpeed(s);
        });
        setPaused(app.timeManager.paused);
        setSpeed(app.timeManager.speed);
        return () => { unsubTime(); unsubPause(); unsubSpeed(); };
    }, [app]);

    const togglePause = useCallback(() => {
        if (!app) return;
        if (app.timeManager.paused) {
            app.timeManager.resume();
        } else {
            app.timeManager.pause();
        }
    }, [app]);

    const slower = useCallback(() => {
        if (!app) return;
        const idx = SPEED_STEPS.indexOf(app.timeManager.speed);
        if (idx > 0) app.timeManager.setSpeed(SPEED_STEPS[idx - 1]);
    }, [app]);

    const faster = useCallback(() => {
        if (!app) return;
        const idx = SPEED_STEPS.indexOf(app.timeManager.speed);
        if (idx < SPEED_STEPS.length - 1) app.timeManager.setSpeed(SPEED_STEPS[idx + 1]);
    }, [app]);

    return (
        <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-1">
            <button
                onClick={slower}
                disabled={speed === SPEED_STEPS[0]}
                className="bg-background/60 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded p-1 backdrop-blur-sm transition-colors"
            >
                <ChevronLeft size={14} />
            </button>
            <span className="text-muted-foreground bg-background/60 rounded px-2 py-1 text-xs font-mono backdrop-blur-sm">
                {app ? formatScheduleTime(time, (ms) => app.scheduleClock.toVirtualDateTime(ms), app.scheduleClock.epochOffsetMs) : '--'} <span className="text-[10px]">x{speed}</span>
            </span>
            <button
                onClick={faster}
                disabled={speed === SPEED_STEPS[SPEED_STEPS.length - 1]}
                className="bg-background/60 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded p-1 backdrop-blur-sm transition-colors"
            >
                <ChevronRight size={14} />
            </button>
            <button
                onClick={togglePause}
                className="bg-background/60 text-muted-foreground hover:text-foreground rounded p-1 backdrop-blur-sm transition-colors"
            >
                {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
        </div>
    );
}
