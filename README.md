<h1 align="center">
    uē-tôo
</h1>
<p align="center">
    A toolkit for interactive HTML canvas applications
</p>

<div align="center">

[![ci tests](https://img.shields.io/github/actions/workflow/status/niuee/board/ci-test.yml?label=test&style=for-the-badge)](https://github.com/niuee/board/actions/workflows/ci-test.yml)
[![License](https://img.shields.io/github/license/niuee/board?style=for-the-badge)](https://github.com/niuee/board/blob/main/LICENSE.txt)

</div>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="https://ue-too.github.io/documentation/">Documentation</a> •
  <a href="#packages">Packages</a> •
  <a href="#examples">Examples</a> •
  <a href="#development">Development</a>
</p>

## Packages

ue-too is organized into modular packages:

- [**`@ue-too/being`**](https://www.npmjs.com/package/@ue-too/being) <a href="https://www.npmjs.com/package/@ue-too/being"><img src="https://img.shields.io/npm/v/@ue-too/being.svg" alt="package being's npm version" style="vertical-align: middle"></a>  - Finite state machine 
- [**`@ue-too/board`**](https://www.npmjs.com/package/@ue-too/board) <a href="https://www.npmjs.com/package/@ue-too/board"><img src="https://img.shields.io/npm/v/@ue-too/board.svg" alt="package board's npm version" style="vertical-align: middle"></a>  - Canvas viewport management with pan, zoom, and rotate functionality
- [**`@ue-too/math`**](https://www.npmjs.com/package/@ue-too/math) <a href="https://www.npmjs.com/package/@ue-too/math"><img src="https://img.shields.io/npm/v/@ue-too/math.svg" alt="package math's npm version" style="vertical-align: middle"></a>  - Mathematical utilities for 2D point operations, transformations, and calculations
- [**`@ue-too/animate`**](https://www.npmjs.com/package/@ue-too/animate) <a href="https://www.npmjs.com/package/@ue-too/animate"><img src="https://img.shields.io/npm/v/@ue-too/animate.svg" alt="package animate's npm version" style="vertical-align: middle"></a>  - Animation system for smooth transitions and keyframe animations
- [**`@ue-too/dynamics`**](https://www.npmjs.com/package/@ue-too/dynamics) <a href="https://www.npmjs.com/package/@ue-too/dynamics"><img src="https://img.shields.io/npm/v/@ue-too/dynamics.svg" alt="package dynamics's npm version" style="vertical-align: middle"></a>  - 2D physics engine with collision detection, rigid bodies, and constraints
- [**`@ue-too/curve`**](https://www.npmjs.com/package/@ue-too/curve) <img src="https://img.shields.io/npm/v/@ue-too/curve.svg" alt="package curve's npm version" style="vertical-align: middle">  - Curve and path tools including Bézier curves, lines, and composite paths
- [**`@ue-too/border`**](https://www.npmjs.com/package/@ue-too/border) <a href="https://www.npmjs.com/package/@ue-too/border"><img src="https://img.shields.io/npm/v/@ue-too/border.svg" alt="package border's npm version" style="vertical-align: middle"></a>  - Geographic projection utilities (great circle, rhumb line, map projections)
- [**`@ue-too/ecs`**](https://www.npmjs.com/package/@ue-too/ecs) <a href="https://www.npmjs.com/package/@ue-too/ecs"><img src="https://img.shields.io/npm/v/@ue-too/ecs.svg" alt="package ecs's npm version" style="vertical-align: middle"></a>  - Entity Component System architecture support

## Install Individual Packages

```bash
# Install specific packages you need
npm install @ue-too/board @ue-too/math @ue-too/animate
```

## Examples

A live website containing the examples is available [here](https://ue-too.github.io/ue-too/).

This monorepo includes comprehensive examples demonstrating various packages and integrations:

### Core Examples

- [**Base Example**](https://ue-too.github.io/ue-too/base/) - Basic canvas viewport with pan, zoom, and rotate
- [**Attach / Detach Example**](https://ue-too.github.io/ue-too/attach-detach/) - Dynamically attach and detach a canvas from the board
- [**Navigation Example**](https://ue-too.github.io/ue-too/navigation/) - Keyboard-driven camera panning via `panByViewPort()`
- [**Ruler Example**](https://ue-too.github.io/ue-too/ruler/) - Measurement ruler overlay that updates with pan and zoom
- [**Camera Animation**](https://ue-too.github.io/ue-too/camera-animation/) - Smooth animated camera transitions on click
- [**Image Example**](https://ue-too.github.io/ue-too/image-example/) - Upload and display an image on the pannable canvas
- [**SVG Example**](https://ue-too.github.io/ue-too/svg/) - Board camera system applied to SVG elements

### Framework Integrations

- [**PixiJS Integration**](https://ue-too.github.io/ue-too/pixi-integration/) - Full-screen PixiJS canvas with board camera controls
- [**Konva Integration**](https://ue-too.github.io/ue-too/konva-integration/) - Konva.js stage synchronized with board camera transforms
- [**Fabric Integration**](https://ue-too.github.io/ue-too/fabric-integration/) - Fabric.js with toggleable movement/selection modes

### Advanced Features

- [**Physics Example**](https://ue-too.github.io/ue-too/physics/) - Four-bar linkage with rigid body physics and constraints

### Running Examples

To run the examples locally:

```bash
# Clone the repository
git clone https://github.com/ue-too/ue-too.git
cd ue-too

# Install dependencies
bun install

# Start the development server
bun dev:examples
```

Then, visit `http://localhost:5173` to explore all examples.

## Development

### Prerequisites

- Bun 1.3.4

### Setup

```bash
# Clone and install
git clone https://github.com/ue-too/ue-too.git
cd ue-too
bun install

# Run tests
bun test

# Build all packages
bun run build

# Start development server
bun dev:examples
```

Refer to the read me of each libary and application for more detail.

### Project Structure

```
ue-too/
├── packages/                         # Individual packages
│   ├── board/                        # Canvas viewport management
│   ├── board-react-adapter/          # React integration for the board package
│   ├── board-vue-adapter/            # Vue integration for the board package
│   ├── board-pixi-integration/       # PixiJS integration for the board package
│   ├── board-pixi-react-integration/ # PixiJS integration for the board package with React
│   ├── board-konva-integration/      # Konva integration for the board package
│   ├── board-fabric-integration/     # Fabric integration for the board package
│   ├── math/                         # Mathematical utilities
│   ├── animate/                      # Animation system
│   ├── dynamics/                     # Physics engine
│   ├── curve/                        # Curve and path tools
│   ├── border/                       # Geographic projections
│   ├── being/                        # Finite state machine
│   └── ecs/                          # Entity Component System
├── apps/                             # Example applications
│   ├── examples/                     # Interactive examples
│   ├── banana/                       # A simulation of a railway system using bezier curves. (WIP)
│   ├── blast/                        # A tabletop game prototype maker. (WIP)
│   └── knit/                         # A knitting pattern editor. (WIP)
└── scripts/                          # Build and deployment scripts
```

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Support

- [GitHub Issues](https://github.com/ue-too/ue-too/issues) - Bug reports and feature requests

> Currently not accepting contributions yet. If there's any features you want to see, please let me know by creating an issue.
