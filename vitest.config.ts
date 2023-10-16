import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // reporters: 'verbose',
        coverage: {
            // enabled: true,
            clean: true,
            all: true,
            reporter: ['html', 'text', 'lcov', 'json'],
            provider: 'istanbul',
            exclude: [
                'content/**',
                'fixtures/**',
                'sample*/**',
                'bin.mjs',
                '_snapshots_',
                '.eslint*',
                'vitest*',
                '.prettier*',
            ],
        },
        include: ['src/**/*.test.{ts,mts}'],
        exclude: ['content/**', 'fixtures/**', 'bin.mjs', '_snapshots_'],
    },
});
