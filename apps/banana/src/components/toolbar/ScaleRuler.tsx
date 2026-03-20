import { useEffect, useRef, useState } from 'react';

import { useBananaApp } from '@/contexts/pixi';

/**
 * Picks a "nice" round distance for the ruler bar so that the bar width
 * stays roughly between 60–160 px on screen.
 */
const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

function pickNiceDistance(zoomLevel: number): { distance: number; pixels: number } {
    const targetMinPx = 60;
    const targetMaxPx = 160;

    for (const d of NICE_STEPS) {
        const px = d * zoomLevel;
        if (px >= targetMinPx && px <= targetMaxPx) {
            return { distance: d, pixels: px };
        }
    }
    // Fallback: closest to target range
    const mid = (targetMinPx + targetMaxPx) / 2;
    let best = NICE_STEPS[0];
    let bestDiff = Math.abs(NICE_STEPS[0] * zoomLevel - mid);
    for (const d of NICE_STEPS) {
        const diff = Math.abs(d * zoomLevel - mid);
        if (diff < bestDiff) {
            best = d;
            bestDiff = diff;
        }
    }
    return { distance: best, pixels: best * zoomLevel };
}

function formatDistance(meters: number): string {
    if (meters >= 1000) {
        return `${meters / 1000} km`;
    }
    return `${meters} m`;
}

export function ScaleRuler() {
    const app = useBananaApp();
    const [zoom, setZoom] = useState(1);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (!app) return;
        const tick = () => {
            setZoom(app.camera.zoomLevel);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [app]);

    const { distance, pixels } = pickNiceDistance(zoom);

    return (
        <div className="flex select-none items-center gap-2">
            {/* Ruler bar */}
            <div className="flex flex-col items-center">
                <div
                    className="border-muted-foreground relative h-2 border-x border-b"
                    style={{ width: pixels }}
                />
                <span className="text-muted-foreground mt-0.5 text-[10px] tabular-nums">
                    {formatDistance(distance)}
                </span>
            </div>
        </div>
    );
}
