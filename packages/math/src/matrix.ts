import type { Point } from './2dVector';

export class Matrix {
    private _inverse: Matrix3x3 | null = null;

    constructor(private _matrix: Matrix3x3) {
        this._inverse = inverseMatrix3x3(this._matrix);
    }

    get inverse(): Matrix3x3 | null {
        return this._inverse;
    }

    setMatrix(matrix: Matrix3x3): void {
        this._matrix = matrix;
        this._inverse = inverseMatrix3x3(matrix);
    }

    transformPoint(point: Point): Point {
        return transformPoint(point, this._matrix);
    }

    invertPoint(point: Point): Point | null {
        if (!this._inverse) {
            return null;
        }
        return transformPoint(point, this._inverse);
    }
}

export interface Matrix3x3 {
    a: number;
    c: number;
    e: number;
    b: number;
    d: number;
    f: number;
    g: number;
    h: number;
    i: number;
}

export function inverseMatrix3x3(m: Matrix3x3): Matrix3x3 | null {
    const { a, b, c, d, e, f, g, h, i } = m;

    // Matrix layout:
    // | a  c  e |
    // | b  d  f |
    // | g  h  i |

    // Calculate determinant
    const det = a * (d * i - f * h) - c * (b * i - f * g) + e * (b * h - d * g);

    // Check if matrix is singular (non-invertible)
    if (Math.abs(det) < 1e-10) {
        return null; // Matrix is not invertible
    }

    // Calculate inverse using adjugate matrix divided by determinant
    const invDet = 1 / det;

    const A = (d * i - f * h) * invDet;
    const B = (f * g - b * i) * invDet;
    const C = (e * h - c * i) * invDet;
    const D = (a * i - e * g) * invDet;
    const E = (c * f - e * d) * invDet;
    const F = (e * b - a * f) * invDet;
    const G = (b * h - d * g) * invDet;
    const H = (c * g - a * h) * invDet;
    const I = (a * d - c * b) * invDet;

    return {
        a: A,
        b: B,
        c: C,
        d: D,
        e: E,
        f: F,
        g: G,
        h: H,
        i: I,
    };
}

function transformPoint(point: Point, matrix: Matrix3x3): Point {
    const { x, y } = point;
    const { a, b, c, d, e, f, g, h, i } = matrix;

    // Matrix layout:
    // | a  c  e |
    // | b  d  f |
    // | g  h  i |

    // For homogeneous coordinates [x, y, 1]:
    const w = g * x + h * y + i;

    return {
        x: (a * x + c * y + e) / w,
        y: (b * x + d * y + f) / w,
    };
}
