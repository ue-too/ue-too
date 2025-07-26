import { Point } from "@ue-too/math";

export type GeoCoord = {
    longitude: number;
    latitude: number;
}

export function mercatorProjection(interestPoint: GeoCoord, centerLongitude: number = 0): Point{
    const r = 6371000;
    const latitude = interestPoint.latitude * Math.PI / 180;
    const longitude = interestPoint.longitude * Math.PI / 180;
    let x = r * normalizeAngleMinusPiToPi(longitude - centerLongitude * Math.PI / 180);
    let y = r * Math.log(Math.tan(Math.PI / 4 + latitude / 2));
    return {x: x, y: y};
}

export function inverseMercatorProjection(point: Point, centerLongitude: number = 0): GeoCoord{
    const r = 6371000;
    const longitude = point.x / r + centerLongitude;
    const latitude = 2 * Math.atan(Math.exp(point.y / r)) - Math.PI / 2;
    return {latitude: latitude * 180 / Math.PI, longitude: longitude * 180 / Math.PI};
}

export function orthoProjection(interestPoint: GeoCoord, origin: GeoCoord): {clipped: boolean, coord: Point}{
    const r = 6371000;
    const latitude = interestPoint.latitude * Math.PI / 180;
    const longitude = interestPoint.longitude * Math.PI / 180;
    const x = r * Math.cos(latitude) * Math.sin(longitude - origin.longitude * Math.PI / 180);
    const y = r * (Math.cos(origin.latitude * Math.PI / 180) * Math.sin(latitude) - Math.sin(origin.latitude * Math.PI / 180) * Math.cos(latitude) * Math.cos(longitude - origin.longitude * Math.PI / 180));
    const clipped = Math.sin(origin.latitude * Math.PI / 180) * Math.sin(latitude) + Math.cos(origin.latitude * Math.PI / 180) * Math.cos(latitude) * Math.cos(longitude - origin.longitude * Math.PI / 180);

    return {clipped: clipped < 0, coord: {x: x, y: y}};
}

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
