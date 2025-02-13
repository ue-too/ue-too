/**
 * Type definition for a handler function that takes a generic value and additional arguments
 * The handler must return the same type as its first argument
 */
export type Handler<T, Args extends any[]> = (value: T, ...args: Args) => T;

/**
 * Creates a handler chain from an array of handlers
 * @param handlers Array of handler functions to be chained
 * @returns A single handler function that executes all handlers in sequence
 */
export function createHandlerChain<T, Args extends any[]>(
  ...handlers: Handler<T, Args>[] | [Handler<T, Args>[]]
): Handler<T, Args> {
  const normalizedHandlers = Array.isArray(handlers[0]) ? handlers[0] : handlers as Handler<T, Args>[];
  return (value: T, ...args: Args): T => {
    return normalizedHandlers.reduce(
      (acc, handler) => handler(acc, ...args),
      value
    );
  };
}
