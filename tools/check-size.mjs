// Fails the check run when the card bundle exceeds the budget from the concept.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 80 * 1024;
const bundle = readFileSync('apps/cards/dist/octa-home-ui.js');
const size = gzipSync(bundle).length;

console.log(`octa-home-ui.js: ${bundle.length} B, gzip ${size} B, limit ${LIMIT_BYTES} B`);
if (size > LIMIT_BYTES) {
  console.error('Bundle exceeds the size budget');
  process.exit(1);
}
