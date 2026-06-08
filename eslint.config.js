import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  astro: true,
  // Vendored from microsoft/playwright (Apache-2.0): don't lint upstream code.
  ignores: [
    'packages/trace-viewer/src/core/**',
    'packages/trace-viewer/src/sw/**',
    'packages/trace-viewer/src/sw-main.ts',
    'packages/trace-viewer/public/sw.bundle.js',
  ],
})
