/**
 * Animation and input locking module exports.
 *
 * @remarks
 * This module provides the {@link CameraMuxWithAnimationAndLock} implementation and its supporting
 * state machines for pan, zoom, and rotation control. Each operation has its own state machine that
 * manages animation playback and input blocking.
 *
 * ## State Machines
 *
 * Each state machine manages three states:
 * - **ACCEPTING_USER_INPUT**: Normal state, accepts user input
 * - **TRANSITION**: Animation/transition state, may block user input
 * - **LOCKED_ON_OBJECT**: Camera locked to follow an object (blocks user input)
 *
 * ## Components
 *
 * - **{@link CameraMuxWithAnimationAndLock}**: Main multiplexer with animation support
 * - **{@link PanControlStateMachine}**: State machine for pan input flow control
 * - **{@link ZoomControlStateMachine}**: State machine for zoom input flow control
 * - **{@link RotateControlStateMachine}**: State machine for rotation input flow control
 *
 * @see {@link CameraMuxWithAnimationAndLock} for the main implementation
 * @see {@link createCameraMuxWithAnimationAndLock} for factory function
 *
 * @module
 */

export * from "./animation-and-lock";
export * from "./pan-control-state-machine";
export * from "./zoom-control-state-machine";
export * from "./rotation-control-state-machine";
