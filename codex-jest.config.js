import baseConfig from './jest.config.js';

/** @type {import('jest').Config} */
export default {
    reporters: ['summary'],
    ...baseConfig,
};
