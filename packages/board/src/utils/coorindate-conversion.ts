import { Point } from "@ue-too/math";

// isometric point to flat world point
export function pointConversion(point: Point) {
    const cos30 = Math.cos(Math.PI / 6);
    const cos60 = Math.cos(Math.PI / 3);

    return {
        x: point.x * cos30 - point.y * cos30,
        y: point.x * cos60 + point.y * cos60 + (point.z ?? 0)
    }
}
