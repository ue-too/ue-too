
/**
 * @description The transform matrix for the camera.
 * It's in the format like this:
 * ```
 * | a    c    e |
 * | b    d    f |
 * | 0    0    1 |
 * ```
 * 
 * @category Camera
 */
export type TransformMatrix = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};
