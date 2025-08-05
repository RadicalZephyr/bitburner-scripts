import baseConfig from './jest.config.js';

/** @type {import('jest').Config} */
export default {
    reporters: [['github-actions', { silent: false }], 'summary'],
    ...baseConfig,
};
