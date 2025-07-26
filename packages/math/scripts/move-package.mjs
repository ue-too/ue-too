import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";
import { cwd } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json from current working directory instead of root
const packageJsonPath = join(cwd(), "package.json");
const data = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Get the package name from the current directory
const currentDir = basename(cwd());

console.log('dirname',__dirname);

// Define the root build directory and package build directory
const rootBuildDir = join(currentDir, '../dist');
// const packageBuildDir = join(rootBuildDir, `packages/${packageName}`);

// Ensure the build directory exists
mkdirSync(rootBuildDir, { recursive: true });

// Use consistent file extensions for all packages
data.main = "./index.js";
data.module = "./index.js";
data.types = "./index.d.ts";
data.scripts = { test: "echo \"Error: no test specified\" && exit 1"};
data.exports = {
    ".": {
        "types": "./index.d.ts",
        "import": "./index.js",
        "default": "./index.js"
    },
    "./package.json": "./package.json"
}

writeFileSync(join(rootBuildDir, "package.json"), JSON.stringify(data, null, 2));

// Copy README.md and LICENSE.txt if they exist
try {
  copyFileSync("../README.md", join(rootBuildDir, "README.md"));
} catch (error) {
  console.log("README.md not found, skipping...");
}

try {
  copyFileSync("../LICENSE.txt", join(rootBuildDir, "LICENSE.txt"));
} catch (error) {
  console.log("LICENSE.txt not found, skipping...");
}
