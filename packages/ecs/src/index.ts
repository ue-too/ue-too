export const MAX_ENTITIES = 10000;
export const MAX_COMPONENTS = 32;

export type ComponentSignature = number;
export type ComponentType = number;

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
        if(entity === undefined) {
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

    getSignature(entity: Entity): ComponentSignature | null {
        if(entity >= this._maxEntities || entity < 0) {
            return null;
        }
        return this._signatures[entity];
    }
}

type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : _TupleOf<T, N, [...R, T]>;

// Usage

export interface CArray {
    entityDestroyed(entity: Entity): void;
}

export class ComponentArray<T> implements CArray {

    private denseArray: T[];
    private sparse: Entity[]; // maps entity to index in dense array
    private reverse: Entity[]; // maps index in dense array to entity
    private _count: number;

    constructor(maxEntities: number) {
        this._count = 0;
        this.denseArray = new Array(maxEntities);
        this.sparse = new Array(maxEntities);
        this.reverse = new Array(maxEntities);
    }

    insertData(entity: Entity, data: T): void {
        if(this.sparse.length < entity){
            // resize the array for the new entity but normally this should not happen
            this.sparse = [...this.sparse, ...new Array(entity - this.sparse.length).fill(null)];
        }

        this.denseArray[this._count] = data;
        this.reverse[this._count] = entity;
        this.sparse[entity] = this._count;
        this._count++;

        console.log('insertData');
        console.log('this.denseArray', this.denseArray);
        console.log('this.sparse', this.sparse);
        console.log('this.reverse', this.reverse);
        console.log('this._count', this._count);
    }

    getData(entity: Entity): T {
        if(this.sparse.length <= entity){
            return null;
        }

        const denseIndex = this.sparse[entity];
        if(denseIndex === undefined || denseIndex >= this._count){
            return null;
        }

        if(this.reverse[denseIndex] !== entity) {
            return null;
        }

        return this.denseArray[denseIndex];
    }

    removeData(entity: Entity): void {
        const denseIndex = this.sparse[entity];
        if(denseIndex === undefined || denseIndex >= this._count){
            return;
        }

        const lastEntity = this.reverse[this._count - 1];

        this.denseArray[denseIndex] = this.denseArray[this._count - 1];
        this.reverse[denseIndex] = lastEntity;
        this.sparse[lastEntity] = denseIndex;
        this.sparse[entity] = null;

        this._count--;
    }

    entityDestroyed(entity: Entity): void {
        this.removeData(entity);
    }
}

export class ComponentManager {

    private _componentNameToTypeMap: Map<string, {componentType: ComponentType, componentArray: CArray}> = new Map();
    private _nextAvailableComponentType: ComponentType = 0;
    
    registerComponent<T>(componentName: string){
        if(this._componentNameToTypeMap.has(componentName)) {
            console.warn(`Component ${componentName} already registered`);
        }
        const componentType = this._nextAvailableComponentType;
        this._componentNameToTypeMap.set(componentName, {componentType, componentArray: new ComponentArray<T>(MAX_ENTITIES)});
        this._nextAvailableComponentType++;
    }

    getComponentType(componentName: string): ComponentType {
        return this._componentNameToTypeMap.get(componentName)?.componentType;
    }

    addComponentToEntity<T>(componentName: string, entity: Entity, component: T){
        const componentArray = this._getComponentArray<T>(componentName);
        if(componentArray === null) {
            return;
        }
        componentArray.insertData(entity, component);
    }

    removeComponentFromEntity<T>(componentName: string, entity: Entity){
        const componentArray = this._getComponentArray<T>(componentName);
        if(componentArray === null) {
            return;
        }
        componentArray.removeData(entity);
    }

    getComponentFromEntity<T>(componentName: string, entity: Entity): T {
        const componentArray = this._getComponentArray<T>(componentName);
        if(componentArray === null) {
            return null;
        }
        return componentArray.getData(entity);
    }

    entityDestroyed(entity: Entity){
        for(const component of this._componentNameToTypeMap.values()){
            component.componentArray.entityDestroyed(entity);
        }
    }

    private _getComponentArray<T>(componentName: string): ComponentArray<T> {
        const component = this._componentNameToTypeMap.get(componentName);
        if(component === undefined) {
            console.warn(`Component ${componentName} not registered`);
            return null;
        }
        return component.componentArray as ComponentArray<T>;
    }

}

export class System {
    entities: Set<Entity>;

    constructor(){
        this.entities = new Set();
    }
}

export class SystemManager {
    private _systems: Map<string, {system: System, signature: ComponentSignature}> = new Map();

    registerSystem(systemName: string, system: System){
        if(this._systems.has(systemName)) {
            console.warn(`System ${systemName} already registered`);
            return;
        }
        this._systems.set(systemName, {system, signature: 0});
    }

    setSignature(systemName: string, signature: ComponentSignature){
        if(!this._systems.has(systemName)) {
            console.warn(`System ${systemName} not registered`);
            return;
        }
        this._systems.get(systemName).signature = signature;
    }

    entityDestroyed(entity: Entity){
        for(const system of this._systems.values()){
            system.system.entities.delete(entity);
        }
    }

    entitySignatureChanged(entity: Entity, signature: ComponentSignature){
        for(const system of this._systems.values()){
            const systemSignature = system.signature;
            if((systemSignature & signature) === systemSignature){
                system.system.entities.add(entity);
            } else {
                system.system.entities.delete(entity);
            }
        }
    }
}


