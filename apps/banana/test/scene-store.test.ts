import { describe, it, expect, beforeEach, mock } from 'bun:test';

import type { SceneStorage } from '../src/storage/scene-storage';

// ---------------------------------------------------------------------------
// In-memory storage used to verify the store's persistence side-effects
// ---------------------------------------------------------------------------

class InMemorySceneStorage implements SceneStorage {
    scenes = new Map<string, any>();
    meta = new Map<string, string>();

    async listScenes() {
        return [...this.scenes.values()]
            .map((s: any) => s.metadata)
            .sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    }
    async loadScene(id: string) {
        return this.scenes.get(id) ?? null;
    }
    async saveScene(scene: any) {
        this.scenes.set(scene.metadata.id, structuredClone(scene));
    }
    async deleteScene(id: string) {
        this.scenes.delete(id);
    }
    async getActiveSceneId() {
        return this.meta.get('active-scene-id') ?? null;
    }
    async setActiveSceneId(id: string | null) {
        if (id === null) this.meta.delete('active-scene-id');
        else this.meta.set('active-scene-id', id);
    }
    async getPreference(key: string) {
        return this.meta.get(`pref:${key}`) ?? null;
    }
    async setPreference(key: string, value: string) {
        this.meta.set(`pref:${key}`, value);
    }
}

// ---------------------------------------------------------------------------
// Mock the storage module so the store uses our in-memory implementation
// ---------------------------------------------------------------------------

const storage = new InMemorySceneStorage();

mock.module('@/storage', () => ({
    getSceneStorage: () => storage,
    SCENE_DATA_VERSION: 1,
}));

// Import AFTER mocking
const { useSceneStore } = await import('../src/stores/scene-store');

function resetStore() {
    useSceneStore.setState({
        activeSceneId: null,
        activeSceneName: 'Untitled Scene',
        scenePickerOpen: false,
        initialized: false,
        pendingSceneId: null,
        autoSaveIntervalMs: 3 * 60 * 1000,
    });
}

function resetStorage() {
    storage.scenes.clear();
    storage.meta.clear();
}

describe('scene-store', () => {
    beforeEach(() => {
        resetStore();
        resetStorage();
    });

    describe('initial state', () => {
        it('has correct defaults', () => {
            const state = useSceneStore.getState();
            expect(state.activeSceneId).toBeNull();
            expect(state.activeSceneName).toBe('Untitled Scene');
            expect(state.scenePickerOpen).toBe(false);
            expect(state.initialized).toBe(false);
            expect(state.pendingSceneId).toBeNull();
            expect(state.autoSaveIntervalMs).toBe(180_000);
        });
    });

    describe('setActiveScene', () => {
        it('updates scene id and name', () => {
            useSceneStore.getState().setActiveScene('abc', 'My Scene');
            const state = useSceneStore.getState();
            expect(state.activeSceneId).toBe('abc');
            expect(state.activeSceneName).toBe('My Scene');
        });

        it('persists active scene id to storage', async () => {
            useSceneStore.getState().setActiveScene('xyz', 'Test');
            // setActiveSceneId is fire-and-forget; await the promise
            await new Promise((r) => setTimeout(r, 0));
            expect(await storage.getActiveSceneId()).toBe('xyz');
        });
    });

    describe('scene picker', () => {
        it('showScenePicker opens the picker', () => {
            useSceneStore.getState().showScenePicker();
            expect(useSceneStore.getState().scenePickerOpen).toBe(true);
        });

        it('hideScenePicker closes the picker', () => {
            useSceneStore.setState({ scenePickerOpen: true });
            useSceneStore.getState().hideScenePicker();
            expect(useSceneStore.getState().scenePickerOpen).toBe(false);
        });
    });

    describe('pending scene', () => {
        it('setPendingSceneId sets the id', () => {
            useSceneStore.getState().setPendingSceneId('pending-1');
            expect(useSceneStore.getState().pendingSceneId).toBe('pending-1');
        });

        it('setPendingSceneId accepts null', () => {
            useSceneStore.setState({ pendingSceneId: 'some-id' });
            useSceneStore.getState().setPendingSceneId(null);
            expect(useSceneStore.getState().pendingSceneId).toBeNull();
        });

        it('clearPendingScene resets to null', () => {
            useSceneStore.setState({ pendingSceneId: 'some-id' });
            useSceneStore.getState().clearPendingScene();
            expect(useSceneStore.getState().pendingSceneId).toBeNull();
        });
    });

    describe('setAutoSaveIntervalMs', () => {
        it('updates the interval', () => {
            useSceneStore.getState().setAutoSaveIntervalMs(60_000);
            expect(useSceneStore.getState().autoSaveIntervalMs).toBe(60_000);
        });

        it('persists to storage', async () => {
            useSceneStore.getState().setAutoSaveIntervalMs(300_000);
            await new Promise((r) => setTimeout(r, 0));
            expect(await storage.getPreference('autoSaveIntervalMs')).toBe(
                '300000'
            );
        });
    });

    describe('initialize', () => {
        it('sets initialized to true with no saved data', async () => {
            await useSceneStore.getState().initialize();

            const state = useSceneStore.getState();
            expect(state.initialized).toBe(true);
            expect(state.scenePickerOpen).toBe(false);
            expect(state.autoSaveIntervalMs).toBe(180_000);
        });

        it('restores saved auto-save interval', async () => {
            await storage.setPreference('autoSaveIntervalMs', '60000');

            await useSceneStore.getState().initialize();

            expect(useSceneStore.getState().autoSaveIntervalMs).toBe(60_000);
        });

        it('ignores invalid saved interval', async () => {
            await storage.setPreference('autoSaveIntervalMs', 'not-a-number');

            await useSceneStore.getState().initialize();

            expect(useSceneStore.getState().autoSaveIntervalMs).toBe(180_000);
        });

        it('opens scene picker when scenes exist', async () => {
            await storage.saveScene({
                metadata: {
                    id: 's1',
                    name: 'Scene 1',
                    createdAt: 1000,
                    updatedAt: 2000,
                    version: 1,
                },
                data: { tracks: { joints: [], segments: [] }, trains: {} },
            });

            await useSceneStore.getState().initialize();

            expect(useSceneStore.getState().scenePickerOpen).toBe(true);
        });

        it('restores last active scene if found', async () => {
            await storage.saveScene({
                metadata: {
                    id: 's1',
                    name: 'Scene 1',
                    createdAt: 1000,
                    updatedAt: 1000,
                    version: 1,
                },
                data: { tracks: { joints: [], segments: [] }, trains: {} },
            });
            await storage.saveScene({
                metadata: {
                    id: 's2',
                    name: 'Scene 2',
                    createdAt: 2000,
                    updatedAt: 2000,
                    version: 1,
                },
                data: { tracks: { joints: [], segments: [] }, trains: {} },
            });
            await storage.setActiveSceneId('s2');

            await useSceneStore.getState().initialize();

            const state = useSceneStore.getState();
            expect(state.activeSceneId).toBe('s2');
            expect(state.activeSceneName).toBe('Scene 2');
            expect(state.scenePickerOpen).toBe(true);
        });

        it('does not set active scene if last active id not in list', async () => {
            await storage.saveScene({
                metadata: {
                    id: 's1',
                    name: 'Scene 1',
                    createdAt: 1000,
                    updatedAt: 1000,
                    version: 1,
                },
                data: { tracks: { joints: [], segments: [] }, trains: {} },
            });
            await storage.setActiveSceneId('deleted-id');

            await useSceneStore.getState().initialize();

            const state = useSceneStore.getState();
            expect(state.activeSceneId).toBeNull();
            expect(state.scenePickerOpen).toBe(true);
        });
    });

    describe('subscriptions', () => {
        it('notifies subscribers on state change', () => {
            const calls: any[] = [];
            const unsub = useSceneStore.subscribe((next, prev) => {
                calls.push({ next, prev });
            });

            useSceneStore.getState().setActiveScene('id1', 'Name');

            expect(calls).toHaveLength(1);
            expect(calls[0].next.activeSceneId).toBe('id1');
            expect(calls[0].prev.activeSceneId).toBeNull();

            unsub();
        });
    });
});
