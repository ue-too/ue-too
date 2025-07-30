export const MAX_ENTITIES = 10000;
export const MAX_COMPONENTS = 32;

export type ComponentSignature = number;

export type Entity = number;


export class EntityManager {

    private _availableEntities: Entity[] = [];
    private _signatures: ComponentSignature[] = [];
    private _maxEntities: number;

    private _livingEntityCount = 0;

    constructor(maxEntities: number = MAX_ENTITIES) {
        this._maxEntities = maxEntities;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
            this._signatures.push(0);
        }
    }

    createEntity(): Entity {
        if(this._livingEntityCount >= this._maxEntities) {
            throw new Error('Max entities reached');
        }
        const entity = this._availableEntities.shift();
        if(!entity) {
            throw new Error('No available entities');
        }
        this._signatures[entity] = 0;
        this._livingEntityCount++;
        return entity;
    }

    destroyEntity(entity: Entity): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._signatures[entity] = 0;
        this._availableEntities.push(entity);
        this._livingEntityCount--;
    }

    setSignature(entity: Entity, signature: ComponentSignature): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._signatures[entity] = signature;
    }

    getSignature(entity: Entity): ComponentSignature {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        return this._signatures[entity];
    }
}


