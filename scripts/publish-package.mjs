#!/usr/bin/env node

/**
 * Wrapper script for npm publish that respects dry-run mode
 * Checks for:
 * - NX_RELEASE_DRY_RUN environment variable (set to 'true')
 * - NX_DRY_RUN environment variable (set to 'true')
 * - --dry-run command-line argument
 */

import { execSync } from "child_process";

// Check for dry-run via environment variables or command-line arguments
// Nx passes --dryRun=true (camelCase) when using --dry-run flag
const isDryRun =
  process.env.NX_RELEASE_DRY_RUN === "true" ||
  process.env.NX_DRY_RUN === "true" ||
  process.argv.some(arg => 
    arg === "--dry-run" || 
    arg === "--dryRun" || 
    arg.startsWith("--dryRun=") ||
    arg.startsWith("--dry-run=")
  );

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
    shell: process.env.SHELL || "/bin/sh",
  });
} catch (error) {
  process.exit(error.status || 1);
}
