import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the storage module before importing the store
const mockStorage = {
    listScenes: vi.fn(),
    loadScene: vi.fn(),
    saveScene: vi.fn(),
    deleteScene: vi.fn(),
    getActiveSceneId: vi.fn(),
    setActiveSceneId: vi.fn(),
    getPreference: vi.fn(),
    setPreference: vi.fn(),
};

vi.mock('@/storage', () => ({
    getSceneStorage: () => mockStorage,
}));

const { useSceneStore } = await import('../src/stores/scene-store');

// Helper to reset store to initial state between tests
const initialState = useSceneStore.getState();

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

describe('scene-store', () => {
    beforeEach(() => {
        resetStore();
        vi.clearAllMocks();
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

        it('persists active scene id to storage', () => {
            useSceneStore.getState().setActiveScene('xyz', 'Test');
            expect(mockStorage.setActiveSceneId).toHaveBeenCalledWith('xyz');
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

        it('persists to storage', () => {
            useSceneStore.getState().setAutoSaveIntervalMs(300_000);
            expect(mockStorage.setPreference).toHaveBeenCalledWith(
                'autoSaveIntervalMs',
                '300000'
            );
        });
    });

    describe('initialize', () => {
        it('sets initialized to true with no saved data', async () => {
            mockStorage.getPreference.mockResolvedValue(null);
            mockStorage.listScenes.mockResolvedValue([]);
            mockStorage.getActiveSceneId.mockResolvedValue(null);

            await useSceneStore.getState().initialize();

            const state = useSceneStore.getState();
            expect(state.initialized).toBe(true);
            expect(state.scenePickerOpen).toBe(false);
            expect(state.autoSaveIntervalMs).toBe(180_000);
        });

        it('restores saved auto-save interval', async () => {
            mockStorage.getPreference.mockResolvedValue('60000');
            mockStorage.listScenes.mockResolvedValue([]);
            mockStorage.getActiveSceneId.mockResolvedValue(null);

            await useSceneStore.getState().initialize();

            expect(useSceneStore.getState().autoSaveIntervalMs).toBe(60_000);
        });

        it('ignores invalid saved interval', async () => {
            mockStorage.getPreference.mockResolvedValue('not-a-number');
            mockStorage.listScenes.mockResolvedValue([]);
            mockStorage.getActiveSceneId.mockResolvedValue(null);

            await useSceneStore.getState().initialize();

            expect(useSceneStore.getState().autoSaveIntervalMs).toBe(180_000);
        });

        it('opens scene picker when scenes exist', async () => {
            mockStorage.getPreference.mockResolvedValue(null);
            mockStorage.listScenes.mockResolvedValue([
                { id: 's1', name: 'Scene 1' },
            ]);
            mockStorage.getActiveSceneId.mockResolvedValue(null);

            await useSceneStore.getState().initialize();

            expect(useSceneStore.getState().scenePickerOpen).toBe(true);
        });

        it('restores last active scene if found', async () => {
            mockStorage.getPreference.mockResolvedValue(null);
            mockStorage.listScenes.mockResolvedValue([
                { id: 's1', name: 'Scene 1' },
                { id: 's2', name: 'Scene 2' },
            ]);
            mockStorage.getActiveSceneId.mockResolvedValue('s2');

            await useSceneStore.getState().initialize();

            const state = useSceneStore.getState();
            expect(state.activeSceneId).toBe('s2');
            expect(state.activeSceneName).toBe('Scene 2');
            expect(state.scenePickerOpen).toBe(true);
        });

        it('does not set active scene if last active id not found in list', async () => {
            mockStorage.getPreference.mockResolvedValue(null);
            mockStorage.listScenes.mockResolvedValue([
                { id: 's1', name: 'Scene 1' },
            ]);
            mockStorage.getActiveSceneId.mockResolvedValue('deleted-id');

            await useSceneStore.getState().initialize();

            const state = useSceneStore.getState();
            expect(state.activeSceneId).toBeNull();
            expect(state.scenePickerOpen).toBe(true);
        });
    });

    describe('subscriptions', () => {
        it('notifies subscribers on state change', () => {
            const listener = vi.fn();
            const unsub = useSceneStore.subscribe(listener);

            useSceneStore.getState().setActiveScene('id1', 'Name');

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    activeSceneId: 'id1',
                    activeSceneName: 'Name',
                }),
                expect.objectContaining({
                    activeSceneId: null,
                })
            );

            unsub();
        });
    });
});
