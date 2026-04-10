export type TrackWidthSource = { bedWidth?: number; gauge: number };

/**
 * Distance between the centerlines of two parallel tracks whose beds (or
 * gauges, if bedWidth is absent) are flush against each other. Matches the
 * snap formula in trackcurve-manager.ts around the `maxSnapDistance` math.
 */
export function computeParallelSpacing(
    a: TrackWidthSource,
    b: TrackWidthSource,
): number {
    const widthA = a.bedWidth ?? a.gauge;
    const widthB = b.bedWidth ?? b.gauge;
    return widthA / 2 + widthB / 2;
}
