/** @type {import('ts-jest').JestConfigWithTsJest} */
import { pathsToModuleNameMapper } from 'ts-jest';
/*
  This is the "workaround" (might not be a workaround since this is probably the only way to do it) solution for the issue
  https://github.com/nrwl/nx/issues/14888
*/
import { resolve } from 'path';

// Use absolute path to avoid working directory issues
const tsconfig = require(resolve(__dirname, './tsconfig.spec.json'));

export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ["<rootDir>"],
  moduleDirectories: ["node_modules", "<rootDir>"],
  modulePaths: [tsconfig.compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: '<rootDir>/' }),
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/core'
}; 
