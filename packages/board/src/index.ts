/**
 * @packageDocumentation
 * Main entry point for the @ue-too/board package.
 *
 * @remarks
 * This package provides a high-performance infinite canvas with pan, zoom, and rotate capabilities.
 * The {@link Board} class is the primary API that orchestrates camera management, input handling,
 * and coordinate transformations for building interactive 2D canvas applications.
 *
 * ## Key Exports
 *
 * - **{@link Board}**: Main class for creating an infinite canvas with camera controls
 * - **Camera System**: Camera classes, rigs, and multiplexers for viewport management
 * - **Input System**: Input parsers, state machines, and orchestration for user interaction
 * - **Utilities**: Helper functions for coordinate conversion, math operations, and more
 *
 * @example
 * Basic usage
 * ```typescript
 * import { Board } from '@ue-too/board';
 *
 * const canvas = document.querySelector('canvas') as HTMLCanvasElement;
 * const board = new Board(canvas);
 *
 * function draw(timestamp: number) {
 *   board.step(timestamp);
 *
 *   if (board.context) {
 *     board.context.fillRect(0, 0, 100, 100);
 *   }
 *
 *   requestAnimationFrame(draw);
 * }
 *
 * requestAnimationFrame(draw);
 * ```
 */

export * from "./boardify";
export * from "./camera";
export * from "./input-interpretation";
export * from "./utils";
export { default as Board } from "./boardify";
