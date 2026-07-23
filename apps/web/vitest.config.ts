import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      globals: true,
      /**
       * Router tests mount lazily-loaded pages, and a cold chunk can take several
       * seconds under a full-suite run. Their `findBy` calls already wait 5s, so the
       * per-test budget has to sit well above that: when the two are equal, the test
       * timeout fires first and vitest reports a bare "timed out", discarding the
       * matcher's diagnostic and making a slow chunk look like a missing element.
       */
      testTimeout: 20000,
      coverage: {
        provider: 'v8',
      },
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
