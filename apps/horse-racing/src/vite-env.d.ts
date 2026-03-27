/// <reference types="vite/client" />

declare module '*.json' {
    const value: unknown;
    export default value;
}

declare module 'bezier-js' {
    interface BezierPoint {
        x: number;
        y: number;
    }

    interface Arc {
        x: number;
        y: number;
        r: number;
        interval: { start: number; end: number };
    }

    export class Bezier {
        constructor(points: BezierPoint[]);
        get(t: number): BezierPoint;
        derivative(t: number): BezierPoint;
        arcs(errorThreshold?: number): Arc[];
    }
}
