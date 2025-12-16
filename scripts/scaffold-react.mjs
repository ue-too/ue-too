#!/usr/bin/env node

/**
 * Scaffold a new React application with Vite in the apps folder
 * Usage: node scripts/scaffold-react.mjs <project-name>
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectName = process.argv[2];

if (!projectName) {
  console.error('Error: Project name is required');
  console.error('Usage: bun run scaffold:react <project-name>');
  process.exit(1);
}

const directory = `apps/${projectName}`;

console.log(`Scaffolding React app "${projectName}" in ${directory}...`);

try {
  execSync(
    `bun nx g @nx/react:app ${projectName} --bundler=vite --directory=${directory} --e2eTestRunner=none`,
    {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    }
  );

  // Add dev target to project.json
  const projectJsonPath = path.resolve(__dirname, '..', directory, 'project.json');
  if (fs.existsSync(projectJsonPath)) {
    const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    if (!projectJson.targets) {
      projectJson.targets = {};
    }
    if (!projectJson.targets.dev) {
      projectJson.targets.dev = {
        executor: 'nx:run-commands',
        options: {
          command: 'vite',
          cwd: directory
        }
      };
      fs.writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2) + '\n');
      console.log(`\n✅ Added dev target to project.json`);
    }
  }

  // Create package.json for the project
  const packageJsonPath = path.resolve(__dirname, '..', directory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    const packageJson = {
      name: `@ue-too/${projectName}`,
      type: 'module',
      version: '0.5.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      }
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`\n✅ Created package.json`);
  }

  // Remove prettier config files if they were created
  const rootDir = path.resolve(__dirname, '..');
  const prettierRc = path.join(rootDir, '.prettierrc');
  const prettierIgnore = path.join(rootDir, '.prettierignore');
  
  if (fs.existsSync(prettierRc)) {
    fs.unlinkSync(prettierRc);
    console.log(`\n✅ Removed .prettierrc`);
  }
  if (fs.existsSync(prettierIgnore)) {
    fs.unlinkSync(prettierIgnore);
    console.log(`\n✅ Removed .prettierignore`);
  }

  console.log(`\n✅ Successfully scaffolded React app "${projectName}"`);
  console.log(`\nYou can now run:`);
  console.log(`  bun nx dev ${projectName}`);
} catch (error) {
  console.error(`\n❌ Failed to scaffold React app: ${error.message}`);
  process.exit(1);
}

