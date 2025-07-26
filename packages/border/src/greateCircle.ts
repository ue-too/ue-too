import { GeoCoord } from "./projection";

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Geodesy representation conversion functions                        (c) Chris Veness 2002-2022  */
/*                                                                                   MIT Licence  */
/* www.movable-type.co.uk/scripts/latlong.html                                                    */
/* www.movable-type.co.uk/scripts/js/geodesy/geodesy-library.html#dms                             */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */


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
