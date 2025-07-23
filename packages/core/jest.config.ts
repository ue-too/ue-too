/** @type {import('ts-jest').JestConfigWithTsJest} */
import { pathsToModuleNameMapper } from 'ts-jest';
import tsconfig from './tsconfig.spec.json';

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