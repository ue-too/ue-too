import { GeoCoord } from "./projection";

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Geodesy representation conversion functions                        (c) Chris Veness 2002-2022  */
/*                                                                                   MIT Licence  */
/* www.movable-type.co.uk/scripts/latlong.html                                                    */
/* www.movable-type.co.uk/scripts/js/geodesy/geodesy-library.html#dms                             */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */


/**
 * Calculates an intermediate point along a great circle path.
 *
 * @remarks
 * Given two points on Earth's surface, this finds a point at a specified
 * fraction along the great circle (shortest) path between them.
 *
 * Uses the spherical interpolation formula for accurate results on a sphere.
 *
 * @param startCoord - The starting geographic coordinate
 * @param endCoord - The ending geographic coordinate
 * @param fraction - The fraction along the path (0 = start, 1 = end, 0.5 = midpoint)
 * @returns The intermediate point at the specified fraction
 *
 * @example
 * ```typescript
 * const nyc = { latitude: 40.7128, longitude: -74.0060 };
 * const london = { latitude: 51.5074, longitude: -0.1278 };
 *
 * // Find point 25% of the way from NYC to London
 * const quarter = intermediatePointOnGreatCircle(nyc, london, 0.25);
 *
 * // Find point 75% of the way
 * const threeQuarters = intermediatePointOnGreatCircle(nyc, london, 0.75);
 * ```
 *
 * @category Great Circle
 */
export function intermediatePointOnGreatCircle(startCoord: GeoCoord, endCoord: GeoCoord, fraction: number): GeoCoord{
    const Δφ = (endCoord.latitude - startCoord.latitude) * Math.PI / 180;
    const Δλ = (endCoord.longitude - startCoord.longitude) * Math.PI / 180;
    const φ1 = startCoord.latitude * Math.PI / 180;
    const λ1 = startCoord.longitude * Math.PI / 180;
    const φ2 = endCoord.latitude * Math.PI / 180;
    const λ2 = endCoord.longitude * Math.PI / 180;
    const angularDistA = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(angularDistA), Math.sqrt(1 - angularDistA));
 
    const a = Math.sin((1 - fraction) * c) / Math.sin(c);
    const b = Math.sin(fraction * c) / Math.sin(c);
    const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
    const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
    const z = a * Math.sin(φ1) * b * Math.sin(φ2);
    const φi = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λi = Math.atan2(y, x);
    return {latitude: φi, longitude: λi};
}

/**
 * Calculates the midpoint along a great circle path.
 *
 * @remarks
 * This is a specialized, optimized version of {@link intermediatePointOnGreatCircle}
 * for finding the exact midpoint (fraction = 0.5).
 *
 * @param startCoord - The starting geographic coordinate
 * @param endCoord - The ending geographic coordinate
 * @returns The midpoint on the great circle path
 *
 * @example
 * ```typescript
 * const start = { latitude: 50.0, longitude: -5.0 };
 * const end = { latitude: 58.0, longitude: 3.0 };
 * const mid = midPointOnGreatCircle(start, end);
 * console.log('Midpoint:', mid);
 * ```
 *
 * @category Great Circle
 */
export function midPointOnGreatCircle(startCoord: GeoCoord, endCoord: GeoCoord): GeoCoord{
    const φ1 = startCoord.latitude * Math.PI / 180;
    const φ2 = endCoord.latitude * Math.PI / 180;
    const λ1 = startCoord.longitude * Math.PI / 180;
    const λ2 = endCoord.longitude * Math.PI / 180;
    const Bx = Math.cos(φ2) * Math.cos(λ2 - λ1);
    const By = Math.cos(φ2) * Math.sin(λ2 - λ1);
    const φ3 = Math.atan2(Math.sin(φ1) + Math.sin(φ2),
                        Math.sqrt( (Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By ) );
    const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);
    return {latitude: φ3, longitude: λ3};
}

/**
 * Calculate the initial bearing between two points on the Earth's surface. 
 * (traveling along the great circle would result in different bearing from the start point to the end point)
 * 
 * @param startCoord - The starting point in GeoCoord format.
 * @param endCoord - The ending point in GeoCoord format.
 * @returns The bearing in degrees.
 */
export function initialBearingOfGreatCircle(startCoord: GeoCoord, endCoord: GeoCoord): number{
    const φ1 = startCoord.latitude * Math.PI / 180;
    const φ2 = endCoord.latitude * Math.PI / 180;
    const λ1 = startCoord.longitude * Math.PI / 180;
    const λ2 = endCoord.longitude * Math.PI / 180;
    const y = Math.sin(λ2-λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2)*Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    const brng = (θ * 180 / Math.PI + 360) % 360; // in degrees
    return brng;
}

/**
 * Calculates the great circle distance between two points on Earth.
 *
 * @remarks
 * Uses the haversine formula to calculate the shortest distance over Earth's
 * surface between two geographic coordinates. This is the "as-the-crow-flies"
 * distance.
 *
 * The calculation assumes Earth's mean radius of 6,371,000 meters and treats
 * Earth as a perfect sphere.
 *
 * @param startCoord - The starting geographic coordinate
 * @param endCoord - The ending geographic coordinate
 * @returns The distance in meters
 *
 * @example
 * ```typescript
 * const nyc = { latitude: 40.7128, longitude: -74.0060 };
 * const london = { latitude: 51.5074, longitude: -0.1278 };
 *
 * const distance = greatCircleDistance(nyc, london);
 * console.log('Distance:', distance / 1000, 'km'); // ~5570 km
 * ```
 *
 * @category Great Circle
 */
export function greatCircleDistance(startCoord: GeoCoord, endCoord: GeoCoord): number{
    const R = 6371e3; // metres
    const φ1 = startCoord.latitude * Math.PI / 180; // φ, λ in radians
    const φ2 = endCoord.latitude * Math.PI / 180;
    const Δφ = (endCoord.latitude - startCoord.latitude) * Math.PI / 180;
    const Δλ = (endCoord.longitude - startCoord.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
} 

/**
 * Calculates the destination point given a start point, bearing, and distance on a great circle.
 *
 * @remarks
 * Starting from a given point and traveling along a great circle at a specific
 * initial bearing for a given distance, this calculates where you'll end up.
 *
 * Note: The bearing will change along the path (except when traveling due north/south
 * or along the equator) because great circles are not straight lines on most map projections.
 *
 * @param startCoord - The starting geographic coordinate
 * @param bearing - The initial bearing in degrees (0 = north, 90 = east, etc.)
 * @param distance - The distance to travel in meters
 * @returns The destination coordinate
 *
 * @example
 * ```typescript
 * const start = { latitude: 40.7128, longitude: -74.0060 }; // NYC
 *
 * // Travel 1000km northeast from NYC
 * const destination = destinationFromOriginOnGreatCircle(start, 45, 1000000);
 * console.log('Destination:', destination);
 * ```
 *
 * @category Great Circle
 */
export function destinationFromOriginOnGreatCircle(startCoord: GeoCoord, bearing: number, distance: number): GeoCoord{
    const R = 6371e3; // metres
    const φ1 = startCoord.latitude * Math.PI / 180; // φ, λ in radians
    const λ1 = startCoord.longitude * Math.PI / 180;
    const θ = bearing * Math.PI / 180;
    const d = distance / R; // angular distance in radians
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) +
                      Math.cos(φ1) * Math.sin(d) * Math.cos(θ) );
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1),
                           Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    return {latitude: φ2, longitude: λ2};
}
