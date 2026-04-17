---
name: migrate-app-to-standalone-repo
description: Use when extracting a mature app from the ue-too monorepo (apps/<name>/) into its own standalone git repo that consumes @ue-too/* as published npm packages
---

# Migrate ue-too App to Standalone Repo

## Overview

The ue-too monorepo is an incubator. Once an app is mature, it graduates to its own repo and consumes `@ue-too/*` as published npm packages instead of workspace deps.

**Canonical references** (read these before editing anything):
- `apps/banana` → `/Users/vincent.yy.chang/dev/banana/main` — migration commit `037b0e0` (single-commit version)
- `apps/knit` → `/Users/vincent.yy.chang/dev/azabu` — migration commits `fc35dd8` (copy), `3e85cdf` (unlink workspace deps), `79509a8` (drop project refs)

When in doubt, `git show <commit>` in the target repo and mirror the diff.

## When to Use

- User says "migrate X out", "graduate X to its own repo", "extract X", "spin off X"
- Target app is under `apps/<name>/` and all its `@ue-too/*` deps are published to npm
- User has already picked a target path (and maybe a new name — e.g. `knit` → `azabu`)

**Do NOT use for:** packages/ (those are published from the monorepo), early-stage apps still churning on ue-too library APIs.

## Pre-flight

Confirm with the user before touching files:

1. **Target path** (e.g. `/Users/vincent.yy.chang/dev/<name>`) — new or existing empty dir?
2. **Public name** — may differ from monorepo folder (knit→azabu). Affects `package.json` `name`.
3. **@ue-too version** to pin — check `packages/*/package.json` for the latest published version. All `@ue-too/*` deps should target the same version.
4. **Delete from monorepo after?** Historically both banana and knit still sit in `apps/` post-migration. Default: leave in place, ask before deleting.

## Transformation Summary

| File/Concern | Monorepo (`apps/<name>/`) | Standalone |
|---|---|---|
| `package.json` name | `@ue-too/<name>` | `<name>` (unscoped, or new name) |
| `package.json` meta | `exports`/`main`/`types`/`module` | remove; add `"private": true` |
| `@ue-too/*` deps | `"workspace:*"` | pinned semver (e.g. `^0.17.3`) |
| `test` script | `jest` | `bun test` |
| devDeps | inherited from root | add `typescript`, `vite`, prettier + plugins |
| `tsconfig.json` | `extends: "../../tsconfig.base.json"` + `references` | inline base compilerOptions, drop `references`, `outDir: "dist"` |
| `vite.config` | `outDir: resolve(join(__dirname, '../../'), 'dist')` | `outDir: resolve(__dirname, 'dist')` |
| `project.json` (Nx) | present | delete |
| `.prettierrc` / `.prettierignore` / `.gitignore` | inherited from root | copy from monorepo root |
| `bun.lock` | root only | local |
| `.git` | N/A | `git init` |

Source files (`src/`, `test/`, `routes/`, `public/`, `assets/`, `fonts/`, `scripts/`, `components.json`, `CLAUDE.md`, `README.md`, `ICONS.md`, etc.) copy over **unchanged**.

## Procedure

### 1. Copy app files

From `apps/<name>/`, copy everything **except** `node_modules/`, `dist/`, `project.json`. Include dotfiles if present.

### 2. Rewrite `package.json`

- Rename, drop publish metadata, add `"private": true`
- `"workspace:*"` → `"^X.Y.Z"` (or exact version, as azabu did) for every `@ue-too/*`
- Script: `"test": "bun test"`, add `"format"` / `"format:check"` if you copy the prettier config
- devDeps: add `typescript`, `vite`, `prettier`, `@trivago/prettier-plugin-sort-imports`, `prettier-plugin-sort-json`, `prettier-plugin-sh`, `prettier-plugin-tailwindcss` as applicable

### 3. Rewrite `tsconfig.json`

Inline `tsconfig.base.json` compilerOptions (`target`, `module`, `moduleResolution`, `composite`, `declaration`, `declarationMap`, `esModuleInterop`, `sourceMap`, `strict: true`). Drop `extends` and the entire `references` array. Change `outDir` to `"dist"`.

### 4. Adapt `vite.config.{js,ts}`

Only the `build.outDir` line changes. Leave the rest.

### 5. Standalone infra

- Copy `.prettierrc`, `.prettierignore`, `.gitignore` from monorepo root. Extend `.gitignore` with app-specific entries (banana added `*.pmtiles`, `public/tiles/`).
- (Optional) `.github/workflows/ci-test.yml` — bun install + `bun test` + `bun run build`. Copy from `/Users/vincent.yy.chang/dev/banana/main/.github/` or `/Users/vincent.yy.chang/dev/azabu/.github/`.
- Update `CLAUDE.md`: strip Nx/`bunx nx` references, replace with standalone `bun run` commands. Keep app-specific architecture sections verbatim.

### 6. Install, verify, commit

```bash
cd <target>
git init
bun install
bun test
bun run build
bun run dev   # smoke-test in browser
```

All tests should pass and build should succeed **before** the first commit. Commit message convention (matches both prior migrations):

```
feat: migrate <app> app from ue-too monorepo to standalone repo
```

### 7. Monorepo cleanup (ask first)

Delete `apps/<name>/` and the corresponding `dev:<name>` script / nx references in the monorepo **only after** the standalone repo has been running for a bit. Currently banana and knit both still sit in `apps/` — the user has not done this step, so confirm intent before removing.

## Verification Checklist

Before reporting done:

- [ ] `bun install` succeeds with no workspace-protocol errors
- [ ] `bun test` — all tests green
- [ ] `bun run build` — production build succeeds, `dist/` produced
- [ ] `bun run dev` — app loads in the browser; smoke-test the main feature
- [ ] `grep -r "workspace:" package.json` → empty
- [ ] `grep -r "tsconfig.base" tsconfig.json` → empty
- [ ] No `project.json` in the new repo
- [ ] `git log` shows one clean initial commit

## Common Gotchas

- **Jest holdover**: the monorepo `package.json` often has `"test": "jest"` even though the monorepo actually uses vitest/bun at the nx level. Always switch standalone to `bun test` — see banana CLAUDE.md note about `mock.module()` from `bun:test`.
- **`@ue-too/board` import paths**: if app imports from a subpath, verify the published package exposes it (azabu commit `dd21a24` fixed this).
- **pmtiles / large assets**: banana ships pmtiles via vite middleware. Preserve `vite.config.js` plugin block and add `*.pmtiles` to `.gitignore`.
- **Bun lockfile**: delete any stale `bun.lockb` / `package-lock.json` before running `bun install` fresh.
- **Sibling worktree layout**: banana lives at `/Users/vincent.yy.chang/dev/banana/main` (uses sibling worktree pattern). If user plans worktrees, create `<target>/main` and put the repo there. Ask.
- **Name collision**: if the new public name differs from the folder, search the app's source for the old name before committing — azabu's CLAUDE.md documents this explicitly.
