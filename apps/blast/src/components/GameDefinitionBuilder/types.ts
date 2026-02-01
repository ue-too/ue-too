/**
 * Shared types for the Game Definition Builder.
 */
import type {
    ActionDefinitionSchema,
    ComponentDefinition,
    EntityTemplateDefinition,
    PhaseDefinitionSchema,
    SetupDefinitionSchema,
    ZoneDefinition,
} from '../../board-game-engine/schema/types';

// Extended metadata that includes fields from the JSON schema but not in TypeScript types
export interface ExtendedMetadata {
    author?: string;
    description?: string;
    minPlayers?: number;
    maxPlayers?: number;
    estimatedDuration?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    tags?: string[];
}

// Extended game definition that includes all fields for the builder
export interface BuilderGameDefinition {
    $schema?: string;
    name: string;
    version: string;
    metadata?: ExtendedMetadata;
    components: Record<string, ComponentDefinition>;
    zones: Record<string, ZoneDefinition>;
    entityTemplates: Record<string, EntityTemplateDefinition>;
    actions: ActionDefinitionSchema[];
    phases: PhaseDefinitionSchema[];
    rules?: unknown[];
    setup: SetupDefinitionSchema;
    winConditions?: unknown[];
}
