# Changesets Workflow for uē-tôo Monorepo

This document describes how to use Changesets for versioning and releasing packages in the uē-tôo monorepo.

## Setup

Changesets has been configured with:
- **Version Management**: Automatic version bumping based on changeset types
- **Dist-based Publishing**: Source packages keep `workspace:*` dependencies, dist packages get actual versions
- **Changelog Generation**: Automatic changelog creation

## Workflow

### 1. Create a Changeset

When you make changes to packages, create a changeset:

```bash
pnpm changeset
```

This will:
- Show you all packages in the monorepo
- Let you select which packages were affected
- Ask for the type of change (major, minor, patch)
- Prompt for a description of the changes

### 2. Version and Build Packages

After creating changesets, version and build the packages:

```bash
pnpm version-packages
```

This command will:
- ✅ Bump package versions in source `package.json` files
- ✅ Build all packages to their `dist` folders using Nx
- ✅ Replace `workspace:*` dependencies with actual version numbers in `dist/package.json` files
- ✅ Generate changelog files
- ✅ Update the pnpm lock file

### 3. Review Changes

Check what was changed:
```bash
git status
git diff
```

### 4. Commit and Push

```bash
git add .
git commit -m "chore: version packages"
git push
```

### 5. Publish (when ready)

```bash
pnpm release
```

## Package Structure

### Source Packages (Development)
```json
{
  "dependencies": {
    "@ue-too/math": "workspace:*",
    "@ue-too/being": "workspace:*"
  }
}
```

### Dist Packages (Publishing)
```json
{
  "dependencies": {
    "@ue-too/math": "^0.6.1",
    "@ue-too/being": "^0.6.0"
  }
}
```

## Scripts

- `pnpm changeset` - Create a new changeset
- `pnpm version-packages` - Version packages, build to dist, and replace workspace deps
- `pnpm build` - Build all packages to dist folders
- `pnpm release` - Publish packages to npm
- `pnpm replace-workspace-deps` - Replace workspace dependencies with versions in dist folders

## Configuration

The Changesets configuration is in `.changeset/config.json`:
- `updateInternalDependencies: "patch"` - Updates internal dependencies when they change
- `access: "restricted"` - Packages are published as private by default

## Benefits

1. **Development Convenience**: Source packages use `workspace:*` for easy local development
2. **Publishing Ready**: Dist packages have actual version numbers for proper publishing
3. **Automatic Versioning**: No manual version management
4. **Dependency Tracking**: Internal dependencies are automatically updated
5. **Changelog Generation**: Automatic changelog creation
6. **Consistent Releases**: Standardized release process across all packages 