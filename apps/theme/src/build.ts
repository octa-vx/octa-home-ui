import { mkdirSync, writeFileSync } from 'node:fs';
import { themeYaml } from '../../../packages/tokens/src/index.ts';

const directory = new URL('../dist/themes/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('octa-home-ui.yaml', directory), themeYaml());
