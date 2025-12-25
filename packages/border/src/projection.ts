import { Point } from "@ue-too/math";

/**
 * Geographic coordinate representing a location on Earth's surface.
 *
 * @remarks
 * Coordinates use the WGS84 standard:
 * - Latitude: -90 to 90 degrees (negative = south, positive = north)
 * - Longitude: -180 to 180 degrees (negative = west, positive = east)
 *
 * @category Core Types
 */
export type GeoCoord = {
    /** Longitude in degrees (-180 to 180) */
    longitude: number;
    /** Latitude in degrees (-90 to 90) */
    latitude: number;
}

/**
 * Projects a geographic coordinate to Mercator projection.
 *
 * @remarks
 * The Mercator projection is a cylindrical map projection that preserves angles
 * and shapes locally. It's widely used for navigation because straight lines on
 * the map represent constant bearings (rhumb lines).
 *
 * The projection uses Earth's mean radius of 6,371,000 meters.
 *
 * Note: The Mercator projection becomes increasingly distorted near the poles.
 *
 * @param interestPoint - The geographic coordinate to project
 * @param centerLongitude - The central meridian in degrees (default: 0)
 * @returns The projected point in meters from the central meridian
 *
 * @example
 * ```typescript
 * const coord = { latitude: 51.5074, longitude: -0.1278 }; // London
 * const point = mercatorProjection(coord);
 * console.log(point); // { x: -14232.4, y: 6711665.7 }
 *
 * // With custom center longitude
 * const pointCentered = mercatorProjection(coord, -0.1278);
 * console.log(pointCentered.x); // Close to 0
 * ```
 *
 * @category Projections
 */
export function mercatorProjection(interestPoint: GeoCoord, centerLongitude: number = 0): Point{
    const r = 6371000;
    const latitude = interestPoint.latitude * Math.PI / 180;
    const longitude = interestPoint.longitude * Math.PI / 180;
    let x = r * normalizeAngleMinusPiToPi(longitude - centerLongitude * Math.PI / 180);
    let y = r * Math.log(Math.tan(Math.PI / 4 + latitude / 2));
    return {x: x, y: y};
}

/**
 * Converts a Mercator projection point back to geographic coordinates.
 *
 * @remarks
 * This is the inverse of {@link mercatorProjection}. Given a point in Mercator
 * projection space (in meters), it returns the corresponding latitude/longitude.
 *
 * @param point - The point in Mercator projection (in meters)
 * @param centerLongitude - The central meridian in degrees (must match the forward projection)
 * @returns The geographic coordinate
 *
 * @example
 * ```typescript
 * const point = { x: -14232.4, y: 6711665.7 };
 * const coord = inverseMercatorProjection(point);
 * console.log(coord); // { latitude: ~51.5, longitude: ~-0.13 }
 * ```
 *
 * @category Projections
 */
export function inverseMercatorProjection(point: Point, centerLongitude: number = 0): GeoCoord{
    const r = 6371000;
    const longitude = point.x / r + centerLongitude;
    const latitude = 2 * Math.atan(Math.exp(point.y / r)) - Math.PI / 2;
    return {latitude: latitude * 180 / Math.PI, longitude: longitude * 180 / Math.PI};
}

/**
 * Projects a geographic coordinate to orthographic projection.
 *
 * @remarks
 * The orthographic projection shows Earth as it would appear from space,
 * displaying one hemisphere at a time. It's useful for globe-like visualizations.
 *
 * Points on the back hemisphere (not visible from the origin viewpoint) are
 * marked as clipped.
 *
 * The projection uses Earth's mean radius of 6,371,000 meters.
 *
 * @param interestPoint - The geographic coordinate to project
 * @param origin - The center point of the hemisphere to view
 * @returns Object with clipped flag and projected coordinate
 *
 * @example
 * ```typescript
 * const origin = { latitude: 45.0, longitude: 0.0 }; // View centered on France
 * const coord = { latitude: 51.5, longitude: -0.1 }; // London
 *
 * const result = orthoProjection(coord, origin);
 * if (!result.clipped) {
 *   console.log('London is visible at:', result.coord);
 * } else {
 *   console.log('London is on the back of the globe');
 * }
 * ```
 *
 * @category Projections
 */
export function orthoProjection(interestPoint: GeoCoord, origin: GeoCoord): {clipped: boolean, coord: Point}{
    const r = 6371000;
    const latitude = interestPoint.latitude * Math.PI / 180;
    const longitude = interestPoint.longitude * Math.PI / 180;
    const x = r * Math.cos(latitude) * Math.sin(longitude - origin.longitude * Math.PI / 180);
    const y = r * (Math.cos(origin.latitude * Math.PI / 180) * Math.sin(latitude) - Math.sin(origin.latitude * Math.PI / 180) * Math.cos(latitude) * Math.cos(longitude - origin.longitude * Math.PI / 180));
    const clipped = Math.sin(origin.latitude * Math.PI / 180) * Math.sin(latitude) + Math.cos(origin.latitude * Math.PI / 180) * Math.cos(latitude) * Math.cos(longitude - origin.longitude * Math.PI / 180);

    return {clipped: clipped < 0, coord: {x: x, y: y}};
}

/**
 * Converts an orthographic projection point back to geographic coordinates.
 *
 * @remarks
 * This is the inverse of {@link orthoProjection}. Given a point in orthographic
 * projection space (in meters), it returns the corresponding latitude/longitude.
 *
 * @param interestPoint - The point in orthographic projection (in meters)
 * @param origin - The center point of the hemisphere (must match the forward projection)
 * @returns The geographic coordinate
 *
 * @example
 * ```typescript
 * const origin = { latitude: 45.0, longitude: 0.0 };
 * const point = { x: 100000, y: 200000 }; // Some point in projection space
 * const coord = inverseOrthoProjection(point, origin);
 * console.log(coord); // { latitude: ..., longitude: ... }
 * ```
 *
 * @category Projections
 */
export function inverseOrthoProjection(interestPoint: Point, origin: GeoCoord): GeoCoord {
    const r = 6371000;
    const rho = Math.sqrt(interestPoint.x * interestPoint.x + interestPoint.y * interestPoint.y);
    const c = Math.asin(rho / r);
    const latitude = Math.asin(Math.cos(c) * Math.sin(origin.latitude * Math.PI / 180) + (interestPoint.y * Math.sin(c) * Math.cos(origin.latitude * Math.PI / 180)) / rho) * 180 / Math.PI;
    const longitude = origin.longitude + Math.atan2(interestPoint.x * Math.sin(c), rho * Math.cos(c)*Math.cos(origin.latitude * Math.PI / 180) - interestPoint.y * Math.sin(c) * Math.sin(origin.latitude * Math.PI / 180)) * 180 / Math.PI;
    return {latitude: latitude, longitude: longitude};
}

function normalizeAngleMinusPiToPi(angle: number): number {
    // Reduce the angle
    angle = angle % (Math.PI * 2);

    // Force it to be in the range -π to π
    angle = (angle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

    return angle;
}
