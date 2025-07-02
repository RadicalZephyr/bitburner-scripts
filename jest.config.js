const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(.*)\\.js$': '$1',
        '^stock/(.*)$': '<rootDir>/src/stock/$1',
        '^util/(.*)$': '<rootDir>/src/util/$1',
        '^services/(.*)$': '<rootDir>/src/services/$1',
    },
    transform: {
        ...tsJestTransformCfg,
    },
    testMatch: ['<rootDir>/src/stock/**/*.test.ts'],
};
