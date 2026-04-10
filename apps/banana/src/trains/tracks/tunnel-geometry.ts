import { PointCal } from '@ue-too/math';
import type { TerrainData } from '../../terrain/terrain-data';
import { TrackSegmentDrawData } from './types';
import { ballastHalfWidth } from './geometry-utils';

export type TunnelEntranceEdgePoint = { x: number; y: number };

export type TunnelEntranceGeometry = {
    leftInner: TunnelEntranceEdgePoint[];
    leftOuter: TunnelEntranceEdgePoint[];
    rightInner: TunnelEntranceEdgePoint[];
    rightOuter: TunnelEntranceEdgePoint[];
    coverEnd: 'start' | 'end';
    coverSteps: number;
    surfaceBandIndex: number;
};

/**
 * Compute the retaining-wall + cover-cap geometry for a ramped track segment
 * that transitions between above-terrain and below-terrain.
 *
 * Returns null when there is no terrain transition to build an entrance for:
 * - flat tracks (elevation.from === elevation.to)
 * - tracks fully above terrain at both endpoints
 * - tracks fully below terrain at both endpoints (handled instead by the
 *   fully-underground tunnel enclosure path)
 */
export function computeTunnelEntranceGeometry(
    drawData: TrackSegmentDrawData,
    terrainData: Pick<TerrainData, 'getHeight'> | null,
    getElevationBandIndex: (rawElevation: number) => number,
): TunnelEntranceGeometry | null {
    const { curve, elevation } = drawData;
    // Only draw on ramped tracks (not flat underground tracks).
    if (elevation.from === elevation.to) return null;

    // Sample terrain height at both ends of the track segment.
    const startPoint = curve.getPointbyPercentage(0);
    const endPoint = curve.getPointbyPercentage(1);
    const startTerrainH = terrainData?.getHeight(startPoint.x, startPoint.y) ?? 0;
    const endTerrainH = terrainData?.getHeight(endPoint.x, endPoint.y) ?? 0;

    // Compute relative elevation (track elevation minus terrain height).
    const relFrom = elevation.from - startTerrainH;
    const relTo = elevation.to - endTerrainH;

    // Need an actual above→below or below→above transition.
    if (relFrom >= 0 && relTo >= 0) return null;
    if (relFrom < 0 && relTo < 0) return null;

    const ballastHw = ballastHalfWidth(drawData);
    const hw = drawData.bed ? Math.max(ballastHw, (drawData.bedWidth ?? 3) / 2) : ballastHw;
    /** Width of each retaining wall strip in world units (meters). */
    const wallThickness = 0.4;
    /** How far the walls extend beyond the terrain crossing (meters). */
    const overshootDistance = 5;
    const overshootT = curve.fullLength > 0
        ? Math.min(0.15, overshootDistance / curve.fullLength)
        : 0;

    let tStart: number;
    let tEnd: number;
    let coverEnd: 'start' | 'end';

    if (relFrom >= 0 && relTo < 0) {
        // Track goes from above terrain into underground.
        const crossingT = relFrom / (relFrom - relTo);
        tStart = Math.max(0, crossingT - overshootT);
        tEnd = 1;
        coverEnd = 'end';
    } else {
        // relFrom < 0 && relTo >= 0: track goes from underground up to above terrain.
        const crossingT = relFrom / (relFrom - relTo);
        tStart = 0;
        tEnd = Math.min(1, crossingT + overshootT);
        coverEnd = 'start';
    }

    // Place at the terrain surface elevation band.
    const surfaceElev = Math.max(startTerrainH, endTerrainH);
    const surfaceBandIndex = getElevationBandIndex(surfaceElev);

    const steps = Math.max(4, Math.ceil(curve.fullLength / 2));
    const innerOffset = hw + 0.1;
    const outerOffset = innerOffset + wallThickness;

    const leftInner: TunnelEntranceEdgePoint[] = [];
    const leftOuter: TunnelEntranceEdgePoint[] = [];
    const rightInner: TunnelEntranceEdgePoint[] = [];
    const rightOuter: TunnelEntranceEdgePoint[] = [];

    for (let i = 0; i <= steps; i++) {
        const t = tStart + (tEnd - tStart) * (i / steps);
        const point = curve.getPointbyPercentage(t);
        const tangent = PointCal.unitVector(curve.derivativeByPercentage(t));
        const nx = -tangent.y;
        const ny = tangent.x;

        leftInner.push({ x: point.x - nx * innerOffset, y: point.y - ny * innerOffset });
        leftOuter.push({ x: point.x - nx * outerOffset, y: point.y - ny * outerOffset });
        rightInner.push({ x: point.x + nx * innerOffset, y: point.y + ny * innerOffset });
        rightOuter.push({ x: point.x + nx * outerOffset, y: point.y + ny * outerOffset });
    }

    /** How far the cover extends along the ramp from the underground end (meters). */
    const coverLength = 10;
    const coverSteps = Math.max(1, Math.round(
        (coverLength / curve.fullLength) * steps / (tEnd - tStart)
    ));

    return { leftInner, leftOuter, rightInner, rightOuter, coverEnd, coverSteps, surfaceBandIndex };
}
