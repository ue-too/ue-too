import { COLOR_STOPS } from '@/terrain/terrain-colors';

/**
 * A small floating legend that maps terrain colors to elevation values.
 * Renders a vertical gradient bar with labeled height ticks.
 */
export function TerrainLegend() {
    // Gradient: bottom = lowest elevation, top = highest.
    // CSS linear-gradient "to top" paints the first color at the bottom.
    const gradientStops = COLOR_STOPS
        .map((stop, i) => {
            const pct = (i / (COLOR_STOPS.length - 1)) * 100;
            return `rgb(${stop.color.r},${stop.color.g},${stop.color.b}) ${pct}%`;
        })
        .join(', ');

    // Labels: highest elevation at top, lowest at bottom.
    const labelsTopToBottom = [...COLOR_STOPS].reverse();

    return (
        <div className="pointer-events-auto flex items-stretch gap-1.5 rounded bg-background/80 px-2 py-1.5 text-[10px] backdrop-blur-sm">
            {/* Gradient bar */}
            <div
                className="w-3 rounded-sm"
                style={{
                    background: `linear-gradient(to top, ${gradientStops})`,
                }}
            />
            {/* Labels */}
            <div className="flex flex-col justify-between text-muted-foreground">
                {labelsTopToBottom.map((stop) => (
                    <span key={stop.height} className="leading-none">
                        {stop.height >= 0 ? `+${stop.height}` : stop.height}m
                    </span>
                ))}
            </div>
        </div>
    );
}
