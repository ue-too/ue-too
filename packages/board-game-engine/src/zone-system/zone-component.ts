import { ComponentName, Coordinator, createGlobalComponentName, Entity, System } from "@ue-too/ecs";

export const ZONE_COMPONENT: ComponentName = createGlobalComponentName("ZoneComponent");
export const LOCATION_COMPONENT: ComponentName = createGlobalComponentName("LocationComponent");

export type LocationComponent = {
    location: Entity;
    sortIndex: number;
}

export type ZoneComponent = {
    zone: string;
    owner: Entity | null;
    visibility: 'public' | 'private' | 'owner-only';
    ordered: boolean;
}

