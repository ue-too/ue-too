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
  <a href="#installation">Installation</a> •
  <a href="#examples">Examples</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#development">Development</a>
</p>

## Packages

ue-too is organized into modular packages:

### Core Packages

- **`@ue-too/being`** - Finite state machine
- **`@ue-too/board`** - Canvas viewport management with pan, zoom, and rotate functionality
- **`@ue-too/math`** - Mathematical utilities for 2D point operations, transformations, and calculations
- **`@ue-too/animate`** - Animation system for smooth transitions and keyframe animations
- **`@ue-too/dynamics`** - 2D physics engine with collision detection, rigid bodies, and constraints
- **`@ue-too/curve`** - Curve and path tools including Bézier curves, lines, and composite paths
- **`@ue-too/border`** - Geographic projection utilities (great circle, rhumb line, map projections)
- **`@ue-too/ecs`** - Entity Component System architecture support

## Install Individual Packages
```bash
# Install specific packages you need
npm install @ue-too/board @ue-too/math @ue-too/animate
```

## Examples

The monorepo includes comprehensive examples demonstrating various packages and integrations:

### Core Examples
- **Base Example** - Basic canvas functionality
- **Navigation Example** - Advanced navigation controls
- **Ruler Example** - Measurement tools and overlays
- **Camera Animation** - Smooth camera transitions
- **Image Example** - Image manipulation and display

### Framework Integrations
- **PixiJS Integration** - High-performance graphics
- **Konva Integration** - Canvas-based graphics
- **Fabric Integration** - Interactive canvas objects

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
pnpm dev
```

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

### Available Scripts
- `pnpm test` - Run all tests
- `pnpm build` - Build all packages
- `pnpm dev` - Start development server
- `pnpm changeset` - Create changeset for versioning
- `pnpm release` - Publish packages

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE.txt](LICENSE.txt) for details.

## Roadmap

### Planned Features
- [ ] React integration examples
- [ ] Vue.js integration examples  
- [ ] Svelte integration examples
- [ ] Enhanced documentation site
- [ ] Performance benchmarking tools
- [ ] Additional physics constraints
- [ ] WebGL acceleration support

## Support

- [GitHub Issues](https://github.com/ue-too/ue-too/issues) - Bug reports and feature requests
- [Discussions](https://github.com/ue-too/ue-too/discussions) - Community discussions and questions
- [Documentation](https://ue-too.github.io/ue-too/) - Complete API reference

---

<p align="center">
    Built with ❤️ by the uē-tôo team
</p>