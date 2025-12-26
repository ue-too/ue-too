/**
 * Camera system module exports.
 *
 * @remarks
 * This module provides the complete camera system for viewport management in the board package.
 * It includes camera implementations, constraint systems (rigs), input multiplexing, and utilities.
 *
 * ## Key Components
 *
 * - **Camera Classes**: {@link DefaultBoardCamera} for viewport transformations (pan/zoom/rotate)
 * - **Camera Rigs**: {@link CameraRig} for enforcing boundaries and movement constraints
 * - **Camera Multiplexers**: {@link CameraMux} for coordinating user input, animations, and programmatic control
 * - **Utilities**: Helper functions for coordinate conversion, position calculations, and more
 *
 * @see {@link DefaultBoardCamera} for the main camera implementation
 * @see {@link CameraRig} for camera constraint configuration
 * @see {@link CameraMux} for input coordination and animation support
 *
 * @module
 */

export * from "./base";
export * from './utils';
export * from './default-camera';
export * from './interface';
export * from './update-publisher';
export * from './camera-rig';
export * from './camera-mux';
export * from './camera-edge-auto-input';
export { default as DefaultBoardCamera } from './default-camera';
