import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/command.ts',
    'src/invariant.ts',
    'src/types.ts',
  ],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: true,
  deps: {
    neverBundle: [/^@deepseek-ai\//u],
  },
})
