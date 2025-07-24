import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from "@rollup/plugin-terser";
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      }
    ],
    plugins: [
      resolve(),
      typescript({
        tsconfig: path.join(__dirname, 'tsconfig.lib.json'),
        declaration: true,
        declarationDir: path.join(__dirname, 'build'),
        exclude: ["node_modules", "dist", "build", "tests/**/*"],
      }),
      terser(),
    ],
    external: [],
  }
]; 