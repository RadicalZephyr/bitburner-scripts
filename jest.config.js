module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^(.*)\\.js$': '$1',
    },
    transform: {},
    testMatch: ['<rootDir>/src/stock/**/*.test.ts'],
};
