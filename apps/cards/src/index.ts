import { registerStrategies } from '@octa/strategy';
import { registerWidgets } from '@octa/widgets';

declare const __VERSION__: string;

const FONT_FILE = './fonts/manrope-latin-wght-normal.woff2';

/** The font ships next to the bundle, nothing is fetched from outside. It only loads when the theme asks for it. */
function registerFont(): void {
  if (document.getElementById('octa-font')) return;
  const style = document.createElement('style');
  style.id = 'octa-font';
  style.textContent = `@font-face {
  font-family: Manrope;
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
  src: url('${new URL(FONT_FILE, import.meta.url).href}') format('woff2');
}`;
  document.head.append(style);
}

registerFont();
registerWidgets();
registerStrategies();
console.info(`octa-home-ui ${__VERSION__}`);
