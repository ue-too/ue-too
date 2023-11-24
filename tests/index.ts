import { Point } from "../src";
export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandom(min: number, max: number){
    return Math.random() * (max - min) + min;
}

export function getRandomPoint(min: number, max: number): Point{
    return {x: getRandom(min, max), y: getRandom(min, max)};
}