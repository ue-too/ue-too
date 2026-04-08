import { IdbSceneStorage } from './idb-scene-storage';
import type { SceneStorage } from './scene-storage';

export type { SceneMetadata, SceneStorage, StoredScene } from './scene-storage';
export { SCENE_DATA_VERSION } from './scene-storage';

let instance: SceneStorage | null = null;

/** Get the singleton scene storage instance. */
export function getSceneStorage(): SceneStorage {
    if (!instance) {
        instance = new IdbSceneStorage();
    }
    return instance;
}
