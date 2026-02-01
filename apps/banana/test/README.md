# Tests for b-curve-exp

This directory contains unit tests for the `b-curve-exp` application.

## Test Files

- `entity-manager.test.ts` - Tests for the `EntityManager<T>` class
- `number-manager.test.ts` - Tests for the `NumberManager` class

## Running Tests

### Local Development

```bash
cd apps/b-curve-exp
pnpm test
```

### Through NX Workspace

```bash
nx test b-curve-experiment
```

### Run Specific Test File

```bash
cd apps/b-curve-exp
pnpm test test/entity-manager.test.ts
```

## Test Coverage

### EntityManager Tests

- **Constructor**: Initialization with different initial counts
- **createEntity**: Entity creation, capacity expansion, ID reuse
- **destroyEntity**: Entity destruction, error handling, state consistency
- **Edge Cases**: Rapid create/destroy cycles, stress testing
- **State Consistency**: Maintaining invariants across operations

### NumberManager Tests

- **Constructor**: Initialization with different initial counts
- **createEntity**: Entity creation, capacity expansion, ID reuse
- **destroyEntity**: Entity destruction, error handling, state consistency
- **Edge Cases**: Rapid create/destroy cycles, large initial counts
- **Comparison**: Behavior consistency with EntityManager

## Test Configuration

- **Jest Configuration**: `jest.config.js` in the app root
- **TypeScript Config**: `tsconfig.spec.json` for test-specific settings
- **Module Mapping**: Proper resolution of `@ue-too/*` workspace dependencies

## Key Test Patterns

- **Before Each**: Fresh instance creation for each test
- ** Private Access**: Testing internal state using bracket notation
- **Error Handling**: Verifying proper error throwing for invalid inputs
- **State Invariants**: Ensuring consistent state across operations
- **Edge Cases**: Testing boundary conditions and stress scenarios
