// Creates dist/octa-home-ui.zip. The name has no version on purpose: HACS downloads every file of a
// release and keeps what it does not overwrite, so a versioned name would pile up on each update.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { zipSync } from 'fflate';

const files = {
  'www/octa-home-ui/octa-home-ui.js': 'apps/cards/dist/octa-home-ui.js',
  'themes/octa-home-ui.yaml': 'apps/theme/dist/themes/octa-home-ui.yaml',
  'INSTALL.md': 'INSTALLATION.de.md',
  'INSTALL.en.md': 'INSTALLATION.md',
  // Outside of www/, which Home Assistant serves without a login.
  'octa-home-ui-docs/YAML-REFERENZ.md': 'docs/YAML-REFERENCE.de.md',
  'octa-home-ui-docs/YAML-REFERENCE.md': 'docs/YAML-REFERENCE.md',
  'octa-home-ui-docs/EXAMPLES.md': 'EXAMPLES.md',
  'octa-home-ui-docs/EXAMPLES.de.md': 'EXAMPLES.de.md',
  'octa-home-ui-docs/examples/cards.yaml': 'examples/cards.yaml',
  'octa-home-ui-docs/examples/dashboard-strategy.yaml': 'examples/dashboard-strategy.yaml',
  'octa-home-ui-docs/examples/room-section.yaml': 'examples/room-section.yaml',
  'www/octa-home-ui/fonts/manrope-latin-wght-normal.woff2': 'node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
  'www/octa-home-ui/THIRD_PARTY_LICENSES.txt': 'apps/cards/THIRD_PARTY_LICENSES.txt',
  'www/octa-home-ui/fonts/OFL.txt': 'node_modules/@fontsource-variable/manrope/LICENSE',
};

// A fixed timestamp makes identical input produce an identical archive.
const mtime = new Date('2026-01-01T00:00:00Z');
const entries = Object.fromEntries(
  Object.entries(files).map(([name, source]) => [name, [readFileSync(source), { mtime }]]),
);

mkdirSync('dist', { recursive: true });
const target = 'dist/octa-home-ui.zip';
const archive = zipSync(entries, { level: 9 });
writeFileSync(target, archive);
console.log(`${target}: ${archive.length} B`);
