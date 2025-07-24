import { rmSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname, basename } from "path";
import { cwd } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the package name from the current working directory
const currentDir = basename(cwd());
const packageName = currentDir;

// Define the build directory
const buildDir = join(__dirname, `../build/packages/${packageName}`);

// Delete the package build directory if it exists
if (existsSync(buildDir)) {
  try {
    rmSync(buildDir, { recursive: true, force: true });
    console.log(`Cleaned build directory for package: ${packageName}`);
  } catch (error) {
    console.error(`Error cleaning build directory for ${packageName}:`, error);
  }
} else {
  console.log(`Build directory for ${packageName} doesn't exist, skipping cleanup`);
} 