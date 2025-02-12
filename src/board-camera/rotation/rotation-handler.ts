import { BoardCamera } from "src/board-camera";
import { normalizeAngleZero2TwoPI, angleSpan, clampRotation } from "src/board-camera/utils/rotation";

export type RotationHandlerConfig = {
    restrictRotation: boolean;
};

export type RotateByHandlerFunction = (delta: number, camera: BoardCamera, config: RotationHandlerConfig) => number;
export type RotateToHandlerFunction = (targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig) => number;

export function createRotateByHandlerChain(...handlers: RotateByHandlerFunction[] | [RotateByHandlerFunction[]]): RotateByHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as RotateByHandlerFunction[];
    return (delta: number, camera: BoardCamera, config: RotationHandlerConfig) => {
        return normalizedHandlers.reduce((currentRotation, currentHandler) => currentHandler(currentRotation, camera, config), delta);
    };
}

export function createRotateToHandlerChain(...handlers: RotateToHandlerFunction[] | [RotateToHandlerFunction[]]): RotateToHandlerFunction {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as RotateToHandlerFunction[];
    return (targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig) => {
        return normalizedHandlers.reduce((currentRotation, currentHandler) => currentHandler(currentRotation, camera, config), targetRotation);
    };
}

// this is not stable
export function createGenericHandlerChain<
    R,
    H extends (initialValue: R, ...args: any[]) => R,
>(
    ...handlers: H[] | [H[]]
): (initialValue: R, ...args: Parameters<H> extends [any, ...infer A] ? A : never) => R {
    const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as H[];
    return (initialValue: R, ...args: Parameters<H> extends [any, ...infer A] ? A : never) => {
        return normalizedHandlers.reduce((currentResult: R, nextHandler) => {
            return nextHandler(currentResult, ...args);
        }, initialValue);
    };
}

export function baseRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    camera.setRotation(targetRotation);
    return delta;
}

export function clampRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const targetRotation = normalizeAngleZero2TwoPI(camera.rotation + delta);
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

export function restrictRotateByHandler(delta: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(config.restrictRotation){
        return 0;
    }
    return delta;
}

export function baseRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    camera.setRotation(targetRotation);
    return targetRotation;
}

export function clampRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    const clampedRotation = clampRotation(targetRotation, camera.rotationBoundaries);
    const diff = angleSpan(camera.rotation, clampedRotation);
    return diff;
}

export function restrictRotateToHandler(targetRotation: number, camera: BoardCamera, config: RotationHandlerConfig): number {
    if(config.restrictRotation){
        return camera.rotation;
    }
    return targetRotation;
}

/**
 * Type definition for a handler function that takes a generic value and additional arguments
 * The handler must return the same type as its first argument
 */
type Handler<T, Args extends any[]> = (value: T, ...args: Args) => T;

/**
 * Creates a handler chain from an array of handlers
 * @param handlers Array of handler functions to be chained
 * @returns A single handler function that executes all handlers in sequence
 */
function createHandlerChain<T, Args extends any[]>(
  handlers: Handler<T, Args>[]
): Handler<T, Args> {
  return (value: T, ...args: Args): T => {
    return handlers.reduce(
      (acc, handler) => handler(acc, ...args),
      value
    );
  };
}

/**
 * Creates a handler chain from multiple handler arguments
 * @param handlers Handler functions to be chained
 * @returns A single handler function that executes all handlers in sequence
 */
function createHandlerChainFromArgs<T, Args extends any[]>(
  ...handlers: Handler<T, Args>[]
): Handler<T, Args> {
  return createHandlerChain(handlers);
}

// Example usage:
type Person = {
  name: string;
  age: number;
};

// Example handlers
const addTitle = (person: Person): Person => ({
  ...person,
  name: `Mr. ${person.name}`
});

const incrementAge = (person: Person): Person => ({
  ...person,
  age: person.age + 1
});

const logPerson = (person: Person): Person => {
  console.log(person);
  return person;
};

// Using with array
const handlerChain1 = createHandlerChain<Person, []>([
  addTitle,
  incrementAge,
  logPerson
]);

// Using with multiple arguments
const handlerChain2 = createHandlerChainFromArgs<Person, []>(
  addTitle,
  incrementAge,
  logPerson
);

// Example with additional arguments
type DataHandler = Handler<number, [multiplier: number]>;

const multiply: DataHandler = (value, multiplier) => value * multiplier;
const add10: DataHandler = (value) => value + 10;

const mathChain: (startingValue: number, multiplier: number) => number = createHandlerChain<number, [number]>([
  multiply,
  add10
]);

// Usage examples:
const person = { name: "John", age: 30 };
const processedPerson = handlerChain1(person);
const result = mathChain(5, 2); // ((5 * 2) + 10) = 20