/**
 * Game Definition Loader
 *
 * Loads JSON game definitions and converts them into playable games.
 */
import {
    type ComponentName,
    Coordinator,
    type Entity,
    createGlobalComponentName,
} from '@ue-too/ecs';

import {
    DECK_COMPONENT,
    GAME_MANAGER_COMPONENT,
    GAME_STATUS_COMPONENT,
    GameState,
    PLAYER_COMPONENT,
    ZONE_COMPONENT,
} from '../core/game-state';
import type { GameStatusComponent } from '../core/game-state';
import type {
    ActionDefinition,
    GameState as IGameState,
    PhaseDefinition,
    Rule,
} from '../core/types';
import { ExpressionResolver } from './expression-resolver';
import { ActionFactory } from './factories/action-factory';
import { EffectFactory } from './factories/effect-factory';
import { RuleFactory } from './factories/rule-factory';
import { WinConditionFactory } from './factories/win-condition-factory';
import type { WinCondition } from './factories/win-condition-factory';
import type {
    EffectDefinition,
    EntityTemplateDefinition,
    GameDefinitionSchema,
    PhaseDefinitionSchema,
    ResolverContext,
    SetupDefinitionSchema,
    ValidationError,
    ValidationResult,
} from './types';

/**
 * Result of loading a game definition.
 */
export interface LoadedGameDefinition {
    name: string;
    version: string;
    actions: ActionDefinition[];
    phases: PhaseDefinition[];
    rules: Rule[];
    winConditions?: WinCondition[];
    createInitialState: () => GameState;
}

/**
 * Loads JSON game definitions into playable game objects.
 */
export class GameDefinitionLoader {
    private componentNames: Map<string, ComponentName> = new Map();
    private actionFactory!: ActionFactory;
    private effectFactory!: EffectFactory;
    private ruleFactory!: RuleFactory;
    private winConditionFactory!: WinConditionFactory;
    private resolver!: ExpressionResolver;

    /**
     * Get a component name symbol from a string name.
     */
    private getComponentName(name: string): ComponentName {
        const existing = this.componentNames.get(name);
        if (existing) return existing;
        const componentName = createGlobalComponentName(name);
        this.componentNames.set(name, componentName);
        return componentName;
    }

    /**
     * Load a game definition from a JSON object.
     */
    loadFromJSON(json: GameDefinitionSchema): LoadedGameDefinition {
        // Validate first
        const validation = this.validate(json);
        if (!validation.valid) {
            const errorMessages = validation.errors
                .map(e => e.message)
                .join(', ');
            throw new Error(`Invalid game definition: ${errorMessages}`);
        }

        // Register component names
        this.registerComponentNames(json);

        // Create factories with component name mapping
        this.actionFactory = new ActionFactory(this.componentNames);
        this.effectFactory = new EffectFactory(this.componentNames);
        this.ruleFactory = new RuleFactory(this.componentNames);
        this.winConditionFactory = new WinConditionFactory(this.componentNames);
        this.resolver = new ExpressionResolver(this.componentNames);

        // Create actions
        const actions = this.actionFactory.createActions(json.actions);

        // Create phases
        const phases = this.createPhases(json.phases);

        // Create rules
        const rules = json.rules
            ? this.ruleFactory.createRules(json.rules)
            : [];

        // Create win conditions
        const winConditions = json.winConditions
            ? this.winConditionFactory.createWinConditions(json.winConditions)
            : undefined;

        // Create initial state factory
        const createInitialState = () => this.createInitialState(json);

        return {
            name: json.name,
            version: json.version,
            actions,
            phases,
            rules,
            winConditions,
            createInitialState,
        };
    }

    /**
     * Validate a game definition JSON.
     */
    validate(json: unknown): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        if (!json || typeof json !== 'object') {
            errors.push({
                code: 'INVALID_ROOT',
                message: 'Game definition must be an object',
                path: [],
                severity: 'error',
            });
            return { valid: false, errors, warnings };
        }

        const def = json as Record<string, unknown>;

        // Required fields
        if (!def.name || typeof def.name !== 'string') {
            errors.push({
                code: 'MISSING_NAME',
                message: 'Game definition must have a name',
                path: ['name'],
                severity: 'error',
            });
        }

        if (!def.version || typeof def.version !== 'string') {
            errors.push({
                code: 'MISSING_VERSION',
                message: 'Game definition must have a version',
                path: ['version'],
                severity: 'error',
            });
        }

        if (!def.components || typeof def.components !== 'object') {
            errors.push({
                code: 'MISSING_COMPONENTS',
                message: 'Game definition must have components',
                path: ['components'],
                severity: 'error',
            });
        }

        if (!def.actions || !Array.isArray(def.actions)) {
            errors.push({
                code: 'MISSING_ACTIONS',
                message: 'Game definition must have actions array',
                path: ['actions'],
                severity: 'error',
            });
        }

        if (!def.phases || !Array.isArray(def.phases)) {
            errors.push({
                code: 'MISSING_PHASES',
                message: 'Game definition must have phases array',
                path: ['phases'],
                severity: 'error',
            });
        }

        if (!def.setup || typeof def.setup !== 'object') {
            errors.push({
                code: 'MISSING_SETUP',
                message: 'Game definition must have setup',
                path: ['setup'],
                severity: 'error',
            });
        }

        // TODO: Add more detailed validation
        // - Check all component references exist
        // - Validate expressions
        // - Check for circular dependencies

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private registerComponentNames(json: GameDefinitionSchema): void {
        this.componentNames.clear();

        // Register built-in components
        this.componentNames.set('Zone', ZONE_COMPONENT);
        this.componentNames.set('DeckList', DECK_COMPONENT);
        this.componentNames.set('Player', PLAYER_COMPONENT);

        // Register game-specific components
        for (const componentName of Object.keys(json.components)) {
            const globalName = createGlobalComponentName(componentName);
            this.componentNames.set(componentName, globalName);
        }
    }

    private createPhases(
        phaseDefs: PhaseDefinitionSchema[]
    ): PhaseDefinition[] {
        return phaseDefs.map(def => {
            // Determine nextPhase: use provided value, or default to first phase, or undefined if none
            let nextPhase: string | undefined;
            if (
                typeof def.nextPhase === 'string' &&
                def.nextPhase.trim() !== ''
            ) {
                nextPhase = def.nextPhase;
            } else if (phaseDefs.length > 0) {
                // Default to first phase if nextPhase is not specified
                nextPhase = phaseDefs[0].name;
            }
            // If nextPhase is undefined, phase advancement will throw an error (which is safer than infinite loop)

            const phase: PhaseDefinition = {
                name: def.name,
                allowedActionTypes: def.allowedActions,
                autoAdvance: def.autoAdvance ?? false,
                nextPhase,
            };

            // Add onEnter effects
            if (def.onEnter && def.onEnter.length > 0) {
                phase.onEnter = state => {
                    this.executeSetupEffects(state, def.onEnter!);
                };
            }

            // Add onExit effects
            if (def.onExit && def.onExit.length > 0) {
                phase.onExit = state => {
                    this.executeSetupEffects(state, def.onExit!);
                };
            }

            return phase;
        });
    }

    private createInitialState(json: GameDefinitionSchema): GameState {
        const coordinator = new Coordinator();

        // Register all components
        for (const [name, def] of Object.entries(json.components)) {
            const globalName = this.getComponentName(name);
            coordinator.registerComponent(globalName);
        }

        // Register built-in components
        coordinator.registerComponent(ZONE_COMPONENT);
        coordinator.registerComponent(DECK_COMPONENT);
        coordinator.registerComponent(PLAYER_COMPONENT);
        coordinator.registerComponent<GameStatusComponent>(
            GAME_STATUS_COMPONENT
        );

        // Create game state
        const state = new GameState(coordinator);

        // Create players
        const setup = json.setup;
        const playerCount = setup.playerCount.min; // For now, use min players

        const players: Entity[] = [];
        for (let i = 0; i < playerCount; i++) {
            const player = this.createEntityFromTemplate(
                coordinator,
                json.entityTemplates[setup.perPlayer.template],
                {
                    playerName: `Player ${i + 1}`,
                    playerIndex: i + 1,
                }
            );

            // Ensure player has Player component
            if (!coordinator.getComponentFromEntity(PLAYER_COMPONENT, player)) {
                coordinator.addComponentToEntity(PLAYER_COMPONENT, player, {
                    name: `Player ${i + 1}`,
                    playerNumber: i + 1,
                });
            }

            players.push(player);
        }

        // Create per-player zones (zones without shared: true)
        for (const player of players) {
            for (const zoneName of setup.perPlayer.zones) {
                const zoneDef = json.zones[zoneName];
                // Only create if not a shared zone
                if (!zoneDef?.shared) {
                    this.createZone(
                        coordinator,
                        zoneName,
                        player,
                        zoneDef?.visibility ?? 'public'
                    );
                }
            }
        }

        // Create shared zones (zones with shared: true)
        for (const [zoneName, zoneDef] of Object.entries(json.zones)) {
            if (zoneDef.shared) {
                this.createZone(
                    coordinator,
                    zoneName,
                    null,
                    zoneDef.visibility ?? 'public'
                );
            }
        }

        // Create per-player starting entities in zones
        if (setup.perPlayer.startingEntities) {
            for (const player of players) {
                for (const entityConfig of setup.perPlayer.startingEntities) {
                    const template =
                        json.entityTemplates[entityConfig.template];
                    const zone = state.getZone(entityConfig.zone, player);
                    const count = entityConfig.count ?? 1;

                    for (let i = 0; i < count; i++) {
                        const entity = this.createEntityFromTemplate(
                            coordinator,
                            template,
                            {
                                owner: player,
                            }
                        );

                        // Add to zone
                        if (zone) {
                            this.addEntityToZone(coordinator, entity, zone);
                        }
                    }
                }
            }
        }

        // Create shared zone starting entities
        if (setup.sharedZoneEntities) {
            for (const entityConfig of setup.sharedZoneEntities) {
                const template = json.entityTemplates[entityConfig.template];
                const zone = state.getZone(entityConfig.zone, null); // null owner = shared zone
                const count = entityConfig.count ?? 1;

                for (let i = 0; i < count; i++) {
                    const entity = this.createEntityFromTemplate(
                        coordinator,
                        template,
                        {
                            owner: null, // Shared entities have no specific owner
                            index: i, // Pass index for grid positioning
                        }
                    );

                    // Add to shared zone
                    if (zone) {
                        this.addEntityToZone(coordinator, entity, zone);
                    }

                    // For tic-tac-toe: set grid positions (row 0-2, col 0-2)
                    // Calculate row and column from index
                    const row = Math.floor(i / 3);
                    const col = i % 3;

                    // Check if entity has GridLocation component and update it
                    const gridLocationComponent =
                        this.getComponentName('GridLocation');
                    const existingGridLoc = coordinator.getComponentFromEntity(
                        gridLocationComponent,
                        entity
                    );
                    if (existingGridLoc) {
                        coordinator.addComponentToEntity(
                            gridLocationComponent,
                            entity,
                            {
                                ...existingGridLoc,
                                row,
                                column: col,
                            }
                        );
                    }
                }
            }
        }

        // Set initial phase
        state.setCurrentPhase(setup.initialPhase);
        state.setTurnNumber(1);
        state.setActivePlayer(players[0]);

        // Initialize GameStatusComponent on game manager entity
        // Find the game manager entity (it has GAME_MANAGER_COMPONENT)
        const allEntities = coordinator.getAllEntities();
        const gameManagerEntity = allEntities.find(entity => {
            return (
                coordinator.getComponentFromEntity(
                    GAME_MANAGER_COMPONENT,
                    entity
                ) !== null
            );
        });

        if (gameManagerEntity !== undefined) {
            coordinator.addComponentToEntity<GameStatusComponent>(
                GAME_STATUS_COMPONENT,
                gameManagerEntity,
                {
                    isGameOver: false,
                    winner: null,
                }
            );
        }

        // Execute setup effects
        if (setup.setupEffects && setup.setupEffects.length > 0) {
            // Setup effects may use $eachPlayer to apply to all players
            for (const player of players) {
                this.executeSetupEffectsForPlayer(
                    state,
                    setup.setupEffects,
                    player
                );
            }
        }

        return state;
    }

    private createEntityFromTemplate(
        coordinator: Coordinator,
        template: EntityTemplateDefinition,
        params: Record<string, unknown>
    ): Entity {
        const entity = coordinator.createEntity();

        for (const [compName, compData] of Object.entries(
            template.components
        )) {
            const globalName = this.getComponentName(compName);

            // Resolve any expressions in component data
            const resolvedData: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(compData)) {
                if (typeof value === 'string' && value.startsWith('$param.')) {
                    const paramName = value.substring(7);
                    resolvedData[key] = params[paramName];
                } else {
                    resolvedData[key] = value;
                }
            }

            coordinator.addComponentToEntity(globalName, entity, resolvedData);
        }

        return entity;
    }

    private createZone(
        coordinator: Coordinator,
        name: string,
        owner: Entity | null,
        visibility: string
    ): Entity {
        const zone = coordinator.createEntity();

        coordinator.addComponentToEntity(ZONE_COMPONENT, zone, {
            name,
            owner,
            visibility,
        });

        coordinator.addComponentToEntity(DECK_COMPONENT, zone, {
            cached: { entities: [] },
        });

        return zone;
    }

    private addEntityToZone(
        coordinator: Coordinator,
        entity: Entity,
        zone: Entity
    ): void {
        // Add location component
        const locationComponent = this.getComponentName('Location');
        coordinator.addComponentToEntity(locationComponent, entity, {
            location: zone,
            sortIndex: 0,
        });

        // Update zone's entity list
        const deckComp = coordinator.getComponentFromEntity(
            DECK_COMPONENT,
            zone
        ) as { cached: { entities: Entity[] } } | null;

        if (deckComp?.cached?.entities) {
            deckComp.cached.entities.push(entity);
        }
    }

    private executeSetupEffects(
        state: IGameState,
        effects: EffectDefinition[]
    ): void {
        const createdEffects = this.effectFactory.createEffects(effects);

        // Create a minimal action context for setup effects
        const context = {
            state,
            action: {
                type: 'Setup',
                actorId: 0,
                targetIds: [],
                parameters: {},
            },
            actor: state.activePlayer,
            targets: [],
            parameters: {},
            getComponent: <T>(name: ComponentName, entity: Entity) =>
                state.coordinator.getComponentFromEntity(
                    name,
                    entity
                ) as T | null,
            setComponent: <T extends object>(
                name: ComponentName,
                entity: Entity,
                data: T
            ) => state.coordinator.addComponentToEntity(name, entity, data),
            removeComponent: <T>(name: ComponentName, entity: Entity) =>
                state.coordinator.removeComponentFromEntity<T>(name, entity),
            getAllEntities: () => state.coordinator.getAllEntities(),
            createEntity: () => state.coordinator.createEntity(),
            destroyEntity: (entity: Entity) =>
                state.coordinator.destroyEntity(entity),
        };

        for (const effect of createdEffects) {
            effect.apply(context as any);
        }
    }

    private executeSetupEffectsForPlayer(
        state: IGameState,
        effects: EffectDefinition[],
        player: Entity
    ): void {
        const createdEffects = this.effectFactory.createEffects(effects);

        // Create context with eachPlayer set
        const context = {
            state,
            action: {
                type: 'Setup',
                actorId: player,
                targetIds: [],
                parameters: {},
            },
            actor: player,
            targets: [],
            parameters: {},
            eachPlayer: player,
            getComponent: <T>(name: ComponentName, entity: Entity) =>
                state.coordinator.getComponentFromEntity(
                    name,
                    entity
                ) as T | null,
            setComponent: <T extends object>(
                name: ComponentName,
                entity: Entity,
                data: T
            ) => state.coordinator.addComponentToEntity(name, entity, data),
            removeComponent: <T>(name: ComponentName, entity: Entity) =>
                state.coordinator.removeComponentFromEntity<T>(name, entity),
            getAllEntities: () => state.coordinator.getAllEntities(),
            createEntity: () => state.coordinator.createEntity(),
            destroyEntity: (entity: Entity) =>
                state.coordinator.destroyEntity(entity),
        };

        for (const effect of createdEffects) {
            effect.apply(context as any);
        }
    }
}
