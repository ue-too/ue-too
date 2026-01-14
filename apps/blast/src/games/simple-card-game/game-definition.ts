/**
 * Simple Card Game - Game Definition
 *
 * Sets up a minimal 2-player card game for testing the engine.
 */

import { Coordinator } from '@ue-too/ecs';
import { GameState, PLAYER_COMPONENT, ZONE_COMPONENT } from '../../board-game-engine/core/game-state';
import type { PlayerComponent, ZoneComponent } from '../../board-game-engine/core/game-state';
import {
  CARD_COMPONENT,
  RESOURCE_COMPONENT,
  OWNER_COMPONENT,
  registerCardGameComponents,
  type CardComponent,
  type ResourceComponent,
  type OwnerComponent,
} from './components';
import { GameEngine, type GameDefinition } from '../../board-game-engine/game-engine';
import { ActionDefinition } from '../../board-game-engine/action-system/action-definition';
import { EmitEvent, CustomEffect } from '../../board-game-engine/action-system/effects';
import { IsPlayerTurn, PhaseCheck } from '../../board-game-engine/action-system/preconditions';
import type { PhaseDefinition, Rule } from '../../board-game-engine/core/types';
import { EventPattern } from '../../board-game-engine/event-system';

/**
 * Create initial game state with 2 players.
 */
function createInitialState(): GameState {
  const coordinator = new Coordinator();

  // Register components
  registerCardGameComponents(coordinator);
  coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT);
  coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);

  // Create game state
  const state = new GameState(coordinator);

  // Create players
  const player1 = coordinator.createEntity();
  coordinator.addComponentToEntity<PlayerComponent>(PLAYER_COMPONENT, player1, {
    name: 'Player 1',
    playerNumber: 0,
  });
  coordinator.addComponentToEntity<ResourceComponent>(RESOURCE_COMPONENT, player1, {
    mana: 1,
    maxMana: 10,
    health: 20,
    maxHealth: 20,
  });

  const player2 = coordinator.createEntity();
  coordinator.addComponentToEntity<PlayerComponent>(PLAYER_COMPONENT, player2, {
    name: 'Player 2',
    playerNumber: 1,
  });
  coordinator.addComponentToEntity<ResourceComponent>(RESOURCE_COMPONENT, player2, {
    mana: 1,
    maxMana: 10,
    health: 20,
    maxHealth: 20,
  });

  // Set initial game state
  state.setCurrentPhase('Main');
  state.setTurnNumber(1);
  state.setActivePlayer(player1);

  return state;
}

/**
 * End Turn action - switches active player and advances turn.
 */
const endTurnAction = new ActionDefinition({
  name: 'EndTurn',
  preconditions: [new IsPlayerTurn()],
  costs: [],
  effects: [
    new CustomEffect((ctx) => {
      // Switch active player
      const players = ctx.state.getAllPlayers();
      const currentIndex = players.indexOf(ctx.state.activePlayer!);
      const nextIndex = (currentIndex + 1) % players.length;
      ctx.state.setActivePlayer(players[nextIndex]);

      // Increment turn if we wrapped around
      if (nextIndex === 0) {
        ctx.state.setTurnNumber(ctx.state.turnNumber + 1);
      }
    }),
    new EmitEvent('TurnEnded', (ctx) => ({
      playerId: ctx.actor,
      turnNumber: ctx.state.turnNumber,
    })),
  ],
  targetSelector: () => [[]],
  parameterGenerator: () => [{}],
  metadata: {
    displayName: 'End Turn',
    description: 'End your turn and pass to the next player',
  },
});

/**
 * Phases for the simple card game.
 */
const phases: PhaseDefinition[] = [
  {
    name: 'Main',
    allowedActionTypes: ['EndTurn'],
    autoAdvance: false,
    nextPhase: 'Main', // Stays in Main phase
    onEnter: (state) => {
      // Gain 1 mana at start of turn (up to max)
      const activePlayer = state.activePlayer;
      if (activePlayer) {
        const resources = state.coordinator.getComponentFromEntity<ResourceComponent>(
          RESOURCE_COMPONENT,
          activePlayer
        );
        if (resources && resources.mana < resources.maxMana) {
          resources.mana = Math.min(resources.mana + 1, resources.maxMana);
        }
      }
    },
  },
];

/**
 * Rules for the simple card game.
 */
const rules: Rule[] = [];

/**
 * Create the simple card game definition.
 */
export function createSimpleCardGame(): GameEngine {
  const gameDefinition: GameDefinition = {
    name: 'Simple Card Game',
    actions: [endTurnAction],
    rules: rules,
    phases: phases,
    createInitialState: createInitialState,
  };

  return new GameEngine(gameDefinition);
}
