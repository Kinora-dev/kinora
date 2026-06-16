import { defineConfig } from 'tsdown'

// CJS for Electron's main + preload (most compatible; keeps sandboxed preload).
// server/menu are bundled into main; the trace-viewer dist is resolved at runtime.
export default defineConfig({
  entry: { main: 'src/main.ts', preload: 'src/preload.ts' },
  format: ['cjs'],
  platform: 'node',
  dts: false,
  external: ['electron', '@kinora/server', '@kinora/core', '@kinora/trace-viewer', '@kinora/ui'],
})
