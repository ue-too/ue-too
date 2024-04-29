/** @type {import('ts-jest').JestConfigWithTsJest} */
// import { compilerOptions } from "./tsconfig.paths.json";
const { compilerOptions } = require("./tsconfig.json");
const { pathsToModuleNameMapper } = require("ts-jest");


module.exports = {
    // collectCoverage: true,
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ["<rootDir>"],
    moduleDirectories: ["node_modules", "<rootDir>"],
    modulePaths: [compilerOptions.baseUrl], 
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths /*, { prefix: '<rootDir>/' } */),
};

// import type {Config} from 'jest';

// const config: Config = {
//   verbose: true,
//   preset: 'ts-jest',
//   testEnvironment: 'jsdom'
// };

// export default config;