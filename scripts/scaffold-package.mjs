#!/usr/bin/env node

/**
 * Scaffold a new package in the packages folder
 * Usage: node scripts/scaffold-package.mjs <package-name>
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageName = process.argv[2];

if (!packageName) {
  console.error('Error: Package name is required');
  console.error('Usage: bun run scaffold:package <package-name>');
  process.exit(1);
}

// Validate package name (should be lowercase, alphanumeric with hyphens)
if (!/^[a-z0-9-]+$/.test(packageName)) {
  console.error('Error: Package name must be lowercase alphanumeric with hyphens only');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const packageDir = path.join(rootDir, 'packages', packageName);

console.log(`Scaffolding package "${packageName}" in packages/${packageName}...`);

// Check if directory already exists
if (fs.existsSync(packageDir)) {
  console.error(`Error: Package directory already exists: ${packageDir}`);
  process.exit(1);
}

try {
  // Create directory structure
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(packageDir, 'test'), { recursive: true });

  // Create package.json
  const packageJson = {
    name: `@ue-too/${packageName}`,
    type: 'module',
    version: '0.12.0',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/ue-too/ue-too.git'
    },
    homepage: 'https://github.com/ue-too/ue-too',
    scripts: {
      test: 'jest',
      'build:legacy': 'rm -rf dist && rollup -c rollup.config.js'
    },
    exports: {
      '.': {
        types: './src/index.ts',
        import: './src/index.ts',
        default: './src/index.ts'
      },
      './package.json': './package.json',
      './*': {
        types: './src/*/index.ts',
        import: './src/*/index.ts',
        default: './src/*/index.ts'
      }
    },
    main: './src/index.ts',
    types: './src/index.ts',
    module: './src/index.ts'
  };
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n'
  );
  console.log('✅ Created package.json');

  // Create project.json
  const projectJson = {
    name: packageName,
    $schema: '../../node_modules/nx/schemas/project-schema.json',
    sourceRoot: `packages/${packageName}/src`,
    projectType: 'library',
    targets: {
      build: {
        executor: 'nx:run-commands',
        options: {
          command: 'rm -rf dist && bun run ../../scripts/build.ts',
          cwd: `packages/${packageName}`
        }
      },
      'build:bun': {
        executor: 'nx:run-commands',
        options: {
          command: 'rm -rf dist && bun run ../../scripts/build.ts',
          cwd: `packages/${packageName}`
        }
      },
      'move-package': {
        executor: 'nx:run-commands',
        options: {
          command: 'node ../../scripts/move-package.mjs',
          cwd: `packages/${packageName}`
        }
      },
      test: {
        executor: 'nx:run-commands',
        options: {
          command: 'bun test',
          cwd: `packages/${packageName}`
        }
      },
      'nx-release-publish': {
        executor: 'nx:run-commands',
        options: {
          command: 'node ../../../scripts/publish-package.mjs',
          cwd: `packages/${packageName}/dist`
        }
      },
      'docs:build': {
        executor: 'nx:run-commands',
        options: {
          command: `rm -rf ../../docs/${packageName} && bun run typedoc --options typedoc.json --skipErrorChecking`,
          cwd: `packages/${packageName}`
        }
      }
    },
    tags: [],
    implicitDependencies: []
  };
  fs.writeFileSync(
    path.join(packageDir, 'project.json'),
    JSON.stringify(projectJson, null, 2) + '\n'
  );
  console.log('✅ Created project.json');

  // Create tsconfig.json
  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      rootDir: 'src',
      baseUrl: '.',
      outDir: 'dist',
      tsBuildInfoFile: `dist/${packageName}.tsbuildinfo`,
      declaration: true,
      module: 'ESNext',
      moduleResolution: 'bundler',
      composite: true,
      strict: true,
      types: []
    },
    include: ['src/**/*']
  };
  fs.writeFileSync(
    path.join(packageDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2) + '\n'
  );
  console.log('✅ Created tsconfig.json');

  // Create tsconfig.spec.json
  const tsconfigSpec = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      rootDir: 'src',
      baseUrl: '.',
      outDir: 'dist',
      tsBuildInfoFile: `dist/${packageName}.tsbuildinfo`,
      declaration: true
    },
    include: ['test/**/*']
  };
  fs.writeFileSync(
    path.join(packageDir, 'tsconfig.spec.json'),
    JSON.stringify(tsconfigSpec, null, 2) + '\n'
  );
  console.log('✅ Created tsconfig.spec.json');

  // Create jest.config.js
  const jestConfig = `/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.spec.json'
    }]
  },
  moduleNameMapper: {
    '^@ue-too/(.*)$': '<rootDir>/../$1/src'
  }
};`;
  fs.writeFileSync(path.join(packageDir, 'jest.config.js'), jestConfig);
  console.log('✅ Created jest.config.js');

  // Create rollup.config.js
  const rollupConfig = `/**
 * @type {import('rollup').RollupOptions}
 */
import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	output: {
		file: 'dist/index.js',
		format: 'esm',
        sourcemap: true
	},
    plugins: [
        typescript({
            tsconfig: 'tsconfig.json',
            outputToFilesystem: true,
        })
    ],
    external: []
};`;
  fs.writeFileSync(path.join(packageDir, 'rollup.config.js'), rollupConfig);
  console.log('✅ Created rollup.config.js');

  // Create typedoc.json
  const typedocConfig = {
    $schema: 'https://typedoc.org/schema.json',
    extends: '../../typedoc.json',
    entryPoints: ['src/index.ts'],
    out: `../../docs/${packageName}`,
    name: `@ue-too/${packageName}`,
    readme: './README.md',
    includeVersion: true,
    categoryOrder: ['Core', 'Helpers', 'Types', '*'],
    sort: ['static-first', 'alphabetical']
  };
  fs.writeFileSync(
    path.join(packageDir, 'typedoc.json'),
    JSON.stringify(typedocConfig, null, 2) + '\n'
  );
  console.log('✅ Created typedoc.json');

  // Create src/index.ts
  const indexTs = `/**
 * @packageDocumentation
 * ${packageName.charAt(0).toUpperCase() + packageName.slice(1).replace(/-/g, ' ')} package for uē-tôo.
 */

// Export your package's public API here
export {};
`;
  fs.writeFileSync(path.join(packageDir, 'src', 'index.ts'), indexTs);
  console.log('✅ Created src/index.ts');

  // Create test file
  const testFile = `describe('${packageName}', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
`;
  fs.writeFileSync(
    path.join(packageDir, 'test', `${packageName}.test.ts`),
    testFile
  );
  console.log('✅ Created test file');

  // Create README.md
  const readme = `# @ue-too/${packageName}

Description of the ${packageName} package.

[![npm version](https://img.shields.io/npm/v/@ue-too/${packageName}.svg)](https://www.npmjs.com/package/@ue-too/${packageName})
[![license](https://img.shields.io/npm/l/@ue-too/${packageName}.svg)](https://github.com/ue-too/ue-too/blob/main/LICENSE.txt)

## Overview

TODO: Add package overview

## Installation

Using Bun:
\`\`\`bash
bun add @ue-too/${packageName}
\`\`\`

Using npm:
\`\`\`bash
npm install @ue-too/${packageName}
\`\`\`

## Quick Start

TODO: Add quick start example

## API Reference

For complete API documentation with detailed type information, see the [TypeDoc-generated documentation](/${packageName}/).

## License

MIT

## Repository

[https://github.com/ue-too/ue-too](https://github.com/ue-too/ue-too)
`;
  fs.writeFileSync(path.join(packageDir, 'README.md'), readme);
  console.log('✅ Created README.md');

  console.log(`\n✅ Successfully scaffolded package "${packageName}"`);
  console.log(`\nYou can now:`);
  console.log(`  - Edit src/index.ts to add your code`);
  console.log(`  - Run tests: bun nx test ${packageName}`);
  console.log(`  - Build: bun nx build ${packageName}`);
} catch (error) {
  console.error(`\n❌ Failed to scaffold package: ${error.message}`);
  process.exit(1);
}

