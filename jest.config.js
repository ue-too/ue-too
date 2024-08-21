/** @type {import('ts-jest').JestConfigWithTsJest} */
import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'fs';

const { compilerOptions } = JSON.parse(readFileSync(new URL('./tsconfig.json', import.meta.url), 'utf-8'));

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ["<rootDir>"],
  moduleDirectories: ["node_modules", "<rootDir>"],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths /*, { prefix: '<rootDir>/' } */),
};
// import { compilerOptions } from "./tsconfig.json" assert { type: 'json' };
// import { pathsToModuleNameMapper } from "ts-jest";


// module.exports = {
//     // collectCoverage: true,
//     preset: 'ts-jest',
//     testEnvironment: 'jsdom',
//     roots: ["<rootDir>"],
//     moduleDirectories: ["node_modules", "<rootDir>"],
//     modulePaths: [compilerOptions.baseUrl], 
//     moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths /*, { prefix: '<rootDir>/' } */),
// };

// import type {Config} from 'jest';

// const config: Config = {
//   verbose: true,
//   preset: 'ts-jest',
//   testEnvironment: 'jsdom'
// };

// export default config;