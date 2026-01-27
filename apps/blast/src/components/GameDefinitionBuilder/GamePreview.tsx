/**
 * GamePreview - Validates game definition and manages GameEngine lifecycle.
 *
 * Provides the wrapper for the live game preview in the Game Definition Builder.
 * Handles validation errors gracefully and provides controls for starting new games.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { GameEngine } from '../../board-game-engine/game-engine';
import { GameDefinitionLoader } from '../../board-game-engine/schema/game-definition-loader';
import type { ValidationResult } from '../../board-game-engine/schema/types';
import { GenericGameUI } from './GenericGameUI';
import type { BuilderGameDefinition } from './types';

export interface GamePreviewProps {
    gameDefinition: BuilderGameDefinition;
}

export const GamePreview: React.FC<GamePreviewProps> = ({ gameDefinition }) => {
    const [engine, setEngine] = useState<GameEngine | null>(null);
    const [validationResult, setValidationResult] =
        useState<ValidationResult | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [renderKey, setRenderKey] = useState(0);
    const loaderRef = useRef<GameDefinitionLoader | null>(null);

    // Create a new game engine from the definition
    const createEngine = useCallback(() => {
        setLoadError(null);

        // Create a fresh loader for each engine creation
        const loader = new GameDefinitionLoader();
        loaderRef.current = loader;

        // First validate
        const validation = loader.validate(gameDefinition);
        setValidationResult(validation);

        if (!validation.valid) {
            setEngine(null);
            return;
        }

        try {
            // Load the game definition
            const loaded = loader.loadFromJSON(gameDefinition as any);

            // Create GameEngine with loaded rules
            const newEngine = new GameEngine({
                name: loaded.name,
                actions: loaded.actions,
                rules: loaded.rules,
                phases: loaded.phases,
                createInitialState: loaded.createInitialState,
            });

            setEngine(newEngine);
            setRenderKey(k => k + 1);
        } catch (error) {
            console.error('Failed to create game engine:', error);
            setLoadError(
                error instanceof Error
                    ? error.message
                    : 'Unknown error loading game'
            );
            setEngine(null);
        }
    }, [gameDefinition]);

    // Initialize on mount and when definition changes significantly
    useEffect(() => {
        createEngine();
    }, [createEngine]);

    // Force re-render when game state changes
    const handleStateChange = useCallback(() => {
        setRenderKey(k => k + 1);
    }, []);

    // Render validation errors
    if (validationResult && !validationResult.valid) {
        return (
            <div
                style={{
                    padding: '20px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '8px',
                    border: '1px solid #ffc107',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                    }}
                >
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        Cannot load game definition
                    </span>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <strong>Errors:</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        {validationResult.errors.map((error, idx) => (
                            <li
                                key={idx}
                                style={{
                                    color: '#856404',
                                    marginBottom: '4px',
                                }}
                            >
                                {error.message}
                                {error.path.length > 0 && (
                                    <span
                                        style={{
                                            color: '#999',
                                            marginLeft: '8px',
                                        }}
                                    >
                                        (at {error.path.join('.')})
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {validationResult.warnings.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <strong>Warnings:</strong>
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                            {validationResult.warnings.map((warning, idx) => (
                                <li
                                    key={idx}
                                    style={{
                                        color: '#666',
                                        marginBottom: '4px',
                                    }}
                                >
                                    {warning.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
                    Fix these errors in the other tabs to preview your game.
                </p>
            </div>
        );
    }

    // Render load error
    if (loadError) {
        return (
            <div
                style={{
                    padding: '20px',
                    backgroundColor: '#ffebee',
                    borderRadius: '8px',
                    border: '1px solid #f44336',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                    }}
                >
                    <span style={{ fontSize: '24px' }}>❌</span>
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        Failed to load game
                    </span>
                </div>

                <p style={{ color: '#c62828', marginBottom: '16px' }}>
                    {loadError}
                </p>

                <button
                    onClick={createEngine}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    Try Again
                </button>
            </div>
        );
    }

    // Render loading state
    if (!engine) {
        return (
            <div
                style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#666',
                }}
            >
                Loading game preview...
            </div>
        );
    }

    // Render game UI
    return (
        <div>
            {/* Controls */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                }}
            >
                <button
                    onClick={createEngine}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                    }}
                >
                    New Game
                </button>
                <button
                    onClick={createEngine}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                    }}
                >
                    Reset
                </button>
            </div>

            {/* Game UI */}
            <GenericGameUI
                key={renderKey}
                engine={engine}
                gameDefinition={gameDefinition}
                onStateChange={handleStateChange}
            />
        </div>
    );
};

export default GamePreview;
