# ue-too

A toolkit for interactive HTML canvas applications.

## Tooling

- **Package manager & runtime**: Bun — always use `bun` instead of `npm`, `pnpm`, `yarn`, or `node`. Use `bun install`, `bun run <script>`, `bun add <pkg>`, `bun test`, etc.
- **Monorepo**: Nx for build orchestration, Bun workspaces for package management. **Always run package/app tasks from the repo root via Nx** (e.g. `bunx nx test math`, `bunx nx build board`) — do NOT `cd` into a package directory and run `bun run <script>` directly
- **Test framework**: Vitest
- **Build**: Packages are bundled with `Bun.build()` (via `scripts/build.ts`) + `tsc --emitDeclarationOnly` for type declarations. Apps are bundled with Vite
- **Formatting**: Prettier — 4-space indentation, single quotes, trailing comma `es5` (see `.prettierrc`)
- **Docs**: TypeDoc with `@group` tags for API organization
- **Publishing**: Changesets (`bun run version-packages`, `bun run release`)
- **Node**: 22.19.0 (see `engines` in package.json)

## Commands

```bash
bun install              # Install dependencies
bun test                 # Run tests (all packages, via Nx)
bun run build            # Build all packages
bun run build:apps       # Build all apps
bun run build:affected   # Build only affected packages
bun run dev:examples     # Dev server for examples
bun run format           # Format with Prettier
bun run format:check     # Check formatting
bun run docs:build       # Generate TypeDoc docs for all packages
bun run scaffold:package # Scaffold a new package
bun run scaffold:react   # Scaffold a new React app
bun run scaffold:vue     # Scaffold a new Vue app
```

## Project Structure

```
packages/
  Foundational (zero internal deps):
    math/           — 2D point operations, vector math, transformations
    being/          — Finite state machine
    ecs/            — Entity Component System

  Mid-level (depend on foundational):
    board/          — Canvas viewport (pan, zoom, rotate)
    animate/        — Animation system
    dynamics/       — 2D physics engine
    curve/          — Bezier curves, lines, composite paths
    border/         — Geographic projections

  Integration (depend on mid-level):
    board-react-adapter/
    board-vue-adapter/
    board-pixi-integration/
    board-pixi-react-integration/
    board-konva-integration/
    board-fabric-integration/
    board-game-engine/

apps/
    examples/       — Interactive demos (https://ue-too.github.io/ue-too/)
    blast/          — Tabletop game prototype maker (WIP)
    board-react/    — React example app
    board-vue/      — Vue example app
```

Graduated apps (now in their own repos): banana (https://github.com/ue-too/banana), knit, horse-racing.

## Standards

### TypeScript

- Strict mode required in all packages
- All public APIs need complete type definitions and JSDoc
- Avoid `any` in public interfaces
- TypeScript errors are blocking

### Testing

- **Required**: Public APIs and critical paths
- **Encouraged**: Internal utilities and edge cases
- Focus on package boundaries and preventing breaking changes

### Performance

- 60 FPS target for canvas operations (16.67ms frame budget)
- Benchmark critical paths (vector math, collision detection, physics steps)

### Packages

- Each package independently publishable to npm as `@ue-too/<name>`
- Minimize external and workspace dependencies
- Follow the layered architecture (foundational → mid-level → integration)

## Git

### Commits

Conventional commits scoped to package or app:

```
feat(math): add vector projection function
fix(board): resolve rotation origin offset
docs(animate): update README with new examples
```

### Branches

`feat/`, `fix/`, `docs/`, `perf/` + descriptive name (e.g. `feat/examples-navigation`, `fix/board-rotation`)

### PRs

- Tests for new public APIs or bug fixes
- Updated documentation if applicable
- Passing CI checks
