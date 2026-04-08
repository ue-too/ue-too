import type { SerializedSceneData } from '@/scene-serialization';

export type SceneMetadata = {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    version: number;
};

export type StoredScene = {
    metadata: SceneMetadata;
    data: SerializedSceneData;
};

/**
 * Abstract storage interface for scene persistence.
 * Backed by IndexedDB locally; can be swapped to online storage.
 */
export interface SceneStorage {
    /** List all saved scene metadata (without the heavy scene data). */
    listScenes(): Promise<SceneMetadata[]>;
    /** Load a full scene by ID. Returns null if not found. */
    loadScene(id: string): Promise<StoredScene | null>;
    /** Save a scene (create or update). */
    saveScene(scene: StoredScene): Promise<void>;
    /** Delete a scene by ID. */
    deleteScene(id: string): Promise<void>;
    /** Get the ID of the last active scene. */
    getActiveSceneId(): Promise<string | null>;
    /** Set (or clear) the active scene ID. */
    setActiveSceneId(id: string | null): Promise<void>;
    /** Get a persisted preference value. */
    getPreference(key: string): Promise<string | null>;
    /** Set a persisted preference value. */
    setPreference(key: string, value: string): Promise<void>;
}

export const SCENE_DATA_VERSION = 1;
