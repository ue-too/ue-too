/**
 * Camera rig module exports.
 *
 * @remarks
 * This module provides the camera constraint and restriction system through handler pipelines.
 * Camera rigs wrap camera instances and apply configurable rules to pan, zoom, and rotation operations.
 *
 * ## Key Concepts
 *
 * - **Handler Pipelines**: Composable functions that transform camera operations
 * - **Restrictions**: Completely disable specific camera movements (e.g., lock rotation)
 * - **Clamping**: Enforce boundaries on camera position, zoom level, and rotation angle
 * - **Boundaries**: Define world-space limits for camera movement
 *
 * ## Components
 *
 * - **{@link CameraRig}**: Main rig interface and {@link DefaultCameraRig} implementation
 * - **Pan Handlers**: {@link createDefaultPanByHandler}, {@link createDefaultPanToHandler}
 * - **Zoom Handlers**: {@link createDefaultZoomByOnlyHandler}, {@link createDefaultZoomToOnlyHandler}
 * - **Rotation Handlers**: {@link createDefaultRotateByHandler}, {@link createDefaultRotateToHandler}
 *
 * @see {@link CameraRig} for the main rig interface
 * @see {@link DefaultCameraRig} for the default implementation
 *
 * @module
 */

export * from './zoom-handler';
export * from './pan-handler';
export * from './rotation-handler';
export * from './camera-rig';
