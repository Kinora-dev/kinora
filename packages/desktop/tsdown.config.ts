import { defineConfig } from 'tsdown'

// CJS for Electron's main + preloads (most compatible; keeps sandboxed preload).
// The home renderer (Vue) is a separate Vite build; here we only build Node-side code.
export default defineConfig({
  entry: { 'main': 'src/main.ts', 'preload': 'src/preload.ts', 'home-preload': 'src/home-preload.ts' },
  format: ['cjs'],
  platform: 'node',
  dts: false,
  external: ['electron', '@kinora/server', '@kinora/core', '@kinora/trace-viewer', '@kinora/ui'],
})
