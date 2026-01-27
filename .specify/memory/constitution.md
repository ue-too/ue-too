<!--
Sync Impact Report:
Version: 1.0.0 → 1.0.1 (PATCH update)
Ratification Date: 2025-12-25
Last Amended: 2025-12-26
Modified Principles: None (tooling clarification only)
Changes:
  - Updated all references from npm to Bun (package manager)
  - Clarified Bun is used for package management and script execution
  - Updated installation examples to use Bun
  - Updated benchmarking section to reference Bun scripts
Modified Sections:
  - II. Package Independence (publishing reference)
  - III. TypeScript Quality (publishing gate)
  - IV. Documentation Standards (installation instructions)
  - Performance Standards (benchmark script references)
Added Sections: None
Removed Sections: None
Templates Requiring Updates:
  ✅ plan-template.md - No changes needed (no npm references)
  ✅ spec-template.md - No changes needed (no npm references)
  ✅ tasks-template.md - No changes needed (no npm references)
Follow-up TODOs: None
Version Bump Rationale: PATCH - Clarification to reflect actual project tooling (Bun vs npm), no semantic changes to governance rules or principles.
-->

# ue-too Constitution

A toolkit for interactive HTML canvas applications

## Core Principles

### I. Test-First Development

**Tests are required for public APIs and critical paths, encouraged elsewhere.**

All packages MUST have comprehensive test coverage for:

- Public APIs and exported functions
- Critical rendering and transformation paths
- Canvas interaction handlers
- Core mathematical operations and algorithms

Tests are HIGHLY ENCOURAGED but not blocking for:

- Internal utility functions
- Configuration and setup code
- Simple getters/setters

**Rationale**: Pragmatic testing ensures quality and reliability for users of our libraries while maintaining development velocity. By focusing test requirements on public contracts and critical paths, we prevent breaking changes and catch regressions where they matter most—at the package boundaries that developers depend on.

### II. Package Independence

**Each package must be standalone and independently publishable with minimal cross-package coupling.**

Every package in the ue-too monorepo MUST:

- Be independently testable and runnable
- Have clear, documented purpose and scope
- Include comprehensive README with examples
- Be publishable to npm as a standalone artifact (via Bun)

Workspace dependencies (@ue-too/\*) are ALLOWED but:

- Must be minimized and well-justified
- Should follow a layered architecture (e.g., foundational packages like `math` can be depended upon, but circular dependencies are forbidden)
- Each dependency must be explicitly documented in the package README

**Rationale**: Independent packages enable developers to adopt only what they need, reducing bundle size and complexity. This modularity also improves maintainability—changes to one package shouldn't cascade across the ecosystem. Allowing workspace dependencies acknowledges the reality of a toolkit while requiring discipline to prevent tight coupling.

### III. TypeScript Quality

**Strict TypeScript configuration with comprehensive type definitions for all public APIs.**

All packages MUST:

- Use strict TypeScript configuration (`strict: true`)
- Export complete type definitions for all public APIs
- Include JSDoc comments with `@param` and `@returns` for exported functions
- Avoid `any` types in public interfaces (use `unknown` with type guards when needed)

TypeScript compiler errors are BLOCKING for:

- All pull requests
- Package builds
- Publishing to npm (via Bun)

**Rationale**: TypeScript quality directly impacts developer experience. Clear types and compiler enforcement prevent runtime errors, enable better IDE autocomplete, and serve as executable documentation. Strict typing in public APIs is especially critical for a toolkit—users should never guess what types a function accepts or returns.

### IV. Documentation Standards

**All public APIs require TypeDoc documentation; each package requires comprehensive README.**

Documentation requirements:

- **TypeDoc/JSDoc**: All exported functions, classes, types, and interfaces MUST have JSDoc comments
- **Package README**: Each package MUST include:
    - Overview and purpose
    - Installation instructions (using Bun or npm)
    - Quick start code examples
    - API reference or link to generated docs
    - Links to related packages
- **Examples**: At least one working example demonstrating primary use case
- **Automated Generation**: Documentation must be generated via TypeDoc and kept up-to-date

Optional but encouraged:

- Migration guides for breaking changes
- Advanced usage tutorials
- Performance considerations

**Rationale**: Documentation is the first touchpoint for developers evaluating our toolkit. Comprehensive READMEs enable rapid evaluation; JSDoc comments provide inline guidance in IDEs. Automated TypeDoc generation from source code ensures documentation stays synchronized with implementation, reducing maintenance burden.

### V. Performance & Canvas Optimization

**Canvas rendering must maintain 60 FPS under normal load; performance regressions require benchmarking.**

Performance requirements:

- **60 FPS Target**: All animations, pan/zoom interactions, and real-time rendering MUST maintain 60fps (16.67ms frame budget) under normal load
- **Benchmarking**: Critical paths (transformations, collision detection, physics calculations) MUST have performance benchmarks
- **Regression Testing**: Performance-sensitive changes require before/after benchmarks

Normal load is defined as:

- Up to 1000 rendered objects for board/rendering operations
- Standard desktop browser (Chrome, Firefox, Safari) on mid-range hardware
- Single viewport/canvas instance

**Rationale**: Canvas applications are inherently performance-sensitive—frame drops directly impact user experience and perceived quality. The 60fps target aligns with display refresh rates and browser rendering cycles. Benchmarking critical paths prevents performance regressions from creeping in unnoticed, especially in mathematical operations that may be called thousands of times per frame.

## Development Workflow

### Pull Request Requirements

All pull requests MUST:

- Pass CI/CD checks (TypeScript compilation, linting, tests)
- Include tests for new public APIs or bug fixes
- Update relevant documentation (README, JSDoc, examples)
- Follow conventional commit format for commit messages
- Be reviewed by at least one maintainer

Pull requests SHOULD:

- Keep changes focused and scoped to a single concern
- Include performance benchmarks for rendering/math optimizations
- Reference related issues or feature specifications

### Code Review Process

Code reviews must verify:

1. **Constitution Compliance**: Does the change align with core principles?
2. **Test Coverage**: Are public APIs and critical paths tested?
3. **Documentation**: Are READMEs and JSDoc updated?
4. **TypeScript Quality**: Are types comprehensive and strict?
5. **Performance**: For canvas/math changes, are benchmarks provided?

### Branch Naming & Commit Conventions

- **Feature branches**: `feat/feature-name` or `feat/package-name-feature`
- **Bug fixes**: `fix/issue-description` or `fix/package-name-issue`
- **Documentation**: `docs/what-changed`
- **Refactoring**: `refactor/what-changed`

Commit messages should follow conventional commits:

- `feat(package): add new feature`
- `fix(package): resolve rendering bug`
- `docs(package): update README examples`
- `perf(math): optimize vector calculations`

### CI/CD Gates

The following checks are BLOCKING for all PRs:

- TypeScript compilation (no errors)
- Linting (Prettier formatting, ESLint rules)
- Unit and integration tests (must pass)
- Package builds (must succeed)

Non-blocking but tracked:

- Test coverage percentage (trend monitoring)
- Bundle size changes (alert on significant increases)

## Security & Quality Gates

### Dependency Management

- **Monthly Reviews**: Dependencies MUST be reviewed monthly for security updates
- **Automated Alerts**: GitHub Dependabot or similar tools MUST be enabled for vulnerability scanning
- **Update Policy**: Security vulnerabilities (HIGH or CRITICAL) MUST be patched within 7 days
- **Minimal Dependencies**: Each package should minimize external dependencies; justify heavyweight dependencies

### Code Quality Tools

Required tooling:

- **Prettier**: Code formatting (enforced via pre-commit hooks or CI)
- **ESLint**: Linting for TypeScript and JavaScript
- **TypeScript Compiler**: Strict mode enabled across all packages

Configuration files MUST be:

- Shared across packages via workspace root configuration
- Versioned in the repository
- Updated consistently across the monorepo

### Security Best Practices

- Avoid runtime code generation (eval, Function constructor) unless absolutely necessary and sandboxed
- Validate all user inputs in example applications
- Document security considerations for packages that handle user data (e.g., serialization, canvas input handling)
- Include security policy in repository root (SECURITY.md)

## Performance Standards

### Canvas Rendering Requirements

- **Frame Budget**: 16.67ms (60fps) for rendering operations
- **Profiling**: Performance-sensitive changes MUST be profiled using browser DevTools
- **Optimization Priorities**:
    1. Minimize canvas state changes (save/restore, strokeStyle, fillStyle)
    2. Batch drawing operations where possible
    3. Use requestAnimationFrame for animations
    4. Implement object pooling for frequently allocated objects (vectors, matrices)

### Bundle Size Constraints

While no hard limits are enforced, packages SHOULD:

- Keep individual package sizes under 50KB minified+gzipped when practical
- Tree-shake effectively (use ES modules, avoid side effects)
- Document bundle size in README (e.g., "~12KB minified+gzipped")
- Alert on significant size increases during code review

### Benchmarking Requirements

Performance benchmarks MUST be included for:

- Mathematical operations called in tight loops (vector math, matrix transformations)
- Collision detection and spatial queries
- Physics simulation steps
- Curve tessellation and path operations

Benchmarks SHOULD:

- Use realistic datasets (e.g., 1000 objects, typical canvas size)
- Report operations per second or frame time impact
- Be automated and runnable via Bun scripts (e.g., `bun run bench`)

## Governance

### Constitutional Authority

This constitution supersedes all other development practices, conventions, or informal agreements. When conflicts arise between established patterns and constitutional principles, the constitution takes precedence.

### Amendment Process

Amendments to this constitution require:

1. **Proposal**: Document proposed change with rationale in GitHub issue or discussion
2. **Impact Analysis**: Assess impact on existing code, templates, and workflows
3. **Maintainer Approval**: Consensus among project maintainers
4. **Migration Plan**: For breaking changes to principles, provide migration guidance
5. **Version Bump**: Update constitution version according to semantic versioning rules (see below)
6. **Template Synchronization**: Update all dependent templates (plan, spec, tasks) to reflect changes

### Versioning Policy

Constitution versions follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward-incompatible governance changes (e.g., removing a principle, making tests strictly mandatory)
- **MINOR**: New principles added or existing principles materially expanded (e.g., adding new quality gates)
- **PATCH**: Clarifications, wording improvements, typo fixes, non-semantic refinements

### Compliance Reviews

Constitution compliance MUST be verified:

- **During Code Review**: Reviewers check constitutional alignment
- **During Planning**: Feature specifications must reference constitutional requirements
- **Quarterly Audits**: Project maintainers review codebase for systemic compliance issues

### Complexity Justification

When constitutional principles would be violated (e.g., adding tight coupling between packages, skipping tests for public APIs), violations MUST be:

- Explicitly documented in pull request description
- Justified with specific technical rationale
- Approved by at least two maintainers
- Tracked in the `Complexity Tracking` section of the implementation plan (plan.md)

Unjustified violations are grounds for pull request rejection.

---

**Version**: 1.0.1 | **Ratified**: 2025-12-25 | **Last Amended**: 2025-12-26
