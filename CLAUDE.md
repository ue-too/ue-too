# ue-too Project Memory

A toolkit for interactive HTML canvas applications.

## Project Overview

@README.md

## Package Manager

**This project uses Bun (not npm/pnpm).**

All package management and script execution uses Bun:
- Install dependencies: `bun install`
- Run scripts: `bun run <script-name>`
- Add packages: `bun add <package-name>`

## Project Structure

```
ue-too/
├── packages/           # Independent, publishable packages
│   ├── math/          # Mathematical utilities (foundational)
│   ├── being/         # Finite state machine (foundational)
│   ├── board/         # Canvas viewport management
│   ├── animate/       # Animation system
│   ├── dynamics/      # 2D physics engine
│   ├── curve/         # Curve and path tools
│   ├── border/        # Geographic projections
│   ├── ecs/           # Entity Component System
│   └── board-react-adapter/  # React integration
├── apps/              # Example applications
│   ├── examples/      # Interactive demos
│   └── ...
└── scripts/           # Build and deployment scripts
```

## Common Commands

### Development
- `bun install` - Install all dependencies
- `bun test` - Run tests across all packages
- `bun run build` - Build all packages
- `bun run build:packages` - Build packages only
- `bun run build:apps` - Build apps only
- `bun run dev:examples` - Start example development server

### Package-Level Commands
Navigate to `packages/<package-name>` and run:
- `bun run test` - Run package tests
- `bun run docs:build` - Generate TypeDoc documentation (if configured)

### Publishing
- `bun run bump-version` - Bump package versions (via nx release)
- `bun run publish-packages` - Publish to npm

## Development Standards

### Testing Approach
- **Required**: Tests for public APIs and critical paths
- **Encouraged**: Tests for internal utilities and edge cases
- Focus on package boundaries and preventing breaking changes
- Use Jest for testing

### Package Independence
- Each package must be independently publishable to npm
- Workspace dependencies (@ue-too/*) allowed but minimized
- Follow layered architecture:
  - Foundational packages (`math`, `being`, `ecs`) have zero internal deps
  - Mid-level packages depend on foundational packages
  - Integration packages depend on mid-level packages
- Document all cross-package dependencies in README

### TypeScript Standards
- **Strict mode required** (`strict: true`) in all packages
- All public APIs must have complete type definitions
- JSDoc comments required for all exported functions/classes/types
- Avoid `any` types in public interfaces (use `unknown` with guards)
- TypeScript errors are BLOCKING for PRs and builds

### Documentation Requirements
- **JSDoc/TypeDoc**: All exports require comprehensive JSDoc comments
  - Include @param and @returns tags
  - Add @example with realistic usage
  - Use @remarks for important notes
- **README per package**: Must include:
  - Overview and purpose
  - Installation (both Bun and npm)
  - Quick start examples
  - API reference or link to generated docs
  - Links to related packages
- **Automated generation**: Use TypeDoc for API docs

### Performance Standards
- **60 FPS target**: Canvas operations should maintain 60fps (16.67ms frame budget)
- **Benchmarking**: Add benchmarks for critical paths (math ops, collisions, physics)
- Profile performance-sensitive changes with browser DevTools
- Document bundle sizes in package READMEs

## Code Style

### TypeScript
- Use strict TypeScript configuration
- 2-space indentation (check `.prettierrc` for specifics)
- Follow conventional commits format:
  - `feat(package): description`
  - `fix(package): description`
  - `docs(package): description`
  - `perf(package): description`

### Documentation
- Write JSDoc that adds value beyond what types show
- Explain "why" not "what"
- Document edge cases and performance considerations
- Include realistic examples in @example blocks
- Use @group tags to organize API documentation by category

Example:
```typescript
/**
 * Calculates the magnitude (length) of a vector.
 *
 * @param a - Vector to measure
 * @returns The magnitude of the vector
 *
 * @remarks
 * Uses the Euclidean distance formula: √(x² + y² + z²)
 *
 * @example
 * ```typescript
 * const v = { x: 3, y: 4 };
 * const mag = PointCal.magnitude(v); // 5
 * ```
 *
 * @group Vector Operations
 */
```

## Git Workflow

### Branch Naming
- `feat/feature-name` - New features
- `feat/package-name-feature` - Package-specific features
- `fix/issue-description` - Bug fixes
- `docs/what-changed` - Documentation updates
- `perf/what-improved` - Performance improvements

### Pull Requests Must Include
- Tests for new public APIs or bug fixes
- Updated documentation (README, JSDoc, examples)
- Passing CI/CD checks (TypeScript, linting, tests)
- Performance benchmarks for rendering/math optimizations (if applicable)

### Commit Messages
Follow conventional commits:
```bash
feat(math): add vector projection function
fix(board): resolve camera rotation issue
docs(animate): update README with new examples
perf(dynamics): optimize collision detection
```

## Package Development Guidelines

### Creating New Packages
1. Package must have clear, documented purpose
2. Include comprehensive README
3. Add TypeDoc configuration (`typedoc.json`)
4. Set up tests (Jest or Vitest)
5. Ensure TypeScript strict mode
6. Document in root README

### Publishing Packages
All packages are published to npm as `@ue-too/<package-name>`:
- Packages must build successfully
- All tests must pass
- TypeScript must compile without errors
- Documentation must be complete

### Dependencies
- **Minimize external dependencies** - Justify heavyweight additions
- **Workspace dependencies** - Document @ue-too/* dependencies in README
- **Layered architecture**:
  - Foundational: `math`, `being`, `ecs` (zero internal deps)
  - Mid-level: `board`, `animate`, `curve`, `border` (depend on foundational)
  - Integration: `board-react-adapter` (depends on mid-level)

## Testing

### Philosophy
Pragmatic testing approach:
- **Required**: Public APIs and critical paths
- **Encouraged**: Internal utilities and edge cases
- **Focus**: Package boundaries and preventing breaking changes

### Running Tests
```bash
# All packages
bun test

# Specific package
cd packages/math
bun run test

# With Nx
nx run-many --target=test
```

## Performance Considerations

### Canvas Applications
- Maintain 60fps (16.67ms frame budget)
- Minimize canvas state changes
- Batch drawing operations
- Use requestAnimationFrame for animations
- Implement object pooling for frequently allocated objects

### Critical Paths Requiring Benchmarks
- Mathematical operations in tight loops (vector math, transformations)
- Collision detection and spatial queries
- Physics simulation steps
- Curve tessellation and path operations

### Bundle Size
- Keep packages under 50KB minified+gzipped when practical
- Use ES modules for tree-shaking
- Document bundle sizes in package READMEs
- Alert on significant size increases in code review

## TypeDoc Documentation

### Configuration
Each package with public APIs should have `typedoc.json`:
```json
{
  "$schema": "https://typedoc.org/schema.json",
  "extends": "../../typedoc.json",
  "entryPoints": ["src/index.ts"],
  "out": "../../docs/<package-name>",
  "name": "@ue-too/<package-name>",
  "readme": "./README.md",
  "includeVersion": true,
  "categorizeByGroup": true
}
```

### Generating Documentation
```bash
cd packages/<package-name>
bun run docs:build
```

### Organization
Use @group tags to organize API documentation:
- `@group Vector Arithmetic`
- `@group Transformations`
- `@group Geometric Calculations`
- etc.

## Monorepo Management

This project uses:
- **Nx** - Build orchestration and task running
- **Bun workspaces** - Package management
- **pnpm** - Fallback compatibility (check package.json)

### Building
```bash
# Build all packages in parallel
bun run build

# Build affected packages only
bun run build:affected

# Build specific package
nx build <package-name>
```

## Security

- GitHub Dependabot enabled for vulnerability scanning
- Security vulnerabilities (HIGH/CRITICAL) must be patched within 7 days
- Dependencies reviewed monthly
- Validate user inputs in example applications

## Resources

- **Main README**: @README.md
- **License**: MIT - see LICENSE.txt
- **Issues**: https://github.com/ue-too/ue-too/issues
- **Examples**: https://ue-too.github.io/ue-too/

## Important Notes

- **Not accepting contributions yet** - Feature requests and bug reports welcome via GitHub issues
- **Node version**: 22.19.0 (see engines in package.json)
- **Bun required** - This project uses Bun as the primary package manager
- All packages remain compatible with npm/pnpm for end users installing them
