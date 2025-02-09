import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
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
