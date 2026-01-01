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
  <a href="#packages">Packages</a> •
  <a href="#examples">Examples</a> •
  <a href="#development">Development</a>
</p>

## Packages

ue-too is organized into modular packages:

- [**`@ue-too/being`**](./packages/being/README.md) - Finite state machine <a href="https://www.npmjs.com/package/@ue-too/being"><img src="https://img.shields.io/npm/v/@ue-too/being.svg" alt="package being's npm version" style="vertical-align: middle"></a>
- [**`@ue-too/board`**](./packages/board/README.md) - Canvas viewport management with pan, zoom, and rotate functionality <a href="https://www.npmjs.com/package/@ue-too/board"><img src="https://img.shields.io/npm/v/@ue-too/board.svg" alt="package board's npm version" style="vertical-align: middle"></a>
- [**`@ue-too/math`**](./packages/math/README.md) - Mathematical utilities for 2D point operations, transformations, and calculations <a href="https://www.npmjs.com/package/@ue-too/math"><img src="https://img.shields.io/npm/v/@ue-too/math.svg" alt="package math's npm version" style="vertical-align: middle"></a>
- [**`@ue-too/animate`**](./packages/animate/README.md) - Animation system for smooth transitions and keyframe animations <a href="https://www.npmjs.com/package/@ue-too/animate"><img src="https://img.shields.io/npm/v/@ue-too/animate.svg" alt="package animate's npm version" style="vertical-align: middle"></a>
- [**`@ue-too/dynamics`**](./packages/dynamics/README.md) - 2D physics engine with collision detection, rigid bodies, and constraints <a href="https://www.npmjs.com/package/@ue-too/dynamics"><img src="https://img.shields.io/npm/v/@ue-too/dynamics.svg" alt="package dynamics's npm version" style="vertical-align: middle"></a>
- [**`@ue-too/curve`**](./packages/curve/README.md) - Curve and path tools including Bézier curves, lines, and composite paths <img src="https://img.shields.io/npm/v/@ue-too/curve.svg" alt="package curve's npm version" style="vertical-align: middle">
- [**`@ue-too/border`**](./packages/border/README.md) - Geographic projection utilities (great circle, rhumb line, map projections) <a href="https://www.npmjs.com/package/@ue-too/border"><img src="https://img.shields.io/npm/v/@ue-too/border.svg" alt="package border's npm version" style="vertical-align: middle"></a>
- [**`@ue-too/ecs`**](./packages/ecs/README.md) - Entity Component System architecture support <a href="https://www.npmjs.com/package/@ue-too/ecs"><img src="https://img.shields.io/npm/v/@ue-too/ecs.svg" alt="package ecs's npm version" style="vertical-align: middle"></a>

## Install Individual Packages
```bash
# Install specific packages you need
npm install @ue-too/board @ue-too/math @ue-too/animate
```

## Examples

A live website containing the examples is available [here](https://ue-too.github.io/ue-too/).

This monorepo includes comprehensive examples demonstrating various packages and integrations:

### Core Examples
- [**Base Example**](https://ue-too.github.io/ue-too/base/) - Basic canvas viewport management functionality
- [**Navigation Example**](https://ue-too.github.io/ue-too/navigation/) - Advanced navigation controls with keyboard shortcuts
- [**Ruler Example**](https://ue-too.github.io/ue-too/ruler/) - Measurement tools and overlays
- [**Camera Animation**](https://ue-too.github.io/ue-too/camera-animation/) - Smooth camera transitions on mouse click
- [**Image Example**](https://ue-too.github.io/ue-too/image-example/) - Drawing an image on the pannable and zoomable canvas

### Framework Integrations
- [**PixiJS Integration**](https://ue-too.github.io/ue-too/pixi-integration/)
- [**Konva Integration**](https://ue-too.github.io/ue-too/konva-integration/)
- [**Fabric Integration**](https://ue-too.github.io/ue-too/fabric-integration/)

### Advanced Features
- [**Physics Example**](https://ue-too.github.io/ue-too/physics/) - 2D physics simulation (WIP)
- [**Collision Example**](https://ue-too.github.io/ue-too/collision/) - Collision detection and response (WIP)

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
bun build

# Start development server
bun dev:examples
```

Refer to the read me of each libary and application for more detail.

### Project Structure
```
ue-too/
├── packages/           # Individual packages
│   ├── board/         # Canvas viewport management
│   ├── board-react/   # React integration for the board package
│   ├── board-vue/     # Vue integration for the board package
│   ├── math/          # Mathematical utilities
│   ├── animate/       # Animation system
│   ├── dynamics/      # Physics engine
│   ├── curve/         # Curve and path tools
│   ├── border/        # Geographic projections
│   ├── being/         # Entity interfaces
│   └── ecs/           # ECS architecture
├── apps/              # Example applications
│   ├── examples/      # Interactive examples
│   ├── board-react/   # React integration for the board package
│   ├── board-vue/     # Vue integration for the board package
│   ├── banana/        # A simulation of a railway system using bezier curves.
│   └── blast/         # A tabletop game prototype maker.
└── scripts/           # Build and deployment scripts
```

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Support

- [GitHub Issues](https://github.com/ue-too/ue-too/issues) - Bug reports and feature requests

> Currently not accepting contributions yet. If there's any features you want to see, please let me know by creating an issue.
