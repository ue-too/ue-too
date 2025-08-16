import { BCurve } from "@ue-too/curve";

export class NumberManager {
    private _availableEntities: number[] = [];
    private _maxEntities: number;
    private _livingEntityCount = 0;

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
        }
    }

    createEntity(): number {
        if(this._livingEntityCount >= this._maxEntities) {
            // throw new Error('Max entities reached');
            console.info("Max entities reached, increasing max entities");
            const currentMaxEntities = this._maxEntities;
            this._maxEntities += currentMaxEntities;
            for (let i = currentMaxEntities; i < this._maxEntities; i++) {
                this._availableEntities.push(i);
            }
        }
        const entity = this._availableEntities.shift();
        if(entity === undefined) {
            throw new Error('No available entities');
        }
        this._livingEntityCount++;
        return entity;
    }

    destroyEntity(entity: number): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._availableEntities.push(entity);
        this._livingEntityCount--;
    }
}

export class TrackCurveManager {

    private _availableEntities: number[] = [];
    private _livingEntities: Set<number> = new Set();
    private _maxEntities: number;
    private _livingEntityCount = 0;
    private _trackSegmentsWithJoints: ({curve: BCurve, t0Joint: number, t1Joint: number} | null)[] = [];
    private _trackSegments: (BCurve | null)[] = [];

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
            this._trackSegments.push(null);
            this._trackSegmentsWithJoints.push(null);
        }
    }

    getTrackSegment(entity: number): BCurve | null {
        if(entity < 0 || entity >= this._trackSegments.length){
            return null;
        }
        return this._trackSegments[entity];
    }

    getTrackSegmentsWithJoints(): {curve: BCurve, t0Joint: number, t1Joint: number}[] {
        return this._trackSegmentsWithJoints.filter((trackSegment) => trackSegment !== null);
    }

    getTrackSegmentWithJoints(entity: number): {curve: BCurve, t0Joint: number, t1Joint: number} | null {
        if(entity < 0 || entity >= this._trackSegmentsWithJoints.length){
            return null;
        }
        return this._trackSegmentsWithJoints[entity];
    }

    createCurveWithJoints(curve: BCurve, t0Joint: number, t1Joint: number): number {
        const entity = this.createEntity(curve);
        this._trackSegmentsWithJoints[entity] = {curve: curve, t0Joint: t0Joint, t1Joint: t1Joint};
        return entity;
    }

    createEntity(curve: BCurve): number {
        if(this._livingEntityCount >= this._maxEntities) {
            // throw new Error('Max entities reached');
            console.info("Max entities reached, increasing max entities");
            const currentMaxEntities = this._maxEntities;
            this._maxEntities += currentMaxEntities;
            for (let i = currentMaxEntities; i < this._maxEntities; i++) {
                this._availableEntities.push(i);
                this._trackSegments.push(null);
            }
        }
        const entity = this._availableEntities.shift();
        if(entity === undefined) {
            throw new Error('No available entities');
        }
        this._trackSegments[entity] = curve;
        this._livingEntityCount++;
        this._livingEntities.add(entity);
        return entity;
    }

    destroyEntity(entity: number): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._livingEntities.delete(entity);
        this._availableEntities.push(entity);
        this._livingEntityCount--;
        this._trackSegments[entity] = null;
        this._trackSegmentsWithJoints[entity] = null;
    }

    get livingEntities(): number[] {
        return Array.from(this._livingEntities);
    }
}
