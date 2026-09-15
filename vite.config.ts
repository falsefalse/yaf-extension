import { defineConfig } from 'vite'

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
  }
}))
