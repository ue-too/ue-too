import { Coordinator, Entity, System, ComponentType, createGlobalComponentName, ComponentName, SystemName, createGlobalSystemName } from "@ue-too/ecs";
import { shuffle } from "./utils";

export interface Token {
    entityId: number;
}

export const LOCATION_COMPONENT: ComponentName = createGlobalComponentName("LocationComponent");

export const LOCATION_SYSTEM: SystemName = createGlobalSystemName("LocationSystem");
export const DECK_SYSTEM: SystemName = createGlobalSystemName("DeckSystem");
export const DECK_COMPONENT: ComponentName = createGlobalComponentName("DeckComponent");

export type LocationComponent = {
    location: number;
    sortIndex: number;
};

export type DeckComponent = {
    cached: {
        entities: number[];
    }
}

export class StackableTokenSystem implements System {
    entities: Set<Entity>;
    private _coordinator: Coordinator;

    constructor(coordinator: Coordinator){
        this.entities = new Set<Entity>();
        this._coordinator = coordinator;
        let locationComponentType = this._coordinator.getComponentType(LOCATION_COMPONENT);
        if(locationComponentType == undefined){
            this._coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
            locationComponentType = this._coordinator.getComponentType(LOCATION_COMPONENT);
        }
        if(locationComponentType == undefined){
            throw new Error('LocationComponent not registered');
        }
        let deckComponentType = this._coordinator.getComponentType(DECK_COMPONENT);
        if(deckComponentType == undefined){
            this._coordinator.registerComponent<DeckComponent>(DECK_COMPONENT);
            deckComponentType = this._coordinator.getComponentType(DECK_COMPONENT);
        }
        if(deckComponentType == undefined){
            throw new Error('DeckComponent not registered');
        }
        this._coordinator.registerSystem(DECK_SYSTEM, this);
        this._coordinator.setSystemSignature(DECK_SYSTEM, 1 << locationComponentType | 1 << deckComponentType);
    }

    shuffle(at: number): void {
        const entities = this._getSortedEntitiesWithLocation(at);
        const shuffledEntities = shuffle(entities.map(e => e.entity));
        for(let i = 0; i < shuffledEntities.length; i++){
            const entity = shuffledEntities[i];
            const location = this._coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
            if(!location) {
                throw new Error('Location component not found for entity ' + entity);
            }
            location.sortIndex = i;
        }
        this._cacheDeckOrder(at, shuffledEntities);
    }

    _cacheDeckOrder(atDeck: number, entities: number[]): void {
        const deck = this._coordinator.getComponentFromEntity<DeckComponent>(DECK_COMPONENT, atDeck);
        if(!deck) {
            throw new Error(atDeck + " is not a deck");
        }
        deck.cached.entities = entities;
    }

    _getSortedEntitiesWithLocation(atDeck: number): {entity: number, location: LocationComponent}[] {
        const entities: {entity: number, location: LocationComponent}[] = [];
        for(const entity of this.entities){
            const location = this._coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
            if(location?.location === atDeck) {
                entities.push({entity, location});
            }
        }
        entities.sort((a, b) => a.location.sortIndex - b.location.sortIndex);
        this._cacheDeckOrder(atDeck, entities.map(e => e.entity));
        return entities;
    }

    peek(atLocation: number, size: number): number | undefined {
        const deck = this._coordinator.getComponentFromEntity<DeckComponent>(DECK_COMPONENT, atLocation);
        if(!deck) {
            throw new Error(atLocation + " is not a deck, thus cannot be peeked");
        }
        return deck.cached.entities.length > 0 ? deck.cached.entities[0] : undefined;
    }

    pop(fromDeck: number, toLocation: number): Entity | undefined {
        const entities = this._getSortedEntitiesWithLocation(fromDeck);
        if(entities.length === 0) {
            return undefined;
        }
        const entity = entities[entities.length - 1];
        entity.location.location = toLocation;
        this._cacheDeckOrder(toLocation, [entity.entity]);
        return entity.entity;
    }

    addToBottomOf(deck: number, entity: Entity): void {
        const entityLocation = this._coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
        if(!entityLocation) {
            throw new Error(entity + " can not be in a location, thus cannot be added to " + deck);
        }
        const currentCachedEntitiesAtDeck = this._coordinator.getComponentFromEntity<DeckComponent>(DECK_COMPONENT, deck);
        if(!currentCachedEntitiesAtDeck) {
            throw new Error(deck + " is not a deck, thus cannot be added to");
        }
        const currentSize = currentCachedEntitiesAtDeck.cached.entities.length;
        const originalLocation = entityLocation.location;
        entityLocation.location = deck;
        entityLocation.sortIndex = currentSize;
        currentCachedEntitiesAtDeck.cached.entities.push(entity);
        this._getSortedEntitiesWithLocation(originalLocation);
    }

    addToTopOf(deck: number, entity: Entity): void {
        const entityLocation = this._coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
        if(!entityLocation) {
            throw new Error(entity + " can not be in a location, thus cannot be added to " + deck);
        }
        const currentCachedEntitiesAtDeck = this._coordinator.getComponentFromEntity<DeckComponent>(DECK_COMPONENT, deck);
        if(!currentCachedEntitiesAtDeck) {
            throw new Error(deck + " is not a deck, thus cannot be added to");
        }
        const originalLocation = entityLocation.location;
        
        // Increment sortIndex of all existing entities at the deck
        const existingEntities = this._getSortedEntitiesWithLocation(deck);
        for(const existingEntity of existingEntities) {
            existingEntity.location.sortIndex += 1;
        }
        
        entityLocation.location = deck;
        entityLocation.sortIndex = 0;
        this._getSortedEntitiesWithLocation(originalLocation);
        this._getSortedEntitiesWithLocation(deck);
    }

    transferToBottomOf(entities: Entity[], toDeck: number): void {
        for(const entity of entities) {
            this.addToBottomOf(toDeck, entity);
        }
    }

    transferToTopOf(entities: Entity[], toDeck: number): void {
        for(const entity of entities) {
            this.addToTopOf(toDeck, entity);
        }
    }

    getDeck(deck: number): Entity[] {
        const deckComponent = this._coordinator.getComponentFromEntity<DeckComponent>(DECK_COMPONENT, deck);
        if(!deckComponent) {
            throw new Error(deck + " is not a deck, thus cannot be gotten");
        }
        return deckComponent.cached.entities;
    }
}


