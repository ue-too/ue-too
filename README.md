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

- [**`@ue-too/being`**](./packages/being/README.md) - Finite state machine <img src="https://img.shields.io/npm/v/@ue-too/being.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/board`**](./packages/board/README.md) - Canvas viewport management with pan, zoom, and rotate functionality <img src="https://img.shields.io/npm/v/@ue-too/board.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/math`**](./packages/math/README.md) - Mathematical utilities for 2D point operations, transformations, and calculations <img src="https://img.shields.io/npm/v/@ue-too/math.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/animate`**](./packages/animate/README.md) - Animation system for smooth transitions and keyframe animations <img src="https://img.shields.io/npm/v/@ue-too/animate.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/dynamics`**](./packages/dynamics/README.md) - 2D physics engine with collision detection, rigid bodies, and constraints <img src="https://img.shields.io/npm/v/@ue-too/dynamics.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/curve`**](./packages/curve/README.md) - Curve and path tools including Bézier curves, lines, and composite paths <img src="https://img.shields.io/npm/v/@ue-too/curve.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/border`**](./packages/border/README.md) - Geographic projection utilities (great circle, rhumb line, map projections) <img src="https://img.shields.io/npm/v/@ue-too/border.svg" alt="npm version" style="vertical-align: middle">
- [**`@ue-too/ecs`**](./packages/ecs/README.md) - Entity Component System architecture support <img src="https://img.shields.io/npm/v/@ue-too/ecs.svg" alt="npm version" style="vertical-align: middle">

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
pnpm install

# Start the development server
pnpm dev:examples
```

Then, visit `http://localhost:5173` to explore all examples.

## Development

### Prerequisites
- Node.js 22.19.0
- pnpm 10.17.0

### Setup
```bash
# Clone and install
git clone https://github.com/ue-too/ue-too.git
cd ue-too
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build

# Start development server
pnpm dev:examples
```

Refer to the read me of each libary and application for more detail.

### Project Structure
```
ue-too/
├── packages/           # Individual packages
│   ├── board/         # Canvas viewport management
│   ├── math/          # Mathematical utilities
│   ├── animate/       # Animation system
│   ├── dynamics/      # Physics engine
│   ├── curve/         # Curve and path tools
│   ├── border/        # Geographic projections
│   ├── being/         # Entity interfaces
│   └── ecs/           # ECS architecture
├── apps/              # Example applications
│   ├── examples/      # Interactive examples
│   └── b-curve-exp/   # Bézier curve experiment (WIP)
└── scripts/           # Build and deployment scripts
```

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Support

- [GitHub Issues](https://github.com/ue-too/ue-too/issues) - Bug reports and feature requests

> Currently not accepting contributions yet. If there's any features you want to see, please let me know by creating an issue.
