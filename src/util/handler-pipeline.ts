/**
 * @description Type definition for a handler function that takes a generic value and additional arguments
 * The handler must return the same type as its first argument
 * This is a utility type to be used in the handler pipeline. (Probably don't need to use this directly)
 * Using the {@link createHandlerChain} function to create a handler chain would have typescript infer the correct type for the handler chain.
 * 
 * @category Utils
 */
export type Handler<T, Args extends any[]> = (value: T, ...args: Args) => T;

/**
 * @description Creates a handler chain from an array of handlers.
 * 
 * Use it like this:
 * ```typescript
 * const handlerChain = createHandlerChain(handler1, handler2, handler3);
 * ```
 * or like this:
 * ```typescript
 * const handlers = [handler1, handler2, handler3];
 * const handlerChain = createHandlerChain(handlers);
 * ```
 * 
 * The function signature of all the handlers must be the same.
 * 
 * @param handlers Array of handler functions to be chained
 * @returns A single handler function that executes all handlers in sequence
 * 
 * @category Utils
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
