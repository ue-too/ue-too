/**
 * Input interpretation system module exports.
 *
 * @remarks
 * This module handles all user input processing for the board package, converting raw DOM events
 * into camera operations through a pipeline of parsers, state machines, and orchestration.
 *
 * ## Architecture
 *
 * The input system follows this flow:
 * 1. **Raw Input Parsers**: Listen to DOM events (mouse, keyboard, touch)
 * 2. **Input State Machines**: Interpret event sequences (e.g., drag vs click, pinch vs pan)
 * 3. **Input Orchestrator**: Translates gestures into camera operations
 * 4. **Raw Input Publisher**: Publishes input events for application-level handling
 *
 * ## Key Components
 *
 * - **Parsers**: {@link VanillaKMTEventParser}, {@link VanillaTouchEventParser} for DOM event handling
 * - **State Machines**: {@link createKmtInputStateMachine}, {@link createTouchInputStateMachine} for gesture recognition
 * - **Orchestrator**: {@link InputOrchestrator} for coordinating camera operations
 * - **Publisher**: {@link RawUserInputPublisher} for input event subscriptions
 *
 * @see {@link InputOrchestrator} for camera control coordination
 * @see {@link VanillaKMTEventParser} for keyboard/mouse/trackpad input
 * @see {@link VanillaTouchEventParser} for touch input
 *
 * @module
 */

export * from "./input-state-machine";
export * from "./raw-input-publisher";
export * from "./raw-input-parser";
export * from "./input-orchestrator";
