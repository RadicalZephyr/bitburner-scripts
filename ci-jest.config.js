const baseConfig = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
    reporters: [['github-actions', { silent: false }], 'summary'],
    ...baseConfig,
};
