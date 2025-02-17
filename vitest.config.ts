import { defineConfig } from 'vitest/config';

export default defineConfig({
    server: {
        watch: {
            followSymlinks: false,
        },
    },
    test: {
        root: 'tests',
        exclude: ['**/docs/*', '**/dist/*'],
        fileParallelism: false,
        testTimeout: 1000,
        hookTimeout: 1000,
        coverage: {
            provider: 'v8',
            exclude: [
                '**/docs/*',
                '**/dist/*',
                '.prettierrc.js',
                'tsup.config.ts',
                'vitest.config.ts',
            ],
        },
    },
});
