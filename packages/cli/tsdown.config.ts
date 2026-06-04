import { defineConfig } from 'tsdown'

// @playback/core is a devDependency -> bundled into the output.
// zod is a dependency -> left external, installed alongside the published CLI.
export default defineConfig({
  entry: { playback: 'src/playback.ts' },
  format: ['esm'],
  platform: 'node',
  dts: false,
})
