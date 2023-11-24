import { PointCal } from "point2point";
import { Point } from "../../src";

export class vCamera {

    private position: Point;
    private zoom: number;
    private rotation: number;

    constructor(initialPosition: Point = {x: 0, y: 0}, initialZoom: number = 1, initialRotation: number = 0){
        this.position = initialPosition;
        this.zoom = initialZoom;
        this.rotation = initialRotation;
    }
    
    setPosition(position: Point){
        this.position = position;
    }

    setRotation(rotation: number){
        this.rotation = rotation;
    }

    setZoom(zooLevel: number){
        this.zoom = zooLevel;
    }

    getPosition(): Point{
        return this.position;
    }

    getZoom(): number{
        return this.zoom;
    }

    getRotation(): number{
        return this.rotation;
    }
}