import { useCallback, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { ThrottleSteps } from '@/trains/formation';

const NOTCHES: { key: ThrottleSteps; label: string; zone: 'brake' | 'neutral' | 'power' }[] = [
    { key: 'p5', label: 'P5', zone: 'power' },
    { key: 'p4', label: 'P4', zone: 'power' },
    { key: 'p3', label: 'P3', zone: 'power' },
    { key: 'p2', label: 'P2', zone: 'power' },
    { key: 'p1', label: 'P1', zone: 'power' },
    { key: 'N', label: 'N', zone: 'neutral' },
    { key: 'b1', label: 'B1', zone: 'brake' },
    { key: 'b2', label: 'B2', zone: 'brake' },
    { key: 'b3', label: 'B3', zone: 'brake' },
    { key: 'b4', label: 'B4', zone: 'brake' },
    { key: 'b5', label: 'B5', zone: 'brake' },
    { key: 'b6', label: 'B6', zone: 'brake' },
    { key: 'b7', label: 'B7', zone: 'brake' },
    { key: 'er', label: 'EB', zone: 'brake' },
];

const NOTCH_HEIGHT = 18;
const NEUTRAL_MARGIN = 3;

const ZONE_COLORS = {
    brake: {
        label: 'font-bold text-red-400',
        tick: 'bg-red-400/80',
        handle: 'border-red-500/60 bg-red-500/30',
        dot: 'bg-red-400',
    },
    neutral: {
        label: 'font-bold text-amber-300',
        tick: 'bg-amber-300/80',
        handle: 'border-amber-400/60 bg-amber-400/30',
        dot: 'bg-amber-300',
    },
    power: {
        label: 'font-bold text-emerald-400',
        tick: 'bg-emerald-400/80',
        handle: 'border-emerald-500/60 bg-emerald-500/30',
        dot: 'bg-emerald-400',
    },
} as const;

type ThrottleIndicatorProps = {
    currentStep: ThrottleSteps;
    speed: number;
    onThrottleChange: (step: ThrottleSteps) => void;
};

/** Maps a Y offset within the notch strip to the closest notch index. */
function yToNotchIndex(y: number): number {
    // Neutral (index 5) has extra margin above and below it.
    // Rows 0-4: top = i * NOTCH_HEIGHT
    // Neutral gap starts at 5 * NOTCH_HEIGHT, neutral row center at 5 * NOTCH_HEIGHT + NEUTRAL_MARGIN + NOTCH_HEIGHT/2
    // Rows 6-13: shifted by 2 * NEUTRAL_MARGIN

    const neutralTop = 5 * NOTCH_HEIGHT + NEUTRAL_MARGIN;
    const neutralBottom = neutralTop + NOTCH_HEIGHT;
    const postNeutralStart = neutralBottom + NEUTRAL_MARGIN;

    if (y < neutralTop) {
        // Power zone (indices 0–4)
        return Math.max(0, Math.min(4, Math.floor(y / NOTCH_HEIGHT)));
    }
    if (y < postNeutralStart) {
        // Neutral zone
        return 5;
    }
    // Brake zone (indices 6–13)
    const brakeIdx = 6 + Math.floor((y - postNeutralStart) / NOTCH_HEIGHT);
    return Math.max(6, Math.min(NOTCHES.length - 1, brakeIdx));
}

export function ThrottleIndicator({ currentStep, speed, onThrottleChange }: ThrottleIndicatorProps) {
    const activeIndex = NOTCHES.findIndex((n) => n.key === currentStep);
    const activeZone = NOTCHES[activeIndex]?.zone ?? 'neutral';
    const stripRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const notchFromPointer = useCallback(
        (clientY: number) => {
            const el = stripRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const y = clientY - rect.top;
            const idx = yToNotchIndex(y);
            onThrottleChange(NOTCHES[idx].key);
        },
        [onThrottleChange]
    );

    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            notchFromPointer(e.clientY);
        },
        [notchFromPointer]
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragging.current) return;
            notchFromPointer(e.clientY);
        },
        [notchFromPointer]
    );

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    return (
        <div className="flex select-none flex-col items-center gap-2">
            {/* Speed readout */}
            <div className="flex items-baseline gap-1">
                <span
                    className={cn(
                        'font-mono text-2xl leading-none tabular-nums',
                        ZONE_COLORS[activeZone].label
                    )}
                >
                    {speed.toFixed(1)}
                </span>
                <span className="text-[10px] text-neutral-500">m/s</span>
            </div>

            {/* Notch strip — interactive drag area */}
            <div
                ref={stripRef}
                className="relative flex w-full cursor-grab flex-col items-center active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
                {/* Rail groove */}
                <div className="pointer-events-none absolute top-0.5 bottom-0.5 left-[calc(50%+20px)] w-[3px] rounded-full bg-neutral-700" />

                {NOTCHES.map((notch, i) => {
                    const isActive = i === activeIndex;
                    const colors = ZONE_COLORS[notch.zone];
                    return (
                        <div
                            key={notch.key}
                            className={cn(
                                'pointer-events-none relative flex w-full items-center justify-center',
                                notch.key === 'N' && 'my-[3px]'
                            )}
                            style={{ height: NOTCH_HEIGHT }}
                        >
                            {/* Label */}
                            <span
                                className={cn(
                                    'absolute right-[calc(50%+4px)] font-mono text-[10px] leading-none',
                                    isActive ? colors.label : 'text-neutral-500'
                                )}
                            >
                                {notch.label}
                            </span>

                            {/* Tick mark */}
                            <div
                                className={cn(
                                    'absolute left-[calc(50%-4px)] h-px',
                                    isActive ? cn('w-5', colors.tick) : 'w-3 bg-neutral-600'
                                )}
                            />

                            {/* Handle indicator on the rail */}
                            {isActive && (
                                <div
                                    className={cn(
                                        'absolute left-[calc(50%+14px)] size-[15px] rounded-sm border',
                                        colors.handle
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'absolute top-1/2 left-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                                            colors.dot
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
