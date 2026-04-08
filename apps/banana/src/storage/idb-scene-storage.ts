import type { SceneMetadata, SceneStorage, StoredScene } from './scene-storage';

const DB_NAME = 'banana-scenes';
const DB_VERSION = 1;
const SCENES_STORE = 'scenes';
const META_STORE = 'meta';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SCENES_STORE)) {
                db.createObjectStore(SCENES_STORE, {
                    keyPath: 'metadata.id',
                });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function tx<T>(
    db: IDBDatabase,
    store: string,
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const req = fn(transaction.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export class IdbSceneStorage implements SceneStorage {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private getDb(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = openDb();
        }
        return this.dbPromise;
    }

    async listScenes(): Promise<SceneMetadata[]> {
        const db = await this.getDb();
        const all = await tx<StoredScene[]>(
            db,
            SCENES_STORE,
            'readonly',
            (s) => s.getAll()
        );
        return all
            .map((scene) => scene.metadata)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async loadScene(id: string): Promise<StoredScene | null> {
        const db = await this.getDb();
        const result = await tx<StoredScene | undefined>(
            db,
            SCENES_STORE,
            'readonly',
            (s) => s.get(id)
        );
        return result ?? null;
    }

    async saveScene(scene: StoredScene): Promise<void> {
        const db = await this.getDb();
        await tx(db, SCENES_STORE, 'readwrite', (s) => s.put(scene));
    }

    async deleteScene(id: string): Promise<void> {
        const db = await this.getDb();
        await tx(db, SCENES_STORE, 'readwrite', (s) => s.delete(id));
    }

    async getActiveSceneId(): Promise<string | null> {
        const db = await this.getDb();
        const result = await tx<string | undefined>(
            db,
            META_STORE,
            'readonly',
            (s) => s.get('active-scene-id')
        );
        return result ?? null;
    }

    async setActiveSceneId(id: string | null): Promise<void> {
        const db = await this.getDb();
        if (id === null) {
            await tx(db, META_STORE, 'readwrite', (s) =>
                s.delete('active-scene-id')
            );
        } else {
            await tx(db, META_STORE, 'readwrite', (s) =>
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
            (s) => s.get(`pref:${key}`)
        );
        return result ?? null;
    }

    async setPreference(key: string, value: string): Promise<void> {
        const db = await this.getDb();
        await tx(db, META_STORE, 'readwrite', (s) =>
            s.put(value, `pref:${key}`)
        );
    }
}
