import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'build',
    emptyOutDir: true,
    target: 'es2022',
    // readable bundle for development, jake passes --minify false for firefox release
    minify: mode === 'production',
    rollupOptions: {
      input: { service: 'src/service.ts', popup: 'src/popup.ts' },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js'
      }
    }
  },

  test: {
    setupFiles: ['spec/setup.ts'],
    globals: true,
    testTimeout: 1000,
    // spies stay installed, but forget calls and implementations before every test
    mockReset: true,
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright({
        // installed Chrome stable, nothing to download
        launchOptions: { channel: 'chrome' },
        // what TZ=utc was for mocha, plus stable AM/PM formatting
        contextOptions: { timezoneId: 'UTC', locale: 'en-US' }
      }),
      instances: [{ browser: 'chromium' }]
    },
    coverage: {
      include: ['src/**/*.ts'],
      // nothing to cover in d.ts files and the re-export barrel
      exclude: ['**/*.d.ts', 'src/helpers/index.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'html']
    }
  }
}))
