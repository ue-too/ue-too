/**
 * @packageDocumentation
 * Entity Component System (ECS) implementation for TypeScript.
 *
 * @remarks
 * The `@ue-too/ecs` package provides a high-performance Entity Component System architecture
 * based on the tutorial from https://austinmorlan.com/posts/entity_component_system/
 *
 * ## ECS Architecture
 *
 * - **Entities**: Unique identifiers (numbers) representing game objects
 * - **Components**: Data containers attached to entities
 * - **Systems**: Logic that operates on entities with specific component combinations
 * - **Signatures**: Bit flags indicating which components an entity has
 *
 * ## Key Features
 *
 * - **Efficient Storage**: Component arrays using sparse-set data structure
 * - **Fast Iteration**: Dense packing for cache-friendly iteration
 * - **Type-Safe**: TypeScript generics for component type safety
 * - **Signature Matching**: Automatic system updates when entity signatures change
 * - **Pooling**: Entity ID recycling for memory efficiency
 *
 * ## Core Classes
 *
 * - {@link Coordinator}: Main ECS coordinator managing all subsystems
 * - {@link EntityManager}: Creates and destroys entities
 * - {@link ComponentManager}: Registers components and manages component data
 * - {@link SystemManager}: Registers systems and maintains entity sets
 * - {@link ComponentArray}: Efficient sparse-set storage for component data
 *
 * @example
 * Basic ECS usage
 * ```typescript
 * import { Coordinator } from '@ue-too/ecs';
 *
 * // Define component types
 * type Position = { x: number; y: number };
 * type Velocity = { x: number; y: number };
 *
 * // Create coordinator
 * const coordinator = new Coordinator();
 *
 * // Register components
 * coordinator.registerComponent<Position>('Position');
 * coordinator.registerComponent<Velocity>('Velocity');
 *
 * // Create entity with components
 * const entity = coordinator.createEntity();
 * coordinator.addComponentToEntity('Position', entity, { x: 0, y: 0 });
 * coordinator.addComponentToEntity('Velocity', entity, { x: 1, y: 1 });
 *
 * // Query components
 * const pos = coordinator.getComponentFromEntity<Position>('Position', entity);
 * console.log('Position:', pos);
 * ```
 *
 * @example
 * System registration
 * ```typescript
 * import { Coordinator, System } from '@ue-too/ecs';
 *
 * const coordinator = new Coordinator();
 * coordinator.registerComponent<Position>('Position');
 * coordinator.registerComponent<Velocity>('Velocity');
 *
 * // Create a movement system
 * const movementSystem: System = {
 *   entities: new Set()
 * };
 *
 * coordinator.registerSystem('Movement', movementSystem);
 *
 * // Set signature (entities with Position AND Velocity)
 * const posType = coordinator.getComponentType('Position')!;
 * const velType = coordinator.getComponentType('Velocity')!;
 * const signature = (1 << posType) | (1 << velType);
 * coordinator.setSystemSignature('Movement', signature);
 *
 * // Update loop
 * function update(deltaTime: number) {
 *   movementSystem.entities.forEach(entity => {
 *     const pos = coordinator.getComponentFromEntity<Position>('Position', entity)!;
 *     const vel = coordinator.getComponentFromEntity<Velocity>('Velocity', entity)!;
 *     pos.x += vel.x * deltaTime;
 *     pos.y += vel.y * deltaTime;
 *   });
 * }
 * ```
 *
 * @see {@link Coordinator} for the main ECS API
 */

/**
 * Maximum number of entities that can exist simultaneously.
 * @category Configuration
 */
export const MAX_ENTITIES = 10000;

/**
 * Maximum number of component types that can be registered.
 * @category Configuration
 */
export const MAX_COMPONENTS = 32;

/**
 * Component signature type (bit field indicating which components an entity has).
 * @category Core Types
 */
export type ComponentSignature = number;

/**
 * Component type identifier.
 * @category Core Types
 */
export type ComponentType = number;

/**
 * Entity identifier (unique number).
 * @category Core Types
 */
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

    private denseArray: T[]; // packed array of data
    private sparse: (Entity | null)[]; // maps entity to index in dense array
    private reverse: (Entity | null)[]; // maps index in dense array to entity
    private _count: number;

    constructor(maxEntities: number) {
        this._count = 0;
        this.denseArray = new Array(maxEntities);
        this.sparse = new Array(maxEntities);
        this.reverse = new Array(maxEntities);
    }

    insertData(entity: Entity, data: T): void {
        if(this.getData(entity) !== null) {
            this.removeData(entity);
        }
        if(this.sparse.length < entity){
            // resize the array for the new entity but normally this should not happen
            this.sparse = [...this.sparse, ...new Array(entity - this.sparse.length).fill(null)];
        }

        this.denseArray[this._count] = data;
        this.reverse[this._count] = entity;
        this.sparse[entity] = this._count;
        this._count++;
    }

    getData(entity: Entity): T | null {
        if(this.sparse.length <= entity){
            return null;
        }

        const denseIndex = this.sparse[entity];
        if(denseIndex === undefined || denseIndex === null || denseIndex >= this._count){
            return null;
        }

        if(this.reverse[denseIndex] !== entity) {
            return null;
        }

        return this.denseArray[denseIndex];
    }

    removeData(entity: Entity): void {
        const denseIndex = this.sparse[entity];
        if(denseIndex === undefined || denseIndex === null || denseIndex >= this._count){
            return;
        }

        const lastEntity = this.reverse[this._count - 1];

        if(lastEntity === null) {
            return;
        }

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
            console.warn(`Component ${componentName} already registered; registering with the given new type`);
        }
        const componentType = this._nextAvailableComponentType;
        this._componentNameToTypeMap.set(componentName, {componentType, componentArray: new ComponentArray<T>(MAX_ENTITIES)});
        this._nextAvailableComponentType++;
    }

    getComponentType(componentName: string): ComponentType | null {
        return this._componentNameToTypeMap.get(componentName)?.componentType ?? null;
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

    getComponentFromEntity<T>(componentName: string, entity: Entity): T | null {
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

    private _getComponentArray<T>(componentName: string): ComponentArray<T> | null {
        const component = this._componentNameToTypeMap.get(componentName);
        if(component === undefined) {
            console.warn(`Component ${componentName} not registered`);
            return null;
        }
        return component.componentArray as ComponentArray<T>;
    }

}

export interface System {
    entities: Set<Entity>;
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
        const system = this._systems.get(systemName);
        if(system === undefined) {
            console.warn(`System ${systemName} not registered`);
            return;
        }
        system.signature = signature;
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

/**
 * Main ECS coordinator that manages entities, components, and systems.
 *
 * @remarks
 * The Coordinator is the central API for working with the ECS. It provides a unified
 * interface for:
 * - Creating and destroying entities
 * - Registering and managing components
 * - Registering and configuring systems
 * - Querying component data
 *
 * The Coordinator automatically keeps entity signatures up-to-date and notifies
 * systems when entities match their component requirements.
 *
 * @example
 * Complete ECS workflow
 * ```typescript
 * const ecs = new Coordinator();
 *
 * // Setup
 * ecs.registerComponent<Position>('Position');
 * ecs.registerComponent<Velocity>('Velocity');
 *
 * // Create entity
 * const entity = ecs.createEntity();
 * ecs.addComponentToEntity('Position', entity, { x: 0, y: 0 });
 * ecs.addComponentToEntity('Velocity', entity, { x: 1, y: 0 });
 *
 * // Update
 * const pos = ecs.getComponentFromEntity<Position>('Position', entity);
 * const vel = ecs.getComponentFromEntity<Velocity>('Velocity', entity);
 * if (pos && vel) {
 *   pos.x += vel.x;
 *   pos.y += vel.y;
 * }
 *
 * // Cleanup
 * ecs.destroyEntity(entity);
 * ```
 *
 * @category Core
 */
export class Coordinator {
    private _entityManager: EntityManager;
    private _componentManager: ComponentManager;
    private _systemManager: SystemManager;

    constructor(){
        this._entityManager = new EntityManager();
        this._componentManager = new ComponentManager();
        this._systemManager = new SystemManager();
    }

    createEntity(): Entity {
        return this._entityManager.createEntity();
    }

    destroyEntity(entity: Entity): void {
        this._entityManager.destroyEntity(entity);
        this._componentManager.entityDestroyed(entity);
        this._systemManager.entityDestroyed(entity);
    }

    registerComponent<T>(componentName: string): void {
        this._componentManager.registerComponent<T>(componentName);
    }

    addComponentToEntity<T>(componentName: string, entity: Entity, component: T): void {
        this._componentManager.addComponentToEntity<T>(componentName, entity, component);
        let signature = this._entityManager.getSignature(entity);
        if(signature === null) {
            signature = 0;
        }
        const componentType = this._componentManager.getComponentType(componentName);
        if(componentType === null) {
            console.warn(`Component ${componentName} not registered`);
            return;
        }
        signature |= 1 << componentType;
        this._entityManager.setSignature(entity, signature);
        this._systemManager.entitySignatureChanged(entity, signature);
    }

    removeComponentFromEntity<T>(componentName: string, entity: Entity): void {
        this._componentManager.removeComponentFromEntity<T>(componentName, entity);
        let signature = this._entityManager.getSignature(entity);
        if(signature === null) {
            signature = 0;
        }
        const componentType = this._componentManager.getComponentType(componentName);
        if(componentType === null) {
            return;
        }
        signature &= ~(1 << componentType);
        this._entityManager.setSignature(entity, signature);
        this._systemManager.entitySignatureChanged(entity, signature);
    }

    getComponentFromEntity<T>(componentName: string, entity: Entity): T | null {
        return this._componentManager.getComponentFromEntity<T>(componentName, entity);
    }

    getComponentType(componentName: string): ComponentType | null {
        return this._componentManager.getComponentType(componentName) ?? null;
    }

    registerSystem(systemName: string, system: System): void {
        this._systemManager.registerSystem(systemName, system);
    }

    setSystemSignature(systemName: string, signature: ComponentSignature): void {
        this._systemManager.setSignature(systemName, signature);
    }
}
