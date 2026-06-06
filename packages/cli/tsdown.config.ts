import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { kinora: 'src/kinora.ts' },
  format: ['esm'],
  platform: 'node',
  dts: false,
})
