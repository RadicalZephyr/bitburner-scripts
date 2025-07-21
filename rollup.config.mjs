import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';

const sodiumConfig = {
    input: 'src/lib/sodium.js',
    external: ['typescript-collections', 'sanctuary-type-classes'],
    output: {
        dir: 'dist/',
        format: 'esm',
    },
    plugins: [resolve()],
};

const sanctuaryConfig = {
    input: 'src/lib/sanctuary-type-classes.js',
    output: {
        dir: 'dist/',
        format: 'esm',
    },
    plugins: [resolve(), commonjs()],
};

const collectionsConfig = {
    input: 'src/lib/typescript-collections.js',
    output: {
        dir: 'dist/',
        format: 'esm',
    },
    plugins: [resolve({ browser: true })],
};

export default [sodiumConfig, sanctuaryConfig, collectionsConfig];
