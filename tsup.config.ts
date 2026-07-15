import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/react/index.ts', 'src/server.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react']
  },
  {
    // Self-contained vanilla `<script>` widget. No `react` external — the
    // bundle must be fully self-contained so it mounts on any site.
    entry: { 'widget/inletbase-chat': 'src/widget/embed.ts' },
    format: ['iife'],
    platform: 'browser',
    minify: true,
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    // Force the IIFE artifact to be `dist/widget/inletbase-chat.js`
    // (tsup would otherwise emit `.global.js` for the iife format).
    outExtension: () => ({ js: '.js' })
  }
]);
