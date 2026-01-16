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
 * const Movement = createSystemName('Movement');
 * coordinator.registerSystem(Movement, movementSystem);
 *
 * // Set signature (entities with Position AND Velocity)
 * const Position = createComponentName('Position');
 * const Velocity = createComponentName('Velocity');
 * const posType = coordinator.getComponentType(Position)!;
 * const velType = coordinator.getComponentType(Velocity)!;
 * const signature = (1 << posType) | (1 << velType);
 * coordinator.setSystemSignature(Movement, signature);
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
 * @category Types
 */
export type ComponentSignature = number;

/**
 * Component type identifier.
 * @category Types
 */
export type ComponentType = number;

/**
 * Entity identifier (unique number).
 * @category Types
 */
export type Entity = number;

/**
 * Component name identifier using Symbol for type safety and uniqueness.
 * Use {@link createComponentName} to create component names, or {@link Symbol.for} for global symbols.
 * @category Types
 */
export type ComponentName = symbol;

/**
 * System name identifier using Symbol for type safety and uniqueness.
 * Use {@link createSystemName} to create system names, or {@link Symbol.for} for global symbols.
 * @category Types
 */
export type SystemName = symbol;

/**
 * Supported field types for runtime-defined component schemas.
 * @category Types
 */
export type ComponentFieldType = 
    | 'string' 
    | 'number' 
    | 'boolean' 
    | 'object' 
    | 'array'
    | 'entity';

/**
 * Discriminated union for array element types.
 * Supports both built-in types and custom component types.
 * @category Types
 */
export type ArrayElementType = 
    | { kind: 'builtin'; type: Exclude<ComponentFieldType, 'array'> }
    | { kind: 'custom'; typeName: ComponentName };

/**
 * Base properties shared by all field definitions.
 * @category Types
 */
interface BaseComponentField {
    /** The name of the field */
    name: string;
    /** Whether the field is optional (default: false) */
    optional?: boolean;
    /** Default value for the field (used when creating new instances) */
    defaultValue?: unknown;
}

/**
 * Definition for a primitive (non-array) field in a component schema.
 * @category Types
 */
export interface ComponentPrimitiveField extends BaseComponentField {
    /** Discriminator for the union type */
    type: Exclude<ComponentFieldType, 'array'>;
}

/**
 * Definition for an array field in a component schema.
 * @category Types
 */
export interface ComponentArrayField extends BaseComponentField {
    /** Discriminator for the union type */
    type: 'array';
    /** 
     * The element type for array fields (required).
     * Specifies what type each element in the array should be.
     * Can be a built-in type or a custom component type name.
     */
    arrayElementType: ArrayElementType;
}

/**
 * Discriminated union for field definitions in a component schema.
 * Use type guards to distinguish between primitive and array fields.
 * @category Types
 */
export type ComponentFieldDefinition = ComponentPrimitiveField | ComponentArrayField;

/**
 * Schema definition for a component type that can be defined at runtime.
 * @category Types
 */
export interface ComponentSchema {
    /** The name of the component type (using Symbol for type safety) */
    componentName: ComponentName;
    /** Array of field definitions */
    fields: ComponentFieldDefinition[];
}

/**
 * Helper function to create a component name from a string.
 * This creates a unique symbol for the component name.
 * 
 * @param name - The string name for the component
 * @returns A unique symbol for the component name
 * 
 * @example
 * ```typescript
 * const Position = createComponentName('Position');
 * coordinator.registerComponent<Position>(Position);
 * ```
 * 
 * @category Utilities
 */
export function createComponentName(name: string): ComponentName {
    return Symbol(name);
}

/**
 * Helper function to get the string description from a component name symbol.
 * Useful for debugging and serialization.
 * 
 * @param componentName - The component name symbol
 * @returns The string description of the symbol
 * 
 * @category Utilities
 */
export function getComponentNameString(componentName: ComponentName): string {
    return componentName.description || componentName.toString();
}

/**
 * Helper function to create a component name using Symbol.for().
 * This creates a global symbol that can be looked up by string key,
 * which is useful for serialization and cross-module access.
 * 
 * @param key - The string key for the global symbol
 * @returns A global symbol for the component name
 * 
 * @example
 * ```typescript
 * const Position = createGlobalComponentName('Position');
 * coordinator.registerComponent<Position>(Position);
 * // Can be retrieved later with Symbol.for('Position')
 * ```
 * 
 * @category Utilities
 */
export function createGlobalComponentName(key: string): ComponentName {
    return Symbol.for(key);
}

/**
 * Helper function to create a system name from a string.
 * This creates a unique symbol for the system name.
 * 
 * @param name - The string name for the system
 * @returns A unique symbol for the system name
 * 
 * @example
 * ```typescript
 * const Movement = createSystemName('Movement');
 * coordinator.registerSystem(Movement, movementSystem);
 * ```
 * 
 * @category Utilities
 */
export function createSystemName(name: string): SystemName {
    return Symbol(name);
}

/**
 * Helper function to get the string description from a system name symbol.
 * Useful for debugging and serialization.
 * 
 * @param systemName - The system name symbol
 * @returns The string description of the symbol
 * 
 * @category Utilities
 */
export function getSystemNameString(systemName: SystemName): string {
    return systemName.description || systemName.toString();
}

/**
 * Helper function to create a system name using Symbol.for().
 * This creates a global symbol that can be looked up by string key,
 * which is useful for serialization and cross-module access.
 * 
 * @param key - The string key for the global symbol
 * @returns A global symbol for the system name
 * 
 * @example
 * ```typescript
 * const Movement = createGlobalSystemName('Movement');
 * coordinator.registerSystem(Movement, movementSystem);
 * // Can be retrieved later with Symbol.for('Movement')
 * ```
 * 
 * @category Utilities
 */
export function createGlobalSystemName(key: string): SystemName {
    return Symbol.for(key);
}

/**
 * Serialized representation of an array element type for JSON storage.
 * @category Types
 */
type SerializedArrayElementType = 
    | { kind: 'builtin'; type: Exclude<ComponentFieldType, 'array'> }
    | { kind: 'custom'; typeName: string };

/**
 * Serialized representation of a component field for JSON storage.
 * @category Types
 */
type SerializedComponentField = 
    | (Omit<ComponentPrimitiveField, 'type'> & { type: Exclude<ComponentFieldType, 'array'> })
    | (Omit<ComponentArrayField, 'arrayElementType'> & { arrayElementType: SerializedArrayElementType });

/**
 * Serialized representation of a component schema for JSON storage.
 * Component names are stored as strings (using Symbol.for keys for global symbols).
 * @category Types
 */
export interface SerializedComponentSchema {
    componentName: string;
    fields: SerializedComponentField[];
}

/**
 * Serialized representation of an entity's component data.
 * @category Types
 */
export interface SerializedEntity {
    /** The entity ID */
    entity: Entity;
    /** Map of component names (as strings) to their serialized data */
    components: Record<string, unknown>;
}

/**
 * Serialized representation of the entire ECS state.
 * @category Types
 */
export interface SerializedECSState {
    /** Array of all entities with their component data */
    entities: SerializedEntity[];
    /** Optional: Array of component schemas (if using schema-based components) */
    schemas?: SerializedComponentSchema[];
}

/**
 * Serialize a component schema to a JSON-compatible format.
 * Note: Only works with global symbols (created via Symbol.for).
 * 
 * @param schema - The component schema to serialize
 * @returns A serializable representation of the schema
 * @throws Error if component name is not a global symbol
 * 
 * @category Utilities
 */
export function serializeComponentSchema(schema: ComponentSchema): SerializedComponentSchema {
    const key = Symbol.keyFor(schema.componentName);
    if (key === undefined) {
        throw new Error(`Cannot serialize schema: component name is not a global symbol. Use createGlobalComponentName() or Symbol.for() to create component names.`);
    }
    
    return {
        componentName: key,
        fields: schema.fields.map(field => {
            if (field.type === 'array') {
                if (field.arrayElementType.kind === 'custom') {
                    const customKey = Symbol.keyFor(field.arrayElementType.typeName);
                    if (customKey === undefined) {
                        throw new Error(`Cannot serialize schema: custom array element type is not a global symbol.`);
                    }
                    return {
                        ...field,
                        arrayElementType: {
                            kind: 'custom' as const,
                            typeName: customKey
                        }
                    } as SerializedComponentField;
                } else {
                    return {
                        ...field,
                        arrayElementType: field.arrayElementType
                    } as SerializedComponentField;
                }
            }
            return field as SerializedComponentField;
        })
    };
}

/**
 * Deserialize a component schema from a JSON-compatible format.
 * 
 * @param serialized - The serialized schema
 * @returns The component schema with symbols restored
 * 
 * @category Utilities
 */
export function deserializeComponentSchema(serialized: SerializedComponentSchema): ComponentSchema {
    return {
        componentName: Symbol.for(serialized.componentName),
        fields: serialized.fields.map(field => {
            if (field.type === 'array') {
                if (field.arrayElementType.kind === 'custom') {
                    return {
                        ...field,
                        arrayElementType: {
                            kind: 'custom' as const,
                            typeName: Symbol.for(field.arrayElementType.typeName)
                        }
                    } as ComponentArrayField;
                } else {
                    return {
                        ...field,
                        arrayElementType: field.arrayElementType
                    } as ComponentArrayField;
                }
            }
            return field as ComponentPrimitiveField;
        })
    };
}

/**
 * Manages entity lifecycle and signatures.
 *
 * @remarks
 * The EntityManager handles:
 * - Creating new entities (recycling IDs from a pool)
 * - Destroying entities (returning IDs to the pool)
 * - Storing and updating component signatures for each entity
 *
 * Entities are represented as simple numbers (IDs) and the manager maintains
 * a signature (bit field) for each entity indicating which components it has.
 *
 * @category Managers
 */
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

    /**
     * Get all living entities (entities that are currently active, not in the available pool).
     * @returns Array of all living entity IDs
     */
    getAllLivingEntities(): Entity[] {
        const livingEntities: Entity[] = [];
        const availableSet = new Set(this._availableEntities);
        
        for (let i = 0; i < this._maxEntities; i++) {
            if (!availableSet.has(i)) {
                livingEntities.push(i);
            }
        }
        
        return livingEntities;
    }

    /**
     * Check if an entity exists (is currently active, not in the available pool).
     * @param entity - The entity ID to check
     * @returns true if the entity exists, false otherwise
     */
    entityExists(entity: Entity): boolean {
        if (entity >= this._maxEntities || entity < 0) {
            return false;
        }
        // An entity exists if it's not in the available pool
        return !this._availableEntities.includes(entity);
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

/**
 * Internal interface for component array lifecycle hooks.
 * @internal
 */
export interface CArray {
    entityDestroyed(entity: Entity): void;
}

/**
 * Efficient sparse-set data structure for storing component data.
 *
 * @remarks
 * ComponentArray uses a sparse-set implementation for O(1) insertion, deletion,
 * and lookup while maintaining dense packing for cache-efficient iteration.
 *
 * The sparse-set consists of:
 * - **Dense array**: Packed component data for iteration
 * - **Sparse array**: Maps entity ID to dense array index
 * - **Reverse array**: Maps dense array index back to entity ID
 *
 * This structure allows fast component access by entity ID and fast iteration
 * over all components without gaps.
 *
 * @typeParam T - The component data type
 *
 * @category Data Structures
 */
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

    /**
     * Get all entities that have this component.
     * @returns Array of entity IDs that have this component
     */
    getAllEntities(): Entity[] {
        const entities: Entity[] = [];
        for (let i = 0; i < this._count; i++) {
            const entity = this.reverse[i];
            if (entity !== null && entity !== undefined) {
                entities.push(entity);
            }
        }
        return entities;
    }

    /**
     * Get the count of entities with this component.
     * @returns Number of entities with this component
     */
    getCount(): number {
        return this._count;
    }
}

/**
 * Manages component registration and component data storage.
 *
 * @remarks
 * The ComponentManager handles:
 * - Registering new component types and assigning unique type IDs
 * - Creating ComponentArray storage for each component type
 * - Adding, removing, and querying component data for entities
 * - Cleaning up component data when entities are destroyed
 *
 * Each component type gets a unique ID (0-31) and its own ComponentArray
 * for efficient storage and retrieval.
 *
 * @category Managers
 */
export class ComponentManager {

    private _componentNameToTypeMap: Map<ComponentName, {componentType: ComponentType, componentArray: CArray}> = new Map();
    private _nextAvailableComponentType: ComponentType = 0;
    private _schemas: Map<ComponentName, ComponentSchema> = new Map();

    getRegisteredComponentNames(): ComponentName[] {
        return Array.from(this._componentNameToTypeMap.keys());
    }

    /**
     * Get all entities that have a specific component.
     * @param componentName - The name of the component type
     * @returns Array of entity IDs that have this component, or empty array if component not registered
     */
    getAllEntitiesWithComponent(componentName: ComponentName): Entity[] {
        const component = this._componentNameToTypeMap.get(componentName);
        if (component === undefined) {
            return [];
        }
        return (component.componentArray as ComponentArray<unknown>).getAllEntities();
    }

    /**
     * Get the schema for a component type, if it was registered with a schema.
     * @param componentName - The name of the component type
     * @returns The component schema or null if not found
     */
    getComponentSchema(componentName: ComponentName): ComponentSchema | null {
        return this._schemas.get(componentName) ?? null;
    }

    /**
     * Get all registered component schemas.
     * @returns Array of all component schemas
     */
    getAllComponentSchemas(): ComponentSchema[] {
        return Array.from(this._schemas.values());
    }
    
    registerComponent<T>(componentName: ComponentName){
        // Idempotent: if component is already registered, do nothing
        if(this._componentNameToTypeMap.has(componentName)) {
            return;
        }
        const componentType = this._nextAvailableComponentType;
        this._componentNameToTypeMap.set(componentName, {componentType, componentArray: new ComponentArray<T>(MAX_ENTITIES)});
        this._nextAvailableComponentType++;
    }

    getComponentType(componentName: ComponentName): ComponentType | null {
        return this._componentNameToTypeMap.get(componentName)?.componentType ?? null;
    }

    addComponentToEntity<T>(componentName: ComponentName, entity: Entity, component: T){
        const componentArray = this._getComponentArray<T>(componentName);
        if(componentArray === null) {
            return;
        }
        componentArray.insertData(entity, component);
    }

    removeComponentFromEntity<T>(componentName: ComponentName, entity: Entity){
        const componentArray = this._getComponentArray<T>(componentName);
        if(componentArray === null) {
            return;
        }
        componentArray.removeData(entity);
    }

    getComponentFromEntity<T>(componentName: ComponentName, entity: Entity): T | null {
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

    private _getComponentArray<T>(componentName: ComponentName): ComponentArray<T> | null {
        const component = this._componentNameToTypeMap.get(componentName);
        if(component === undefined) {
            console.warn(`Component ${getComponentNameString(componentName)} not registered`);
            return null;
        }
        return component.componentArray as ComponentArray<T>;
    }

    componentIsCustomSchema(componentName: ComponentName): boolean {
        return this._schemas.has(componentName);
    }

    /**
     * Register a component with a runtime-defined schema.
     * This allows components to be defined dynamically (e.g., through a GUI).
     * 
     * @param schema - The component schema definition
     * @throws Error if schema validation fails
     */
    registerComponentWithSchema(schema: ComponentSchema): void {
        // Validate schema
        if (!schema.componentName) {
            throw new Error('Component schema must have a componentName');
        }
        if (!schema.fields || schema.fields.length === 0) {
            throw new Error('Component schema must have at least one field');
        }

        // Check for duplicate field names and validate array types
        const fieldNames = new Set<string>();
        for (const field of schema.fields) {
            if (fieldNames.has(field.name)) {
                throw new Error(`Duplicate field name "${field.name}" in schema for component "${getComponentNameString(schema.componentName)}"`);
            }
            fieldNames.add(field.name);

            // Validate array fields - TypeScript ensures arrayElementType is required for array fields
            if (field.type === 'array') {
                // Custom types are validated when they're registered
                // No need to check for empty string since we're using symbols
            }
        }

        // Idempotent: if component schema is already registered, do nothing
        if (this._schemas.has(schema.componentName)) {
            return;
        }
        
        // Register the component type (if not already registered)
        if (!this._componentNameToTypeMap.has(schema.componentName)) {
            const componentType = this._nextAvailableComponentType;
            this._componentNameToTypeMap.set(schema.componentName, {
                componentType,
                componentArray: new ComponentArray<Record<string, unknown>>(MAX_ENTITIES)
            });
            this._nextAvailableComponentType++;
        }
        // Store the schema
        this._schemas.set(schema.componentName, schema);

    }

    /**
     * Create a component instance from a schema with default values.
     * 
     * @param componentName - The name of the component type
     * @param overrides - Optional values to override defaults
     * @returns A component instance with all fields initialized
     * @throws Error if component is not registered with a schema
     */
    createComponentFromSchema(componentName: ComponentName, overrides: Record<string, unknown> = {}): Record<string, unknown> {
        const schema = this._schemas.get(componentName);
        if (!schema) {
            throw new Error(`Component "${getComponentNameString(componentName)}" is not registered with a schema`);
        }

        const component: Record<string, unknown> = {};
        
        for (const field of schema.fields) {
            if (overrides.hasOwnProperty(field.name)) {
                component[field.name] = overrides[field.name];
            } else if (field.defaultValue !== undefined) {
                component[field.name] = field.defaultValue;
            } else if (!field.optional) {
                // Required field with no default - use type-appropriate default
                if (field.type === 'array') {
                    component[field.name] = this._getDefaultValueForType(field.type, field.arrayElementType);
                } else {
                    component[field.name] = this._getDefaultValueForType(field.type);
                }
            }
            // Optional fields without defaults are omitted
        }

        return component;
    }

    /**
     * Validate component data against its schema.
     * 
     * @param componentName - The name of the component type
     * @param data - The component data to validate
     * @returns true if valid, false otherwise
     */
    validateComponentData(componentName: ComponentName, data: unknown): boolean {
        const schema = this._schemas.get(componentName);
        if (!schema) {
            // No schema means no validation required
            return true;
        }

        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return false;
        }

        const dataObj = data as Record<string, unknown>;

        // Check all required fields are present
        for (const field of schema.fields) {
            if (!field.optional && !dataObj.hasOwnProperty(field.name)) {
                return false;
            }

            // If field is present, validate its type
            if (dataObj.hasOwnProperty(field.name)) {
                if (field.type === 'array') {
                    if (!this._validateFieldType(field.type, dataObj[field.name], field.arrayElementType)) {
                        return false;
                    }
                } else {
                    if (!this._validateFieldType(field.type, dataObj[field.name])) {
                        return false;
                    }
                }
            }
        }

        // Check for extra fields not in schema (optional - could be configurable)
        // For now, we allow extra fields

        return true;
    }

    /**
     * Get default value for a field type.
     */
    private _getDefaultValueForType(type: ComponentFieldType, arrayElementType?: ArrayElementType): unknown {
        switch (type) {
            case 'string':
                return '';
            case 'number':
                return 0;
            case 'boolean':
                return false;
            case 'object':
                return {};
            case 'array':
                return []; // Empty array - element type validation happens at runtime
            case 'entity':
                return null;
            default:
                return null;
        }
    }

    /**
     * Validate that a value matches the expected field type.
     * 
     * @param type - The field type
     * @param value - The value to validate
     * @param arrayElementType - The element type for array fields
     * @returns true if the value matches the expected type
     */
    private _validateFieldType(type: ComponentFieldType, value: unknown, arrayElementType?: ArrayElementType): boolean {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'array':
                if (!Array.isArray(value)) {
                    return false;
                }
                // If arrayElementType is specified, validate each element
                if (arrayElementType) {
                    if (arrayElementType.kind === 'builtin') {
                        return (value as unknown[]).every(element => 
                            this._validateFieldType(arrayElementType.type, element)
                        );
                    } else {
                        // Custom type: validate against the referenced component schema
                        const customSchema = this._schemas.get(arrayElementType.typeName);
                        if (!customSchema) {
                            // Custom type not found - could be strict or lenient
                            // For now, we'll validate that it's an object
                            return (value as unknown[]).every(element => 
                                typeof element === 'object' && element !== null && !Array.isArray(element)
                            );
                        }
                        // Validate each element against the custom schema
                        return (value as unknown[]).every(element => 
                            this.validateComponentData(arrayElementType.typeName, element)
                        );
                    }
                }
                return true;
            case 'entity':
                return typeof value === 'number' || value === null;
            default:
                return false;
        }
    }

    /**
     * Add a component to an entity with schema validation.
     * 
     * @param componentName - The name of the component type
     * @param entity - The entity to add the component to
     * @param component - The component data
     * @param validate - Whether to validate against schema (default: true)
     * @throws Error if validation fails
     */
    addComponentToEntityWithSchema(componentName: ComponentName, entity: Entity, component: Record<string, unknown>, validate: boolean = true): void {
        if (validate && !this.validateComponentData(componentName, component)) {
            throw new Error(`Component data for "${getComponentNameString(componentName)}" does not match its schema`);
        }
        this.addComponentToEntity<Record<string, unknown>>(componentName, entity, component);
    }

}

/**
 * System interface for processing entities with specific component combinations.
 *
 * @remarks
 * A System maintains a set of entities that match its component signature.
 * The ECS automatically updates this set when entities are created, destroyed,
 * or have their components modified.
 *
 * Systems contain only the logic for processing entities - the `entities` set
 * is automatically managed by the SystemManager.
 *
 * @example
 * ```typescript
 * const Position = createComponentName('Position');
 * const Velocity = createComponentName('Velocity');
 * const movementSystem: System = {
 *   entities: new Set()
 * };
 *
 * // System logic (called in game loop)
 * function updateMovement(deltaTime: number) {
 *   movementSystem.entities.forEach(entity => {
 *     const pos = ecs.getComponentFromEntity<Position>(Position, entity);
 *     const vel = ecs.getComponentFromEntity<Velocity>(Velocity, entity);
 *     if (pos && vel) {
 *       pos.x += vel.x * deltaTime;
 *       pos.y += vel.y * deltaTime;
 *     }
 *   });
 * }
 * ```
 *
 * @category Types
 */
export interface System {
    entities: Set<Entity>;
}

/**
 * Manages system registration and entity-system matching.
 *
 * @remarks
 * The SystemManager handles:
 * - Registering systems with their component signature requirements
 * - Maintaining the set of entities that match each system's signature
 * - Automatically adding/removing entities from systems when signatures change
 * - Cleaning up system entity sets when entities are destroyed
 *
 * When an entity's component signature changes (components added/removed),
 * the SystemManager checks all registered systems and updates their entity sets.
 * An entity is added to a system's set if its signature contains all components
 * required by the system's signature.
 *
 * @category Managers
 */
export class SystemManager {
    private _systems: Map<SystemName, {system: System, signature: ComponentSignature}> = new Map();

    registerSystem(systemName: SystemName, system: System){
        // Idempotent: if system is already registered, do nothing
        if(this._systems.has(systemName)) {
            return;
        }
        this._systems.set(systemName, {system, signature: 0});
    }

    setSignature(systemName: SystemName, signature: ComponentSignature){
        if(!this._systems.has(systemName)) {
            console.warn(`System ${getSystemNameString(systemName)} not registered`);
            return;
        }
        const system = this._systems.get(systemName);
        if(system === undefined) {
            console.warn(`System ${getSystemNameString(systemName)} not registered`);
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

    getSystem<T extends System>(systemName: SystemName): T | null {
        const system = this._systems.get(systemName);
        if(system === undefined) {
            return null;
        }
        return system.system as T;
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

    registerComponent<T>(componentName: ComponentName): void {
        this._componentManager.registerComponent<T>(componentName);
    }

    addComponentToEntity<T>(componentName: ComponentName, entity: Entity, component: T): void {
        this._componentManager.addComponentToEntity<T>(componentName, entity, component);
        let signature = this._entityManager.getSignature(entity);
        if(signature === null) {
            signature = 0;
        }
        const componentType = this._componentManager.getComponentType(componentName);
        if(componentType === null) {
            console.warn(`Component ${getComponentNameString(componentName)} not registered`);
            return;
        }
        signature |= 1 << componentType;
        this._entityManager.setSignature(entity, signature);
        this._systemManager.entitySignatureChanged(entity, signature);
    }

    removeComponentFromEntity<T>(componentName: ComponentName, entity: Entity): void {
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

    getComponentFromEntity<T>(componentName: ComponentName, entity: Entity): T | null {
        return this._componentManager.getComponentFromEntity<T>(componentName, entity);
    }

    getComponentType(componentName: ComponentName): ComponentType | null {
        return this._componentManager.getComponentType(componentName) ?? null;
    }

    registerSystem(systemName: SystemName, system: System): void {
        this._systemManager.registerSystem(systemName, system);
    }

    setSystemSignature(systemName: SystemName, signature: ComponentSignature): void {
        this._systemManager.setSignature(systemName, signature);
    }

    getSystem<T extends System>(systemName: SystemName): T | null {
        return this._systemManager.getSystem<T>(systemName) ?? null;
    }

    /**
     * Register a component with a runtime-defined schema.
     * This allows components to be defined dynamically (e.g., through a GUI).
     * 
     * @param schema - The component schema definition
     * @throws Error if schema validation fails
     * 
     * @example
     * ```typescript
     * const coordinator = new Coordinator();
     * 
     * // Define a component schema at runtime
     * coordinator.registerComponentWithSchema({
     *   componentName: 'PlayerStats',
     *   fields: [
     *     { name: 'health', type: 'number', defaultValue: 100 },
     *     { name: 'name', type: 'string', defaultValue: 'Player' },
     *     { name: 'isAlive', type: 'boolean', defaultValue: true },
     *     { name: 'inventory', type: 'array', defaultValue: [] }
     *   ]
     * });
     * 
     * // Create an entity with the component
     * const entity = coordinator.createEntity();
     * const component = coordinator.createComponentFromSchema('PlayerStats', { health: 150 });
     * coordinator.addComponentToEntityWithSchema('PlayerStats', entity, component);
     * ```
     */
    registerComponentWithSchema(schema: ComponentSchema): void {
        this._componentManager.registerComponentWithSchema(schema);
    }

    /**
     * Get the schema for a component type, if it was registered with a schema.
     * 
     * @param componentName - The name of the component type
     * @returns The component schema or null if not found
     */
    getComponentSchema(componentName: ComponentName): ComponentSchema | null {
        return this._componentManager.getComponentSchema(componentName);
    }

    /**
     * Get the property field names of a component.
     * 
     * This method works in two ways:
     * 1. If the component was registered with a schema, returns field names from the schema
     * 2. If no schema exists, attempts to extract property names from an actual component instance
     *    (requires at least one entity to have an instance of the component)
     * 
     * @param componentName - The name of the component type
     * @returns Array of property field names, or empty array if component has no schema and no instances exist
     * 
     * @example
     * ```typescript
     * const coordinator = new Coordinator();
     * 
     * // Method 1: Using schema
     * coordinator.registerComponentWithSchema({
     *   componentName: 'PlayerStats',
     *   fields: [
     *     { name: 'health', type: 'number', defaultValue: 100 },
     *     { name: 'name', type: 'string', defaultValue: 'Player' },
     *     { name: 'isAlive', type: 'boolean', defaultValue: true }
     *   ]
     * });
     * const fieldNames1 = coordinator.getComponentPropertyNames('PlayerStats');
     * console.log(fieldNames1); // ['health', 'name', 'isAlive']
     * 
     * // Method 2: From component instance
     * type LocationComponent = { location: Entity; sortIndex: number };
     * coordinator.registerComponent<LocationComponent>('LocationComponent');
     * const entity = coordinator.createEntity();
     * coordinator.addComponentToEntity('LocationComponent', entity, { 
     *   location: otherEntity, 
     *   sortIndex: 0 
     * });
     * const fieldNames2 = coordinator.getComponentPropertyNames('LocationComponent');
     * console.log(fieldNames2); // ['location', 'sortIndex']
     * ```
     */
    getComponentPropertyNames(componentName: ComponentName): string[] {
        // First, try to get from schema if available
        const schema = this.getComponentSchema(componentName);
        if (schema) {
            return schema.fields.map(field => field.name);
        }
        
        // If no schema, try to extract from an actual component instance
        const entitiesWithComponent = this._componentManager.getAllEntitiesWithComponent(componentName);
        if (entitiesWithComponent.length === 0) {
            return [];
        }
        
        // Get the first entity's component instance
        const component = this._componentManager.getComponentFromEntity(componentName, entitiesWithComponent[0]);
        if (component === null) {
            return [];
        }
        
        // Extract property names from the component object
        if (typeof component === 'object' && component !== null && !Array.isArray(component)) {
            return Object.keys(component);
        }
        
        return [];
    }

    /**
     * Get all registered component schemas.
     * 
     * @returns Array of all component schemas
     */
    getAllComponentSchemas(): ComponentSchema[] {
        return this._componentManager.getAllComponentSchemas();
    }

    /**
     * Create a component instance from a schema with default values.
     * 
     * @param componentName - The name of the component type
     * @param overrides - Optional values to override defaults
     * @returns A component instance with all fields initialized
     * @throws Error if component is not registered with a schema
     * 
     * @example
     * ```typescript
     * // Create component with all defaults
     * const component1 = coordinator.createComponentFromSchema('PlayerStats');
     * 
     * // Create component with some overrides
     * const component2 = coordinator.createComponentFromSchema('PlayerStats', {
     *   health: 200,
     *   name: 'SuperPlayer'
     * });
     * ```
     */
    createComponentFromSchema(componentName: ComponentName, overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return this._componentManager.createComponentFromSchema(componentName, overrides);
    }

    /**
     * Validate component data against its schema.
     * 
     * @param componentName - The name of the component type
     * @param data - The component data to validate
     * @returns true if valid, false otherwise
     */
    validateComponentData(componentName: ComponentName, data: unknown): boolean {
        return this._componentManager.validateComponentData(componentName, data);
    }

    /**
     * Add a component to an entity with schema validation.
     * 
     * @param componentName - The name of the component type
     * @param entity - The entity to add the component to
     * @param component - The component data
     * @param validate - Whether to validate against schema (default: true)
     * @throws Error if validation fails
     */
    addComponentToEntityWithSchema(componentName: ComponentName, entity: Entity, component: Record<string, unknown>, validate: boolean = true): void {
        this._componentManager.addComponentToEntityWithSchema(componentName, entity, component, validate);
        let signature = this._entityManager.getSignature(entity);
        if(signature === null) {
            signature = 0;
        }
        const componentType = this._componentManager.getComponentType(componentName);
        if(componentType === null) {
            console.warn(`Component ${getComponentNameString(componentName)} not registered`);
            return;
        }
        signature |= 1 << componentType;
        this._entityManager.setSignature(entity, signature);
        this._systemManager.entitySignatureChanged(entity, signature);
    }

    /**
     * Get all living entities in the ECS.
     * @returns Array of all entity IDs that are currently active
     * 
     * @example
     * ```typescript
     * const entities = coordinator.getAllEntities();
     * console.log(`Total entities: ${entities.length}`);
     * ```
     */
    getAllEntities(): Entity[] {
        return this._entityManager.getAllLivingEntities();
    }

    /**
     * Check if an entity exists in the coordinator.
     * @param entity - The entity ID to check
     * @returns true if the entity exists, false otherwise
     * 
     * @example
     * ```typescript
     * const entity = coordinator.createEntity();
     * if (coordinator.entityExists(entity)) {
     *   console.log('Entity exists');
     * }
     * 
     * coordinator.destroyEntity(entity);
     * if (!coordinator.entityExists(entity)) {
     *   console.log('Entity no longer exists');
     * }
     * ```
     */
    entityExists(entity: Entity): boolean {
        return this._entityManager.entityExists(entity);
    }

    /**
     * Get all components for a specific entity.
     * @param entity - The entity ID
     * @returns Map of component names to their data, or null if entity doesn't exist
     * 
     * @example
     * ```typescript
     * const components = coordinator.getEntityComponents(entity);
     * if (components) {
     *   console.log('Entity components:', components);
     * }
     * ```
     */
    getEntityComponents(entity: Entity): Map<ComponentName, unknown> | null {
        const signature = this._entityManager.getSignature(entity);
        if (signature === null || signature === 0) {
            return null;
        }

        const components = new Map<ComponentName, unknown>();
        const componentNames = this._componentManager.getRegisteredComponentNames();

        for (const componentName of componentNames) {
            const componentType = this._componentManager.getComponentType(componentName);
            if (componentType === null) {
                continue;
            }

            // Check if entity has this component (bit is set in signature)
            if ((signature & (1 << componentType)) !== 0) {
                const componentData = this._componentManager.getComponentFromEntity(componentName, entity);
                if (componentData !== null) {
                    components.set(componentName, componentData);
                }
            }
        }

        return components;
    }

    /**
     * Get the entire state of the ECS: all entities with all their component values.
     * @returns Object containing all entities and their components
     * 
     * @example
     * ```typescript
     * const state = coordinator.getFullState();
     * console.log(`Total entities: ${state.entities.length}`);
     * state.entities.forEach(entityData => {
     *   console.log(`Entity ${entityData.entity} has ${Object.keys(entityData.components).length} components`);
     * });
     * ```
     */
    getFullState(): { entities: Array<{ entity: Entity; components: Map<ComponentName, unknown> }> } {
        const allEntities = this.getAllEntities();
        const entities = allEntities.map(entity => ({
            entity,
            components: this.getEntityComponents(entity) ?? new Map<ComponentName, unknown>()
        }));

        return { entities };
    }

    /**
     * Serialize the entire ECS state to a JSON-compatible format.
     * Note: Only works with global symbols (created via Symbol.for or createGlobalComponentName).
     * 
     * @returns A serializable representation of the ECS state
     * @throws Error if any component name is not a global symbol
     * 
     * @example
     * ```typescript
     * const serialized = coordinator.serialize();
     * const json = JSON.stringify(serialized);
     * // Save to file or send over network
     * ```
     */
    serialize(): SerializedECSState {
        const allEntities = this.getAllEntities();
        const serializedEntities: SerializedEntity[] = [];
        const componentNames = this._componentManager.getRegisteredComponentNames();

        for (const entity of allEntities) {
            const components: Record<string, unknown> = {};
            let hasComponents = false;

            for (const componentName of componentNames) {
                const componentData = this._componentManager.getComponentFromEntity(componentName, entity);
                if (componentData !== null) {
                    const key = Symbol.keyFor(componentName);
                    if (key === undefined) {
                        throw new Error(
                            `Cannot serialize: component name "${getComponentNameString(componentName)}" is not a global symbol. ` +
                            `Use createGlobalComponentName() or Symbol.for() to create component names.`
                        );
                    }
                    components[key] = componentData;
                    hasComponents = true;
                }
            }

            // Only include entities that have at least one component
            if (hasComponents) {
                serializedEntities.push({
                    entity,
                    components
                });
            }
        }

        // Optionally include schemas
        const schemas = this._componentManager.getAllComponentSchemas();
        const serializedSchemas = schemas.length > 0
            ? schemas.map(schema => serializeComponentSchema(schema))
            : undefined;

        return {
            entities: serializedEntities,
            ...(serializedSchemas && { schemas: serializedSchemas })
        };
    }

    /**
     * Deserialize an ECS state from a JSON-compatible format.
     * This will restore all entities and their components.
     * 
     * @param serialized - The serialized ECS state
     * @param options - Options for deserialization
     * @param options.clearExisting - Whether to clear existing entities before deserializing (default: false)
     * @throws Error if component names cannot be resolved or components are not registered
     * 
     * @example
     * ```typescript
     * const json = fs.readFileSync('state.json', 'utf-8');
     * const serialized = JSON.parse(json);
     * coordinator.deserialize(serialized, { clearExisting: true });
     * ```
     */
    deserialize(serialized: SerializedECSState, options: { clearExisting?: boolean } = {}): void {
        const { clearExisting = false } = options;

        if (clearExisting) {
            // Destroy all existing entities
            const existingEntities = this.getAllEntities();
            for (const entity of existingEntities) {
                this.destroyEntity(entity);
            }
        }

        // Restore entities and components
        for (const entityData of serialized.entities) {
            // Create entity (or reuse if not clearing)
            let entity: Entity;
            if (clearExisting) {
                entity = this.createEntity();
            } else {
                // Try to use the original entity ID if available
                // If entity already exists, we'll update it; otherwise create new
                const existingSignature = this._entityManager.getSignature(entityData.entity);
                if (existingSignature === null) {
                    // Entity doesn't exist, we need to create it
                    // But we can't control the entity ID, so we'll create a new one
                    entity = this.createEntity();
                } else {
                    entity = entityData.entity;
                }
            }

            // Add all components
            for (const [componentNameStr, componentData] of Object.entries(entityData.components)) {
                const componentName = Symbol.for(componentNameStr);
                
                // Check if component is registered
                const componentType = this._componentManager.getComponentType(componentName);
                if (componentType === null) {
                    throw new Error(
                        `Cannot deserialize: component "${componentNameStr}" is not registered. ` +
                        `Register it first using registerComponent() or registerComponentWithSchema().`
                    );
                }

                // Add component (with schema validation if schema exists)
                const schema = this._componentManager.getComponentSchema(componentName);
                if (schema) {
                    this.addComponentToEntityWithSchema(
                        componentName,
                        entity,
                        componentData as Record<string, unknown>,
                        true
                    );
                } else {
                    this.addComponentToEntity(componentName, entity, componentData);
                }
            }
        }
    }
}
