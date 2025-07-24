import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Define the root build directory
const rootBuildDir = path.resolve(__dirname, '../../build');
const packageBuildDir = path.join(rootBuildDir, 'packages/math');

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: path.join(packageBuildDir, 'index.cjs'),
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: path.join(packageBuildDir, 'index.mjs'),
        format: 'esm',
        sourcemap: true,
      }
    ],
    plugins: [
      resolve(),
      typescript({
        tsconfig: path.join(__dirname, 'tsconfig.lib.json'),
        declaration: true,
        declarationDir: packageBuildDir,
        exclude: ["node_modules", "dist", "build", "tests/**/*"],
      }),
      terser(),
    ],
    external: [],
  }
]; 