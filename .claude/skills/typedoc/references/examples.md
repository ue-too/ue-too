# TypeDoc Examples and Common Patterns

This reference provides comprehensive examples for documenting various TypeScript patterns.

## API Client Example

```typescript
/**
 * HTTP client for interacting with the REST API.
 * Handles authentication, retry logic, and response parsing.
 * 
 * @example
 * ```typescript
 * const client = new ApiClient({ 
 *   baseUrl: 'https://api.example.com',
 *   apiKey: process.env.API_KEY 
 * });
 * 
 * const user = await client.get('/users/123');
 * ```
 */
export class ApiClient {
  /**
   * Creates a new API client instance.
   * @param config - Client configuration
   * @param config.baseUrl - Base URL for all requests
   * @param config.apiKey - API authentication key
   * @param config.timeout - Request timeout in milliseconds (default: 5000)
   * @param config.retries - Number of retry attempts for failed requests (default: 3)
   */
  constructor(config: ApiClientConfig) {}

  /**
   * Performs a GET request to the specified endpoint.
   * @typeParam T - Expected response type
   * @param path - API endpoint path (e.g., '/users/123')
   * @param options - Additional request options
   * @returns Parsed response data
   * @throws {NetworkError} When request fails after all retries
   * @throws {AuthenticationError} When API key is invalid (401)
   * @throws {ValidationError} When request parameters are invalid (400)
   */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {}
}
```

## Event Emitter Pattern

```typescript
/**
 * Type-safe event emitter for application events.
 * @typeParam Events - Event name to payload type mapping
 * 
 * @example
 * ```typescript
 * type MyEvents = {
 *   'user:login': { userId: string; timestamp: Date };
 *   'user:logout': { userId: string };
 * };
 * 
 * const emitter = new TypedEventEmitter<MyEvents>();
 * emitter.on('user:login', (data) => {
 *   console.log(`User ${data.userId} logged in`);
 * });
 * ```
 */
export class TypedEventEmitter<Events extends Record<string, any>> {
  /**
   * Registers an event listener.
   * @typeParam K - Event name type
   * @param event - Event name to listen for
   * @param handler - Callback invoked when event is emitted
   * @returns Unsubscribe function to remove this listener
   */
  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void {}

  /**
   * Emits an event to all registered listeners.
   * @typeParam K - Event name type
   * @param event - Event name to emit
   * @param payload - Event payload matching event type
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {}
}
```

## Builder Pattern

```typescript
/**
 * Builds complex query objects with a fluent interface.
 * 
 * @example
 * ```typescript
 * const query = new QueryBuilder()
 *   .select('id', 'name', 'email')
 *   .from('users')
 *   .where('age', '>', 18)
 *   .orderBy('name', 'asc')
 *   .limit(10)
 *   .build();
 * ```
 */
export class QueryBuilder {
  /**
   * Specifies columns to select.
   * @param columns - Column names to include in results
   * @returns This builder for method chaining
   */
  select(...columns: string[]): this {}

  /**
   * Specifies the table to query.
   * @param table - Table name
   * @returns This builder for method chaining
   */
  from(table: string): this {}

  /**
   * Adds a WHERE condition.
   * @param column - Column to filter on
   * @param operator - Comparison operator (=, >, <, !=, etc.)
   * @param value - Value to compare against
   * @returns This builder for method chaining
   */
  where(column: string, operator: string, value: any): this {}

  /**
   * Builds the final query object.
   * @returns Immutable query configuration
   * @throws {ValidationError} When required fields (table) are missing
   */
  build(): Query {}
}
```

## State Machine Pattern

```typescript
/**
 * Valid states for the connection lifecycle.
 */
export enum ConnectionState {
  /** Initial state before any connection attempt */
  Idle = 'IDLE',
  /** Actively establishing connection */
  Connecting = 'CONNECTING',
  /** Connection established and ready */
  Connected = 'CONNECTED',
  /** Connection lost, attempting to reconnect */
  Reconnecting = 'RECONNECTING',
  /** Connection permanently closed */
  Disconnected = 'DISCONNECTED',
  /** Connection failed with unrecoverable error */
  Failed = 'FAILED'
}

/**
 * Manages connection state transitions with event notifications.
 * Ensures only valid state transitions occur.
 * 
 * @remarks
 * Valid transitions:
 * - Idle → Connecting
 * - Connecting → Connected | Failed
 * - Connected → Reconnecting | Disconnected
 * - Reconnecting → Connected | Failed
 * - Failed → Idle (after reset)
 */
export class ConnectionStateMachine {
  /**
   * Attempts to transition to a new state.
   * @param newState - Target state
   * @throws {InvalidTransitionError} When transition is not allowed
   * @emits stateChange - When state successfully changes
   */
  transition(newState: ConnectionState): void {}
}
```

## Decorator Example

```typescript
/**
 * Decorator that adds retry logic to async methods.
 * Automatically retries failed operations with exponential backoff.
 * 
 * @param maxAttempts - Maximum number of retry attempts (default: 3)
 * @param delayMs - Initial delay between retries in milliseconds (default: 1000)
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class DataService {
 *   @Retry(5, 2000)
 *   async fetchData(id: string): Promise<Data> {
 *     return await api.get(`/data/${id}`);
 *   }
 * }
 * ```
 * 
 * @remarks
 * Delay doubles after each failed attempt (exponential backoff).
 * Only retries on network errors, not validation errors.
 */
export function Retry(maxAttempts = 3, delayMs = 1000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {}
}
```

## Utility Types Documentation

```typescript
/**
 * Makes all properties of T deeply readonly.
 * Unlike TypeScript's built-in Readonly<T>, this recursively
 * applies readonly to nested objects.
 * 
 * @typeParam T - Type to make deeply readonly
 * 
 * @example
 * ```typescript
 * type Config = DeepReadonly<{
 *   database: {
 *     host: string;
 *     credentials: { user: string; pass: string };
 *   };
 * }>;
 * // All nested properties are readonly
 * ```
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * Extracts the awaited type from a Promise, or returns T if not a Promise.
 * Useful for generic functions that work with both sync and async values.
 * 
 * @typeParam T - Type to unwrap
 * 
 * @example
 * ```typescript
 * type Result = Awaited<Promise<string>>; // string
 * type Direct = Awaited<number>; // number
 * ```
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;
```

## Complex Generic Constraints

```typescript
/**
 * Cache that stores values with automatic expiration.
 * @typeParam K - Key type, must be serializable
 * @typeParam V - Value type
 * 
 * @example
 * ```typescript
 * // Cache with string keys and any JSON-serializable values
 * const cache = new ExpiringCache<string, UserData>({
 *   ttl: 60000, // 1 minute
 *   maxSize: 100
 * });
 * 
 * cache.set('user:123', userData);
 * const data = cache.get('user:123'); // UserData | undefined
 * ```
 */
export class ExpiringCache<
  K extends string | number,
  V extends Record<string, any>
> {
  /**
   * @param options - Cache configuration
   * @param options.ttl - Time to live in milliseconds
   * @param options.maxSize - Maximum number of entries before eviction
   * @param options.onEvict - Callback invoked when entries are evicted
   */
  constructor(options: CacheOptions<K, V>) {}

  /**
   * Stores a value with automatic expiration.
   * @param key - Cache key
   * @param value - Value to store
   * @param ttlOverride - Override default TTL for this entry
   */
  set(key: K, value: V, ttlOverride?: number): void {}

  /**
   * Retrieves a value if it exists and hasn't expired.
   * @param key - Cache key
   * @returns Cached value or undefined if expired/missing
   */
  get(key: K): V | undefined {}
}
```

## Error Handling Documentation

```typescript
/**
 * Base class for all application errors.
 * Extends Error with additional context and error codes.
 */
export abstract class AppError extends Error {
  /**
   * Machine-readable error code for client handling.
   */
  readonly code: string;

  /**
   * Additional context data for debugging.
   */
  readonly context?: Record<string, any>;

  /**
   * @param message - Human-readable error description
   * @param code - Error code (e.g., 'VALIDATION_ERROR')
   * @param context - Additional error context
   */
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
  }
}

/**
 * Thrown when user input fails validation.
 * @example
 * ```typescript
 * if (!isValidEmail(email)) {
 *   throw new ValidationError('Invalid email format', {
 *     field: 'email',
 *     value: email
 *   });
 * }
 * ```
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}
```
