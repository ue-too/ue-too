#!/usr/bin/env node

/**
 * Wrapper script for npm publish that respects NX_RELEASE_DRY_RUN environment variable
 * When NX_RELEASE_DRY_RUN is set to 'true', adds --dry-run flag to npm publish
 */

import { execSync } from "child_process";

const isDryRun = process.env.NX_RELEASE_DRY_RUN === "true";

const baseCommand = "npm publish --access public --registry https://registry.npmjs.org --no-git-checks";
const command = isDryRun ? `${baseCommand} --dry-run` : baseCommand;

console.log(`Executing: ${command}`);
if (isDryRun) {
  console.log("(DRY RUN MODE - no packages will be published)");
}

try {
  execSync(command, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch (error) {
  process.exit(error.status || 1);
}
