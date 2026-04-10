import type { CarDefinitionStorage } from './car-definition-storage';
import { IdbCarDefinitionStorage } from './idb-car-definition-storage';
import { IdbSceneStorage } from './idb-scene-storage';
import type { SceneStorage } from './scene-storage';

export type { SceneMetadata, SceneStorage, StoredScene } from './scene-storage';
export { SCENE_DATA_VERSION } from './scene-storage';

export type {
    CarDefinitionData,
    CarDefinitionMetadata,
    CarDefinitionStorage,
    StoredCarDefinition,
} from './car-definition-storage';
export {
    CAR_DEFINITION_DATA_VERSION,
    generateCarDefinitionId,
} from './car-definition-storage';

let sceneInstance: SceneStorage | null = null;
let carDefinitionInstance: CarDefinitionStorage | null = null;

/** Get the singleton scene storage instance. */
export function getSceneStorage(): SceneStorage {
    if (!sceneInstance) {
        sceneInstance = new IdbSceneStorage();
    }
    return sceneInstance;
}

/** Get the singleton car-definition storage instance. */
export function getCarDefinitionStorage(): CarDefinitionStorage {
    if (!carDefinitionInstance) {
        carDefinitionInstance = new IdbCarDefinitionStorage();
    }
    return carDefinitionInstance;
}
