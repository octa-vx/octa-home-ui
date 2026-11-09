import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    target: 'es2021',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'octa-home-ui.js',
    },
  },
});
