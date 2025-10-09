<h1 align="center">
    uē-tôo
</h1>
<p align="center">
    A toolkit for interactive HTML canvas applications
</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/ue-too.svg?style=for-the-badge)](https://www.npmjs.com/package/ue-too)
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

- [**`@ue-too/being`**](./packages/being/readme.md) - Finite state machine
- [**`@ue-too/board`**](./packages/board/readme.md) - Canvas viewport management with pan, zoom, and rotate functionality
- [**`@ue-too/math`**](./packages/math/readme.md) - Mathematical utilities for 2D point operations, transformations, and calculations
- [**`@ue-too/animate`**](./packages/animate/readme.md) - Animation system for smooth transitions and keyframe animations
- [**`@ue-too/dynamics`**](./packages/dynamics/readme.md) - 2D physics engine with collision detection, rigid bodies, and constraints
- [**`@ue-too/curve`**](./packages/curve/readme.md) - Curve and path tools including Bézier curves, lines, and composite paths
- [**`@ue-too/border`**](./packages/border/readme.md) - Geographic projection utilities (great circle, rhumb line, map projections)
- [**`@ue-too/ecs`**](./packages/ecs/readme.md) - Entity Component System architecture support

## Install Individual Packages
```bash
# Install specific packages you need
npm install @ue-too/board @ue-too/math @ue-too/animate
```

## Examples

The monorepo includes comprehensive examples demonstrating various packages and integrations:

### Core Examples
- **Base Example** - Basic canvas viewport management functionality
- **Navigation Example** - Advanced navigation controls with keyboard shortcuts
- **Ruler Example** - Measurement tools and overlays
- **Camera Animation** - Smooth camera transitions on mouse click
- **Image Example** - Drawing an image on the pannable and zoomable canvas

### Framework Integrations
- **PixiJS Integration**
- **Konva Integration**
- **Fabric Integration**

### Advanced Features
- **Physics Example** - 2D physics simulation
- **Collision Example** - Collision detection and response
- **Bézier Curve Experiment** - Interactive curve manipulation

### Running Examples

```bash
# Clone the repository
git clone https://github.com/ue-too/ue-too.git
cd ue-too

# Install dependencies
pnpm install

# Start the development server
pnpm dev:examples
```

Visit `http://localhost:5173` to explore all examples.

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
│   └── b-curve-exp/   # Bézier curve experiment 
└── scripts/           # Build and deployment scripts
```

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Support

- [GitHub Issues](https://github.com/ue-too/ue-too/issues) - Bug reports and feature requests

> Currently not accepting contributions yet. If there's any features you want to see, please let me know by creating an issue.
