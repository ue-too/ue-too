export * from "./vCanvas";
export * from "./vCamera";
export * from "./vDial";
export {default as vCamera} from "./vCamera";
export {default as vCanvas} from "./vCanvas";

export type Point = {
    x: number,
    y: number,
    z?: number
}