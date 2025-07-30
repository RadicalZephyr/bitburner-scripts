const { createDefaultPreset } = require('ts-jest');
const baseConfig = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
    reporters: ['summary'],
    ...baseConfig,
    ...createDefaultPreset(),
};
