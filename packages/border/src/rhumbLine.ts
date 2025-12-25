import { GeoCoord } from "./projection";

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Geodesy representation conversion functions                        (c) Chris Veness 2002-2022  */
/*                                                                                   MIT Licence  */
/* www.movable-type.co.uk/scripts/latlong.html                                                    */
/* www.movable-type.co.uk/scripts/js/geodesy/geodesy-library.html#dms                             */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/**
 * Calculates the distance along a rhumb line between two points.
 *
 * @remarks
 * A rhumb line (also called loxodrome) is a path of constant bearing. Unlike great
 * circles, rhumb lines appear as straight lines on Mercator projections, making them
 * easier for navigation.
 *
 * Rhumb lines are generally slightly longer than great circle routes, except when
 * traveling due east/west along the equator or due north/south.
 *
 * Uses Earth's mean radius of 6,371,000 meters.
 *
 * @param startCoord - The starting geographic coordinate
 * @param endCoord - The ending geographic coordinate
 * @returns The distance in meters along the rhumb line
 *
 * @example
 * ```typescript
 * const start = { latitude: 50.0, longitude: -5.0 };
 * const end = { latitude: 58.0, longitude: 3.0 };
 *
 * const distance = rhumbDistance(start, end);
 * console.log('Rhumb distance:', distance / 1000, 'km');
 *
 * // Compare with great circle distance
 * const gcDistance = greatCircleDistance(start, end);
 * console.log('Great circle is', (distance - gcDistance) / 1000, 'km shorter');
 * ```
 *
 * @category Rhumb Line
 */
export function rhumbDistance(startCoord: GeoCoord, endCoord: GeoCoord): number{
    const R = 6371e3; // metres
    const φ1 = startCoord.latitude * Math.PI/180; // φ, λ in radians
    const φ2 = endCoord.latitude * Math.PI/180;
    const Δφ = (endCoord.latitude - startCoord.latitude) * Math.PI/180;
    let Δλ = (endCoord.longitude - startCoord.longitude) * Math.PI/180;
    const Δψ = Math.log(Math.tan(Math.PI / 4 + φ2 / 2)/Math.tan(Math.PI / 4 + φ1 / 2));
    const q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1); // E-W course becomes ill-conditioned with 0/0

    // if dLon over 180° take shorter rhumb line across the anti-meridian:
    if (Math.abs(Δλ) > Math.PI) Δλ = Δλ > 0 ? - (2 * Math.PI - Δλ) : (2 * Math.PI + Δλ);

    const dist = Math.sqrt(Δφ * Δφ + q * q * Δλ * Δλ) * R;
    return dist;
}

/**
 * Calculates the constant bearing along a rhumb line.
 *
 * @remarks
 * Unlike great circles where the bearing changes along the path, rhumb lines
 * maintain a constant bearing. This makes them simpler for navigation - you can
 * follow a single compass direction.
 *
 * @param startCoord - The starting geographic coordinate
 * @param endCoord - The ending geographic coordinate
 * @returns The constant bearing in degrees (0-360)
 *
 * @example
 * ```typescript
 * const start = { latitude: 50.0, longitude: -5.0 };
 * const end = { latitude: 58.0, longitude: 3.0 };
 *
 * const bearing = rhumbBearing(start, end);
 * console.log('Constant bearing:', bearing, 'degrees');
 *
 * // This bearing stays constant along the entire path
 * ```
 *
 * @category Rhumb Line
 */
export function rhumbBearing(startCoord: GeoCoord, endCoord: GeoCoord): number{
    const φ1 = startCoord.latitude * Math.PI / 180; // φ, λ in radians
    const φ2 = endCoord.latitude * Math.PI / 180;
    let Δλ = (endCoord.longitude - startCoord.longitude) * Math.PI / 180;
    const Δψ = Math.log(Math.tan(Math.PI / 4 + φ2 / 2) / Math.tan(Math.PI / 4 + φ1 / 2));

    // if dLon over 180° take shorter rhumb line across the anti-meridian:
    if (Math.abs(Δλ) > Math.PI) Δλ = Δλ > 0 ? -(2 * Math.PI-Δλ) : (2 * Math.PI + Δλ);

    const brng = Math.atan2(Δλ, Δψ) * 180 / Math.PI;
    return brng;
}

/**
 * Calculates the destination point given a start point, constant bearing, and distance on a rhumb line.
 *
 * @remarks
 * Starting from a given point and traveling at a constant bearing for a given
 * distance, this calculates where you'll end up. The bearing remains constant
 * throughout the journey.
 *
 * This is the rhumb line equivalent of {@link destinationFromOriginOnGreatCircle}.
 *
 * @param startCoord - The starting geographic coordinate
 * @param bearing - The constant bearing in degrees (0 = north, 90 = east, etc.)
 * @param distance - The distance to travel in meters
 * @returns The destination coordinate
 *
 * @example
 * ```typescript
 * const start = { latitude: 40.0, longitude: -74.0 };
 *
 * // Travel 500km on constant bearing of 45 degrees (northeast)
 * const destination = destinationFromOriginOnRhumbLine(start, 45, 500000);
 * console.log('Destination:', destination);
 * ```
 *
 * @category Rhumb Line
 */
export function destinationFromOriginOnRhumbLine(startCoord: GeoCoord, bearing: number, distance: number): GeoCoord{
    const R = 6371e3; // metres
    const φ1 = startCoord.latitude * Math.PI / 180; // φ, λ in radians
    const λ1 = startCoord.longitude * Math.PI / 180;
    const θ = bearing * Math.PI / 180;
    const d = distance;
    const δ = d / R;
    const Δφ = δ * Math.cos(θ);
    let φ2 = φ1 + Δφ;

    const Δψ = Math.log(Math.tan(φ2 / 2 + Math.PI / 4) / Math.tan(φ1 / 2 + Math.PI / 4));
    const q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1); // E-W course becomes ill-conditioned with 0/0

    const Δλ = δ * Math.sin(θ) / q;
    const λ2 = λ1 + Δλ;

    // check for some daft bugger going past the pole, normalise latitude if so
    if (Math.abs(φ2) > Math.PI / 2) φ2 = φ2 > 0 ? Math.PI - φ2 : -Math.PI - φ2;
    return {latitude: φ2, longitude: λ2};
}

/**
 * Calculates the midpoint along a rhumb line.
 *
 * @remarks
 * Finds the point exactly halfway along a rhumb line path between two points.
 *
 * @param startCoord - The starting geographic coordinate
 * @param endCoord - The ending geographic coordinate
 * @returns The midpoint on the rhumb line path
 *
 * @example
 * ```typescript
 * const start = { latitude: 50.0, longitude: -5.0 };
 * const end = { latitude: 58.0, longitude: 3.0 };
 *
 * const mid = midPointOnRhumbLine(start, end);
 * console.log('Midpoint:', mid);
 * ```
 *
 * @category Rhumb Line
 */
export function midPointOnRhumbLine(startCoord: GeoCoord, endCoord: GeoCoord): GeoCoord{
    let λ1 = startCoord.longitude * Math.PI / 180;  
    const λ2 = endCoord.longitude * Math.PI / 180;
    const φ1 = startCoord.latitude * Math.PI / 180;
    const φ2 = endCoord.latitude * Math.PI / 180; 
    if (Math.abs(λ2 - λ1) > Math.PI) λ1 += 2 * Math.PI; // crossing anti-meridian

    const φ3 = (φ1 + φ2) / 2;
    const f1 = Math.tan(Math.PI / 4 + φ1 / 2);
    const f2 = Math.tan(Math.PI / 4 + φ2 / 2);
    const f3 = Math.tan(Math.PI / 4 + φ3 / 2);
    let λ3 = ( (λ2 - λ1) * Math.log(f3) + λ1 * Math.log(f2) - λ2 * Math.log(f1) ) / Math.log(f2 / f1);

    if (!isFinite(λ3)) λ3 = (λ1 + λ2) / 2; // parallel of latitude
    return {latitude: φ3, longitude: λ3};
}
