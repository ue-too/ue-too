/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    rootDir: '.',
    testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/test/**/*.test.tsx'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    transform: {
      '^.+\\.(ts|tsx)$': ['ts-jest', {
        useESM: true,
        tsconfig: 'tsconfig.spec.json'
      }]
    },
    moduleNameMapper: {
      '^@ue-too/(.*)$': '<rootDir>/../../packages/$1/src',
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
};

