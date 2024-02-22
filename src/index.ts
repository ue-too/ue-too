export * from "./board";
export * from "./board-camera";
export * from "./vDial";
export {default as BoardCamera} from "./board-camera";
export {default as Board} from "./board";

export type Point = {
    x: number,
    y: number,
    z?: number
}