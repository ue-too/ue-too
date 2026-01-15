/**
 * Example: Running the Game Engine Headless on a Server
 * 
 * This demonstrates how to use the game engine without any UI,
 * perfect for server-side game logic, AI, or API endpoints.
 */

import { GameEngine } from '../game-engine';
import { GameDefinitionLoader } from '../schema/game-definition-loader';
import type { GameDefinitionSchema } from '../schema/types';
import type { Action } from '../core/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load a game from a JSON object and create a GameEngine instance.
 * 
 * @param gameDefinitionJson - The game definition JSON object
 * @returns A fully initialized GameEngine ready to use
 */
export function loadGameFromJSON(gameDefinitionJson: GameDefinitionSchema): GameEngine {
  // Load game definition
  const loader = new GameDefinitionLoader();
  const loadedDefinition = loader.loadFromJSON(gameDefinitionJson);

  // Create game engine
  const engine = new GameEngine({
    name: loadedDefinition.name,
    actions: loadedDefinition.actions,
    phases: loadedDefinition.phases,
    rules: loadedDefinition.rules,
    winConditions: loadedDefinition.winConditions,
    createInitialState: loadedDefinition.createInitialState,
  });

  return engine;
}

/**
 * Load a game from a JSON file (Node.js only).
 * 
 * @param jsonFilePath - Path to the game definition JSON file
 * @returns A fully initialized GameEngine ready to use
 */
export function loadGameFromJSONFile(jsonFilePath: string): GameEngine {
  // In Node.js environment
  const fs = require('fs');
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
  const gameDefinitionJson: GameDefinitionSchema = JSON.parse(jsonContent);
  return loadGameFromJSON(gameDefinitionJson);
}

/**
 * Example: Server-side game session handler
 */
export class GameSession {
  private engine: GameEngine;
  private sessionId: string;

  constructor(jsonFilePath: string, sessionId: string) {
    this.engine = loadGameFromJSONFile(jsonFilePath);
    this.sessionId = sessionId;
  }

  /**
   * Get current game state (for API responses)
   */
  getGameState() {
    const players = this.engine.state.getAllPlayers();
    const currentPlayer = this.engine.getCurrentPlayer();
    
    return {
      sessionId: this.sessionId,
      gameName: this.engine.gameName,
      turnNumber: this.engine.getTurnNumber(),
      currentPhase: this.engine.getCurrentPhase(),
      activePlayer: currentPlayer,
      players: players.map((player, index) => ({
        id: player,
        index,
        // Add any player-specific data you want to expose
      })),
      isGameOver: this.engine.isGameOver(),
      winner: this.engine.isGameOver() ? this.engine.getWinner() : null,
    };
  }

  /**
   * Get valid actions for a player
   */
  getValidActions(playerId: number) {
    const players = this.engine.state.getAllPlayers();
    const player = players[playerId];
    
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    return this.engine.getValidActionsForPlayer(player);
  }

  /**
   * Execute an action (from API request)
   */
  performAction(action: Action) {
    // Validate action is valid
    const validActions = this.engine.getValidActions();
    const isValid = validActions.some(
      (a) =>
        a.type === action.type &&
        a.actorId === action.actorId &&
        JSON.stringify(a.targetIds) === JSON.stringify(action.targetIds)
    );

    if (!isValid) {
      throw new Error(`Invalid action: ${action.type}`);
    }

    // Execute action
    this.engine.performAction(action);

    // Return updated state
    return {
      success: true,
      gameState: this.getGameState(),
    };
  }

  /**
   * Serialize game state (for saving/loading)
   */
  serialize() {
    const snapshot = this.engine.state.createSnapshot();
    return {
      sessionId: this.sessionId,
      snapshot: snapshot.toJSON(),
      gameName: this.engine.gameName,
    };
  }
}

/**
 * Example: Express.js API endpoint handler
 */
export function createGameAPIHandler(jsonFilePath: string) {
  const sessions = new Map<string, GameSession>();

  return {
    /**
     * Create a new game session
     */
    createSession(sessionId: string): GameSession {
      const session = new GameSession(jsonFilePath, sessionId);
      sessions.set(sessionId, session);
      return session;
    },

    /**
     * Get a game session
     */
    getSession(sessionId: string): GameSession | undefined {
      return sessions.get(sessionId);
    },

    /**
     * Example Express route handlers
     */
    routes: {
      // GET /api/game/:sessionId/state
      getState: (req: any, res: any) => {
        const session = sessions.get(req.params.sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        res.json(session.getGameState());
      },

      // GET /api/game/:sessionId/actions/:playerId
      getActions: (req: any, res: any) => {
        const session = sessions.get(req.params.sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        try {
          const actions = session.getValidActions(parseInt(req.params.playerId));
          res.json({ actions });
        } catch (error) {
          res.status(400).json({ error: (error as Error).message });
        }
      },

      // POST /api/game/:sessionId/action
      performAction: (req: any, res: any) => {
        const session = sessions.get(req.params.sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
        try {
          const result = session.performAction(req.body);
          res.json(result);
        } catch (error) {
          res.status(400).json({ error: (error as Error).message });
        }
      },
    },
  };
}

/**
 * Example: Simple Node.js script usage
 */
export function exampleUsage() {
  // Load game from JSON (in Node.js, you can use loadGameFromJSONFile)
  // For this example, we'll load from a JSON object directly
  const gameDefinitionJson: GameDefinitionSchema = {
    name: 'Example Game',
    version: '1.0.0',
    components: {},
    zones: {},
    entityTemplates: {},
    actions: [],
    phases: [{ name: 'Main', allowedActions: [], autoAdvance: false }],
    setup: {
      playerCount: { min: 2, max: 2 },
      initialPhase: 'Main',
      perPlayer: { template: 'Player', zones: [] },
    },
  };

  const engine = loadGameFromJSON(gameDefinitionJson);

  console.log(`Loaded game: ${engine.gameName}`);
  console.log(`Current phase: ${engine.getCurrentPhase()}`);
  console.log(`Turn: ${engine.getTurnNumber()}`);

  // Get valid actions
  const validActions = engine.getValidActions();
  console.log(`Valid actions: ${validActions.length}`);

  // Execute an action
  if (validActions.length > 0) {
    const action = validActions[0];
    console.log(`Executing action: ${action.type}`);
    engine.performAction(action);
    console.log(`After action - Phase: ${engine.getCurrentPhase()}`);
  }

  // Check game over
  if (engine.isGameOver()) {
    console.log(`Game over! Winner: ${engine.getWinner()}`);
  }
}
