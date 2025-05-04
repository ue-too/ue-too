# Board Camera

This is the core module for this project.
The other modules act as the peripherals for the board camera.

This module consists of the following sub-modules:

- `camera-rig`: A module that defines the camera rig.
- `camera-update-publisher`: A module that publishes the camera update.
- `camera-update-batcher`: A module that batches the camera update.

## What `BoardCamera` is for ?
- Holds the viewport information
- Converts the viewport information to a transform matrix that can be used in various rendering engines. (e.g. Vanilla Canvas, pixi.js, fabric.js, etc.)
- Converts points in the viewport coordinate system to the world coordinate system and vice versa.

## The math behind the camera (viewport)
