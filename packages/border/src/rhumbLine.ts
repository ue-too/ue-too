import { GeoCoord } from "./projection";

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Geodesy representation conversion functions                        (c) Chris Veness 2002-2022  */
/*                                                                                   MIT Licence  */
/* www.movable-type.co.uk/scripts/latlong.html                                                    */
/* www.movable-type.co.uk/scripts/js/geodesy/geodesy-library.html#dms                             */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

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

export function bearing(startCoord: GeoCoord, endCoord: GeoCoord): number{
    const φ1 = startCoord.latitude * Math.PI / 180; // φ, λ in radians
    const φ2 = endCoord.latitude * Math.PI / 180;
    let Δλ = (endCoord.longitude - startCoord.longitude) * Math.PI / 180;
    const Δψ = Math.log(Math.tan(Math.PI / 4 + φ2 / 2) / Math.tan(Math.PI / 4 + φ1 / 2));

    // if dLon over 180° take shorter rhumb line across the anti-meridian:
    if (Math.abs(Δλ) > Math.PI) Δλ = Δλ > 0 ? -(2 * Math.PI-Δλ) : (2 * Math.PI + Δλ);

    const brng = Math.atan2(Δλ, Δψ) * 180 / Math.PI;
    return brng;
}

export function destinationFrom(startCoord: GeoCoord, bearing: number, distance: number): GeoCoord{
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

export function midPoint(startCoord: GeoCoord, endCoord: GeoCoord): GeoCoord{
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
