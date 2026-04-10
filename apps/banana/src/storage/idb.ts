const DB_NAME = 'banana-scenes';
const DB_VERSION = 2;

export const SCENES_STORE = 'scenes';
export const META_STORE = 'meta';
export const CAR_DEFINITIONS_STORE = 'car-definitions';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openBananaDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
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
                if (!db.objectStoreNames.contains(CAR_DEFINITIONS_STORE)) {
                    db.createObjectStore(CAR_DEFINITIONS_STORE, {
                        keyPath: 'metadata.id',
                    });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

export function tx<T>(
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
