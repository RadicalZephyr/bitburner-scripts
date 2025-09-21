import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
    // ⛔️ Ignore vendored code entirely
    {
        ignores: [
            'src/lib/typescript-collections**',
            'src/lib/sodium**',
            'src/**/*.test.ts',
            'src/jest-shim.ts'
        ],
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    reactHooks.configs['recommended-latest'],
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Disallow unhandled/un-awaited promises
            "@typescript-eslint/no-floating-promises": "warn"
        }

    }
);
