import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { playback: 'src/playback.ts' },
  format: ['esm'],
  platform: 'node',
  dts: false,
})
