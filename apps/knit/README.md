# Tests for knit

This directory contains unit tests for the knit application.

## Running tests

From the app directory:

```bash
bun test
```

From the repo root:

```bash
nx test knit
```

## Configuration

- **Jest**: `jest.config.js` in the app root
- **TypeScript**: `tsconfig.spec.json` for test-specific settings
- **Module mapping**: `@ue-too/*` workspace packages resolve to `packages/*/src`
