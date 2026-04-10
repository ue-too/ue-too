import type {
    CarDefinitionMetadata,
    CarDefinitionStorage,
    StoredCarDefinition,
} from './car-definition-storage';
import { CAR_DEFINITIONS_STORE, openBananaDb, tx } from './idb';

export class IdbCarDefinitionStorage implements CarDefinitionStorage {
    private getDb(): Promise<IDBDatabase> {
        return openBananaDb();
    }

    async listCarDefinitions(): Promise<CarDefinitionMetadata[]> {
        const db = await this.getDb();
        const all = await tx<StoredCarDefinition[]>(
            db,
            CAR_DEFINITIONS_STORE,
            'readonly',
            s => s.getAll()
        );
        return all
            .map(entry => entry.metadata)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async loadCarDefinition(id: string): Promise<StoredCarDefinition | null> {
        const db = await this.getDb();
        const result = await tx<StoredCarDefinition | undefined>(
            db,
            CAR_DEFINITIONS_STORE,
            'readonly',
            s => s.get(id)
        );
        return result ?? null;
    }

    async saveCarDefinition(def: StoredCarDefinition): Promise<void> {
        const db = await this.getDb();
        await tx(db, CAR_DEFINITIONS_STORE, 'readwrite', s => s.put(def));
    }

    async deleteCarDefinition(id: string): Promise<void> {
        const db = await this.getDb();
        await tx(db, CAR_DEFINITIONS_STORE, 'readwrite', s => s.delete(id));
    }
}
