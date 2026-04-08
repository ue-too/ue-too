import { describe, it, expect, beforeEach } from 'bun:test';

import type {
    SceneMetadata,
    SceneStorage,
    StoredScene,
} from '../src/storage/scene-storage';
import { SCENE_DATA_VERSION } from '../src/storage/scene-storage';

// ---------------------------------------------------------------------------
// In-memory SceneStorage implementation for testing the contract
// ---------------------------------------------------------------------------

class InMemorySceneStorage implements SceneStorage {
    private scenes = new Map<string, StoredScene>();
    private meta = new Map<string, string>();

    async listScenes(): Promise<SceneMetadata[]> {
        return [...this.scenes.values()]
            .map((s) => s.metadata)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async loadScene(id: string): Promise<StoredScene | null> {
        return this.scenes.get(id) ?? null;
    }

    async saveScene(scene: StoredScene): Promise<void> {
        this.scenes.set(scene.metadata.id, structuredClone(scene));
    }

    async deleteScene(id: string): Promise<void> {
        this.scenes.delete(id);
    }

    async getActiveSceneId(): Promise<string | null> {
        return this.meta.get('active-scene-id') ?? null;
    }

    async setActiveSceneId(id: string | null): Promise<void> {
        if (id === null) {
            this.meta.delete('active-scene-id');
        } else {
            this.meta.set('active-scene-id', id);
        }
    }

    async getPreference(key: string): Promise<string | null> {
        return this.meta.get(`pref:${key}`) ?? null;
    }

    async setPreference(key: string, value: string): Promise<void> {
        this.meta.set(`pref:${key}`, value);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(
    id: string,
    name: string,
    updatedAt = Date.now()
): StoredScene {
    return {
        metadata: {
            id,
            name,
            createdAt: updatedAt - 1000,
            updatedAt,
            version: SCENE_DATA_VERSION,
        },
        data: {
            tracks: { joints: [], segments: [] },
            trains: {
                cars: [],
                formations: [],
                carStockIds: [],
                formationManagerIds: [],
                placedTrains: [],
            },
        } as any,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SceneStorage (in-memory)', () => {
    let storage: InMemorySceneStorage;

    beforeEach(() => {
        storage = new InMemorySceneStorage();
    });

    describe('scene CRUD', () => {
        it('starts with no scenes', async () => {
            const scenes = await storage.listScenes();
            expect(scenes).toEqual([]);
        });

        it('saves and loads a scene', async () => {
            const scene = makeScene('s1', 'First Scene');
            await storage.saveScene(scene);

            const loaded = await storage.loadScene('s1');
            expect(loaded).not.toBeNull();
            expect(loaded!.metadata.id).toBe('s1');
            expect(loaded!.metadata.name).toBe('First Scene');
            expect(loaded!.data).toEqual(scene.data);
        });

        it('returns null for nonexistent scene', async () => {
            const loaded = await storage.loadScene('nonexistent');
            expect(loaded).toBeNull();
        });

        it('lists scenes sorted by updatedAt descending', async () => {
            await storage.saveScene(makeScene('old', 'Old', 1000));
            await storage.saveScene(makeScene('new', 'New', 3000));
            await storage.saveScene(makeScene('mid', 'Mid', 2000));

            const list = await storage.listScenes();
            expect(list.map((s) => s.id)).toEqual(['new', 'mid', 'old']);
        });

        it('overwrites existing scene on save', async () => {
            await storage.saveScene(makeScene('s1', 'Original'));
            await storage.saveScene(makeScene('s1', 'Updated'));

            const loaded = await storage.loadScene('s1');
            expect(loaded!.metadata.name).toBe('Updated');

            const list = await storage.listScenes();
            expect(list).toHaveLength(1);
        });

        it('deletes a scene', async () => {
            await storage.saveScene(makeScene('s1', 'Scene'));
            await storage.deleteScene('s1');

            expect(await storage.loadScene('s1')).toBeNull();
            expect(await storage.listScenes()).toHaveLength(0);
        });

        it('delete is idempotent for nonexistent id', async () => {
            // Should not throw
            await storage.deleteScene('nonexistent');
        });
    });

    describe('active scene ID', () => {
        it('starts with null active scene', async () => {
            expect(await storage.getActiveSceneId()).toBeNull();
        });

        it('sets and gets active scene id', async () => {
            await storage.setActiveSceneId('s1');
            expect(await storage.getActiveSceneId()).toBe('s1');
        });

        it('clears active scene id with null', async () => {
            await storage.setActiveSceneId('s1');
            await storage.setActiveSceneId(null);
            expect(await storage.getActiveSceneId()).toBeNull();
        });

        it('overwrites previous active scene id', async () => {
            await storage.setActiveSceneId('s1');
            await storage.setActiveSceneId('s2');
            expect(await storage.getActiveSceneId()).toBe('s2');
        });
    });

    describe('preferences', () => {
        it('returns null for unset preference', async () => {
            expect(await storage.getPreference('anything')).toBeNull();
        });

        it('sets and gets a preference', async () => {
            await storage.setPreference('autoSaveIntervalMs', '60000');
            expect(await storage.getPreference('autoSaveIntervalMs')).toBe(
                '60000'
            );
        });

        it('overwrites existing preference', async () => {
            await storage.setPreference('key', 'old');
            await storage.setPreference('key', 'new');
            expect(await storage.getPreference('key')).toBe('new');
        });

        it('preferences are independent of each other', async () => {
            await storage.setPreference('a', '1');
            await storage.setPreference('b', '2');
            expect(await storage.getPreference('a')).toBe('1');
            expect(await storage.getPreference('b')).toBe('2');
        });

        it('preferences are independent of active scene id', async () => {
            await storage.setActiveSceneId('s1');
            await storage.setPreference('key', 'val');
            await storage.setActiveSceneId(null);
            expect(await storage.getPreference('key')).toBe('val');
        });
    });

    describe('scene data integrity', () => {
        it('saved data is a deep copy (mutations do not affect stored data)', async () => {
            const scene = makeScene('s1', 'Scene');
            await storage.saveScene(scene);

            // Mutate the original
            (scene.data as any).tracks.joints.push({ id: 99 });

            const loaded = await storage.loadScene('s1');
            expect((loaded!.data as any).tracks.joints).toHaveLength(0);
        });
    });
});
