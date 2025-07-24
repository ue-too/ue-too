import { renameSync, existsSync } from "fs";
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

// Rename files from .cjs.js/.esm.js to .cjs/.mjs
const filesToRename = [
  { from: 'index.cjs.js', to: 'index.cjs' },
  { from: 'index.esm.js', to: 'index.mjs' }
];

filesToRename.forEach(({ from, to }) => {
  const fromPath = join(buildDir, from);
  const toPath = join(buildDir, to);
  
  if (existsSync(fromPath)) {
    try {
      renameSync(fromPath, toPath);
      console.log(`Renamed ${from} to ${to}`);
    } catch (error) {
      console.error(`Error renaming ${from} to ${to}:`, error);
    }
  } else {
    console.log(`File ${from} not found, skipping rename`);
  }
}); 