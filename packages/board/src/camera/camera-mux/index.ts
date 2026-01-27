/**
 * Camera multiplexer (mux) module exports.
 *
 * @remarks
 * This module provides camera input coordination and arbitration between different control sources
 * (user input, animations, programmatic control). The camera mux decides whether to allow or block
 * camera operations based on the current state (e.g., block user input during animations).
 *
 * ## Implementations
 *
 * - **{@link Relay}**: Simple passthrough mux that allows all operations
 * - **{@link CameraMuxWithAnimationAndLock}**: Advanced mux with animation support and input blocking
 *
 * ## Use Cases
 *
 * - Smooth camera animations (pan-to, zoom-to, rotate-to)
 * - Input locking during programmatic camera movements
 * - State-based input arbitration
 * - Animation interruption handling
 *
 * @see {@link CameraMux} for the mux interface
 * @see {@link CameraMuxWithAnimationAndLock} for animation support
 * @see {@link Relay} for simple passthrough
 *
 * @module
 */

export * from './interface';
export * from './relay';
export * from './animation-and-lock';
