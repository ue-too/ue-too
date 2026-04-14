import type { Point } from '@ue-too/math';
import type { CarType } from '@/trains/cars';

/**
 * Raw car-definition payload — the shape the train editor produces and consumes.
 * Structurally identical to the JSON that the train editor file-export has always emitted,
 * so files saved before the library existed remain importable by the main simulator.
 */
export type CarDefinitionData = {
    bogieOffsets: number[];
    edgeToBogie: number;
    bogieToEdge: number;
    bogies: Point[];
    /** Car category — determines default gangway/coupler flags. */
    carType?: CarType;
    image?: {
        src: string;
        position: Point;
        width: number;
        height: number;
    };
};

export type CarDefinitionMetadata = {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    version: number;
};

export type StoredCarDefinition = {
    metadata: CarDefinitionMetadata;
    data: CarDefinitionData;
};

/**
 * Abstract storage interface for train-editor car definitions.
 * Backed by IndexedDB locally; can be swapped to remote storage.
 */
export interface CarDefinitionStorage {
    listCarDefinitions(): Promise<CarDefinitionMetadata[]>;
    loadCarDefinition(id: string): Promise<StoredCarDefinition | null>;
    saveCarDefinition(def: StoredCarDefinition): Promise<void>;
    deleteCarDefinition(id: string): Promise<void>;
}

export const CAR_DEFINITION_DATA_VERSION = 1;

export function generateCarDefinitionId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `car-def-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
