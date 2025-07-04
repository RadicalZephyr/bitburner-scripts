const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(.*)\\.js$': '$1',
    },
    transform: {
        ...tsJestTransformCfg,
    },
    testMatch: ['<rootDir>/src/**/*.test.ts'],
};
