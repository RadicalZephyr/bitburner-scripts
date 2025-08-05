import { createDefaultPreset } from 'ts-jest';

/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    modulePaths: ['<rootDir>/src/'],
    moduleNameMapper: {
        '^(util/.*)$': '<rootDir>/src/$1',
        '^(.*)\\.js$': '$1',
    },
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    ...createDefaultPreset(),
};
