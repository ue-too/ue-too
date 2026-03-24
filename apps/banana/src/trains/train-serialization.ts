import { Car, CarType, getDefaultGangway, seedIdGeneratorsFromSerialized } from './cars';
import type { TrainPosition } from './formation';
import { Formation, Train } from './formation';
import type { JointDirectionManager } from './input-state-machine/train-kmt-state-machine';
import type { TrackGraph } from './tracks/track';
import type { CarStockManager } from './car-stock-manager';
import type { FormationManager } from './formation-manager';
import type { TrainManager } from './train-manager';
import type { Point } from '@ue-too/math';

/** JSON-safe car data for serialization. */
export type SerializedCar = {
  id: string;
  /** Display name. Omitted when equal to id for backwards compatibility. */
  name?: string;
  bogieOffsets: number[];
  edgeToBogie: number;
  bogieToEdge: number;
  /** Distance from bogie to coupler tip. Omitted when 0 for backwards compatibility. */
  couplerLength?: number;
  /** Car category. Omitted when 'coach' for backwards compatibility. */
  type?: string;
  /** Head-end gangway override. Omitted when matching the type default. */
  headHasGangway?: boolean;
  /** Tail-end gangway override. Omitted when matching the type default. */
  tailHasGangway?: boolean;
  flipped: boolean;
};

/** Child of a formation: either a car or a nested formation by id. */
export type SerializedFormationChild =
  | { type: 'car'; id: string }
  | { type: 'formation'; id: string };

/** JSON-safe formation tree for serialization. */
export type SerializedFormation = {
  id: string;
  /** Display name. Omitted when equal to id for backwards compatibility. */
  name?: string;
  children: SerializedFormationChild[];
  flipped: boolean;
};

/** Train head position (point is recomputed on load from track). */
export type SerializedTrainPosition = {
  trackSegment: number;
  tValue: number;
  direction: 'tangent' | 'reverseTangent';
};

/** One placed train with id, position, and formation reference. */
export type SerializedPlacedTrain = {
  id: number;
  position: SerializedTrainPosition;
  formationId: string;
  /** Optional finite cap in world units per second; omit for default (no cap). */
  maxSpeed?: number;
};

/** Full train data for export/import (cars, formations, stock, manager, placed trains). */
export type SerializedTrainData = {
  cars: SerializedCar[];
  formations: SerializedFormation[];
  carStockIds: string[];
  formationManagerIds: string[];
  placedTrains: SerializedPlacedTrain[];
};

function serializeCar(car: Car): SerializedCar {
  const gangwayDefaults = getDefaultGangway(car.type);
  return {
    id: car.id,
    ...(car.name !== car.id ? { name: car.name } : {}),
    bogieOffsets: car.bogieOffsets(),
    edgeToBogie: car.edgeToBogie,
    bogieToEdge: car.bogieToEdge,
    ...(car.couplerLength !== 0 ? { couplerLength: car.couplerLength } : {}),
    ...(car.type !== CarType.COACH ? { type: car.type } : {}),
    ...(car.headHasGangway !== gangwayDefaults.head ? { headHasGangway: car.headHasGangway } : {}),
    ...(car.tailHasGangway !== gangwayDefaults.tail ? { tailHasGangway: car.tailHasGangway } : {}),
    flipped: car.flipped,
  };
}

function serializeFormation(formation: Formation): SerializedFormation {
  const children: SerializedFormationChild[] = formation.children.map((child) => {
    if (child.depth === 0) {
      return { type: 'car', id: child.id };
    }
    return { type: 'formation', id: child.id };
  });
  return {
    id: formation.id,
    ...(formation.name !== formation.id ? { name: formation.name } : {}),
    children,
    flipped: formation.flipped,
  };
}

function serializePosition(pos: TrainPosition): SerializedTrainPosition {
  return {
    trackSegment: pos.trackSegment,
    tValue: pos.tValue,
    direction: pos.direction,
  };
}

/**
 * Serialize all train-related data so the scene can be recreated on import.
 * Includes car definitions, formation trees, which cars are in stock, which
 * formations are in the depot, and each placed train (id, position, formation id).
 */
export function serializeTrainData(
  trainManager: TrainManager,
  formationManager: FormationManager,
  carStockManager: CarStockManager
): SerializedTrainData {
  const placed = trainManager.getPlacedTrains();
  const managerFormations = formationManager.getFormations();
  const stockCars = carStockManager.getAvailableCars();

  const formationById = new Map<string, Formation>();
  for (const { formation } of managerFormations) {
    formationById.set(formation.id, formation);
  }
  for (const { train } of placed) {
    formationById.set(train.formation.id, train.formation);
  }

  const carById = new Map<string, Car>();
  for (const { car } of stockCars) {
    carById.set(car.id, car);
  }
  for (const formation of formationById.values()) {
    for (const car of formation.flatCars()) {
      carById.set(car.id, car);
    }
  }

  const cars: SerializedCar[] = Array.from(carById.values()).map(serializeCar);
  const formations: SerializedFormation[] = Array.from(formationById.values()).map(serializeFormation);
  const carStockIds = stockCars.map((e) => e.id);
  const formationManagerIds = managerFormations.map((e) => e.id);
  const placedTrains: SerializedPlacedTrain[] = placed
    .map(({ id, train }) => {
      const pos = train.position;
      if (pos === null) return null;
      const entry: SerializedPlacedTrain = {
        id,
        position: serializePosition(pos),
        formationId: train.formation.id,
      };
      if (Number.isFinite(train.maxSpeed)) {
        entry.maxSpeed = train.maxSpeed;
      }
      return entry;
    })
    .filter((t): t is SerializedPlacedTrain => t !== null);

  return {
    cars,
    formations,
    carStockIds,
    formationManagerIds,
    placedTrains,
  };
}

function deserializeCar(data: SerializedCar): Car {
  const type = (data.type as CarType | undefined) ?? CarType.COACH;
  const car = new Car(
    data.id,
    [...data.bogieOffsets],
    data.edgeToBogie,
    data.bogieToEdge,
    data.couplerLength,
    type,
  );
  if (data.name !== undefined) {
    car.name = data.name;
  }
  // Apply gangway overrides (if present they differ from the type default)
  if (data.headHasGangway !== undefined) {
    car.headHasGangway = data.headHasGangway;
  }
  if (data.tailHasGangway !== undefined) {
    car.tailHasGangway = data.tailHasGangway;
  }
  if (data.flipped) {
    car.switchDirection();
  }
  return car;
}

function deserializeFormation(
  data: SerializedFormation,
  carById: Map<string, Car>,
  formationById: Map<string, Formation>
): Formation {
  const children = data.children.map((child) => {
    if (child.type === 'car') {
      const car = carById.get(child.id);
      if (!car) throw new Error(`Car not found: ${child.id}`);
      return car;
    }
    const nested = formationById.get(child.id);
    if (!nested) throw new Error(`Formation not found: ${child.id}`);
    return nested;
  });
  const depth = 1 + Math.max(0, ...children.map((c) => c.depth));
  const formation = new Formation(data.id, children, depth);
  if (data.name !== undefined) {
    formation.name = data.name;
  }
  if (data.flipped) {
    formation.switchDirection();
  }
  return formation;
}

function deserializePosition(
  data: SerializedTrainPosition,
  trackGraph: TrackGraph
): TrainPosition {
  const segment = trackGraph.getTrackSegmentWithJoints(data.trackSegment);
  const point: Point =
    segment !== null
      ? segment.curve.getPointbyPercentage(data.tValue)
      : { x: 0, y: 0 };
  return {
    trackSegment: data.trackSegment,
    tValue: data.tValue,
    direction: data.direction,
    point,
  };
}

/**
 * Restore train data from a serialized payload. Clears current train/car/formation
 * state and rebuilds from data. Track graph must already be loaded (e.g. after
 * importing track data).
 */
export function deserializeTrainData(
  data: SerializedTrainData,
  trackGraph: TrackGraph,
  jointDirectionManager: JointDirectionManager,
  trainManager: TrainManager,
  formationManager: FormationManager,
  carStockManager: CarStockManager
): void {
  const carIds = data.cars.map((c) => c.id);
  const formationIds = data.formations.map((f) => f.id);
  seedIdGeneratorsFromSerialized(carIds, formationIds);

  const carById = new Map<string, Car>();
  for (const c of data.cars) {
    carById.set(c.id, deserializeCar(c));
  }

  const formationById = new Map<string, Formation>();
  const formationOrder = data.formations.slice();
  while (formationOrder.length > 0) {
    const dataFormation = formationOrder.shift();
    if (!dataFormation) break;
    const allChildrenResolved = dataFormation.children.every((child) => {
      if (child.type === 'car') return carById.has(child.id);
      return formationById.has(child.id);
    });
    if (!allChildrenResolved) {
      formationOrder.push(dataFormation);
      continue;
    }
    const formation = deserializeFormation(dataFormation, carById, formationById);
    formationById.set(formation.id, formation);
  }

  carStockManager.clearForLoad();
  for (const id of data.carStockIds) {
    const car = carById.get(id);
    if (car) carStockManager.addCar(car);
  }

  formationManager.clearForLoad();
  for (const id of data.formationManagerIds) {
    const formation = formationById.get(id);
    if (formation) formationManager.addFormation(formation);
  }

  trainManager.clearForLoad();
  for (const pt of data.placedTrains) {
    const formation = formationById.get(pt.formationId);
    if (!formation) continue;
    const position = deserializePosition(pt.position, trackGraph);
    const train = new Train(
      position,
      trackGraph,
      jointDirectionManager,
      formation,
      pt.maxSpeed,
    );
    trainManager.addTrainWithId(pt.id, train);
  }
}

/**
 * Validates that `data` conforms to the SerializedTrainData schema.
 * Returns { valid: true } on success, or { valid: false, error: string }.
 */
export function validateSerializedTrainData(
  data: unknown
): { valid: true } | { valid: false; error: string } {
  if (data == null || typeof data !== 'object') {
    return { valid: false, error: 'Data must be a non-null object' };
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.cars)) {
    return { valid: false, error: 'Missing or invalid "cars" array' };
  }
  if (!Array.isArray(obj.formations)) {
    return { valid: false, error: 'Missing or invalid "formations" array' };
  }
  if (!Array.isArray(obj.carStockIds)) {
    return { valid: false, error: 'Missing or invalid "carStockIds" array' };
  }
  if (!Array.isArray(obj.formationManagerIds)) {
    return { valid: false, error: 'Missing or invalid "formationManagerIds" array' };
  }
  if (!Array.isArray(obj.placedTrains)) {
    return { valid: false, error: 'Missing or invalid "placedTrains" array' };
  }
  for (let i = 0; i < (obj.cars as unknown[]).length; i++) {
    const c = (obj.cars as unknown[])[i] as Record<string, unknown>;
    if (typeof c?.id !== 'string') return { valid: false, error: `cars[${i}].id must be a string` };
    if (!Array.isArray(c?.bogieOffsets)) return { valid: false, error: `cars[${i}].bogieOffsets must be an array` };
    if (typeof c?.edgeToBogie !== 'number') return { valid: false, error: `cars[${i}].edgeToBogie must be a number` };
    if (typeof c?.bogieToEdge !== 'number') return { valid: false, error: `cars[${i}].bogieToEdge must be a number` };
    if (typeof c?.flipped !== 'boolean') return { valid: false, error: `cars[${i}].flipped must be a boolean` };
  }
  for (let i = 0; i < (obj.formations as unknown[]).length; i++) {
    const f = (obj.formations as unknown[])[i] as Record<string, unknown>;
    if (typeof f?.id !== 'string') return { valid: false, error: `formations[${i}].id must be a string` };
    if (!Array.isArray(f?.children)) return { valid: false, error: `formations[${i}].children must be an array` };
    if (typeof f?.flipped !== 'boolean') return { valid: false, error: `formations[${i}].flipped must be a boolean` };
  }
  for (let i = 0; i < (obj.placedTrains as unknown[]).length; i++) {
    const pt = (obj.placedTrains as unknown[])[i] as Record<string, unknown>;
    if (typeof pt?.id !== 'number') return { valid: false, error: `placedTrains[${i}].id must be a number` };
    const pos = pt?.position as Record<string, unknown> | undefined;
    if (!pos || typeof pos?.trackSegment !== 'number' || typeof pos?.tValue !== 'number' || (pos?.direction !== 'tangent' && pos?.direction !== 'reverseTangent')) {
      return { valid: false, error: `placedTrains[${i}].position must be { trackSegment, tValue, direction }` };
    }
    if (typeof pt?.formationId !== 'string') return { valid: false, error: `placedTrains[${i}].formationId must be a string` };
    if (pt?.maxSpeed !== undefined) {
      if (typeof pt.maxSpeed !== 'number' || !Number.isFinite(pt.maxSpeed) || pt.maxSpeed < 0) {
        return { valid: false, error: `placedTrains[${i}].maxSpeed must be a finite number >= 0 when present` };
      }
    }
  }
  return { valid: true };
}
