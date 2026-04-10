import { META_STORE, SCENES_STORE, openBananaDb, tx } from './idb';
import type { SceneMetadata, SceneStorage, StoredScene } from './scene-storage';

export class IdbSceneStorage implements SceneStorage {
    private getDb(): Promise<IDBDatabase> {
        return openBananaDb();
    }

    async listScenes(): Promise<SceneMetadata[]> {
        const db = await this.getDb();
        const all = await tx<StoredScene[]>(db, SCENES_STORE, 'readonly', s =>
            s.getAll()
        );
        return all
            .map(scene => scene.metadata)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async loadScene(id: string): Promise<StoredScene | null> {
        const db = await this.getDb();
        const result = await tx<StoredScene | undefined>(
            db,
            SCENES_STORE,
            'readonly',
            s => s.get(id)
        );
        return result ?? null;
    }

    async saveScene(scene: StoredScene): Promise<void> {
        const db = await this.getDb();
        await tx(db, SCENES_STORE, 'readwrite', s => s.put(scene));
    }

    async deleteScene(id: string): Promise<void> {
        const db = await this.getDb();
        await tx(db, SCENES_STORE, 'readwrite', s => s.delete(id));
    }

    async getActiveSceneId(): Promise<string | null> {
        const db = await this.getDb();
        const result = await tx<string | undefined>(
            db,
            META_STORE,
            'readonly',
            s => s.get('active-scene-id')
        );
        return result ?? null;
    }

    async setActiveSceneId(id: string | null): Promise<void> {
        const db = await this.getDb();
        if (id === null) {
            await tx(db, META_STORE, 'readwrite', s =>
                s.delete('active-scene-id')
            );
        } else {
            await tx(db, META_STORE, 'readwrite', s =>
                s.put(id, 'active-scene-id')
            );
        }
    }

    async getPreference(key: string): Promise<string | null> {
        const db = await this.getDb();
        const result = await tx<string | undefined>(
            db,
            META_STORE,
            'readonly',
            s => s.get(`pref:${key}`)
        );
        return result ?? null;
    }

    async setPreference(key: string, value: string): Promise<void> {
        const db = await this.getDb();
        await tx(db, META_STORE, 'readwrite', s => s.put(value, `pref:${key}`));
    }
}
