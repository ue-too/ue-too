import { ChevronLeft, ChevronRight, Pause, Play } from '@/assets/icons';
import { useCallback, useEffect, useState } from 'react';

import { useBananaApp } from '@/contexts/pixi';

/** Midnight of 2026-03-16 UTC. */
const START_EPOCH = Date.UTC(2026, 2, 16); // month is 0-indexed

const SPEED_STEPS = [1, 2, 5, 10, 50, 100];

/** Format an epoch-offset time (ms) into YYYY/MM/DD HH:MM:SS. */
function formatDateTime(ms: number): string {
    const date = new Date(START_EPOCH + ms);
    const y = date.getUTCFullYear();
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}/${mo}/${d} ${h}:${mi}:${s}`;
}

export function TimeDisplay() {
    const app = useBananaApp();
    const [time, setTime] = useState(0);
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState(1);

    useEffect(() => {
        if (!app) return;
        const unsubTime = app.timeManager.subscribe((currentTime) => {
            setTime(currentTime);
        });
        const unsubPause = app.timeManager.subscribePause((isPaused) => {
            setPaused(isPaused);
        });
        const unsubSpeed = app.timeManager.subscribeSpeed((s) => {
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
                {formatDateTime(time)} <span className="text-[10px]">x{speed}</span>
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
