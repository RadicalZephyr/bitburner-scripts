const { createDefaultPreset } = require("ts-jest");

/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(util/.*)$': '<rootDir>/src/$1',
        '^(.*)\\.js$': '$1',
    },
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    ...createDefaultPreset()
};
