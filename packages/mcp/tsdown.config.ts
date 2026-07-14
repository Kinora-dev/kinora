import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { mcp: 'src/mcp.ts' },
  format: ['esm'],
  platform: 'node',
  dts: false,
})
