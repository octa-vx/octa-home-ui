import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, lightStateColors, oklchToHex, primaryScale, themeVariables, themeYaml, tokensCss, type ColorSet, type Mode } from './index.ts';

const modes: Mode[] = ['light', 'dark'];
const TEXT = 4.5;
const NON_TEXT = 3;

const pairs: [keyof ColorSet, keyof ColorSet, number][] = [
  ['text', 'surface', TEXT],
  ['textMuted', 'surface', TEXT],
  ['accent', 'surface', TEXT],
  ['danger', 'surface', TEXT],
  ['warning', 'surface', TEXT],
  ['text', 'well', TEXT],
  ['textMuted', 'well', TEXT],
  ['accent', 'well', TEXT],
  ['danger', 'well', TEXT],
  ['warning', 'well', TEXT],
  ['onAccent', 'accent', TEXT],
  ['outline', 'surface', NON_TEXT],
  ['fillBottom', 'surface', NON_TEXT],
  ['accent', 'knobTop', TEXT],
  ['accent', 'knobBottom', TEXT],
  ['onAccent', 'loudTop', TEXT],
  ['onAccent', 'loudBottom', TEXT],
  ['text', 'knobTop', TEXT],
  ['text', 'knobBottom', TEXT],
  ['textMuted', 'knobTop', TEXT],
  ['textMuted', 'knobBottom', TEXT],
  ['danger', 'knobTop', TEXT],
  ['danger', 'knobBottom', TEXT],
  ['text', 'wellSoft', TEXT],
  ['textMuted', 'wellSoft', TEXT],
];

describe('color math', () => {
  it('converts the extremes', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
  });

  it('rejects other formats', () => {
    expect(() => oklchToHex('#fff')).toThrow();
  });
});

describe.each(modes)('contrast in %s mode', (mode) => {
  it.each(pairs)('%s on %s', (foreground, background, minimum) => {
    expect(contrastRatio(colors[mode][foreground], colors[mode][background])).toBeGreaterThanOrEqual(minimum);
  });
});

describe('primary scale as HA 2026.9.4 pairs it', () => {
  const white = 'oklch(1 0 0)';
  type Step = keyof typeof primaryScale;
  const textOnFill: [Mode, Step, Step][] = [
    ['light', '40', '90'],
    ['light', '50', '95'],
    ['dark', '60', '10'],
    ['dark', '70', '05'],
  ];

  it.each(textOnFill)('%s: step %s on step %s', (_mode, text, fill) => {
    expect(contrastRatio(primaryScale[text], primaryScale[fill])).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(textOnFill)('%s: step %s on the surface', (mode, text) => {
    expect(contrastRatio(primaryScale[text], colors[mode].surface)).toBeGreaterThanOrEqual(TEXT);
  });

  it('carries white text on step 40', () => {
    expect(contrastRatio(white, primaryScale['40'])).toBeGreaterThanOrEqual(TEXT);
  });

  it('reaches the theme as hex in both modes', () => {
    for (const mode of modes) {
      expect(themeVariables(mode)['ha-color-primary-40']).toBe(oklchToHex(primaryScale['40']));
    }
  });
});

describe('state colors in light mode', () => {
  const entries = Object.entries(lightStateColors);

  it.each(entries)('%s is readable as text on the surface', (_name, color) => {
    expect(contrastRatio(color, colors.light.surface)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(entries)('%s carries the text color of filled chips', (_name, color) => {
    expect(contrastRatio(colors.light.onAccent, color)).toBeGreaterThanOrEqual(TEXT);
  });

  it('leaves the dark mode at HA defaults', () => {
    const dark = themeVariables('dark');
    for (const [name] of entries) expect(dark[name]).toBeUndefined();
  });
});

describe('outputs', () => {
  it('uses hex colors in the theme so HA can derive rgb variables', () => {
    for (const mode of modes) {
      const variables = themeVariables(mode);
      expect(variables['primary-color']).toMatch(/^#[0-9a-f]{6}$/);
      expect(Object.values(variables).join(' ')).not.toContain('oklch');
    }
  });

  it('renders both modes into the theme', () => {
    const yaml = themeYaml();
    expect(yaml).toContain('Octa Home UI:');
    expect(yaml).toContain('    light:');
    expect(yaml).toContain('    dark:');
  });

  it('never declares a variable in terms of itself', () => {
    for (const [, name, value] of tokensCss().matchAll(/(--octa-[\w-]+):\s*([^;]+);/g)) {
      expect(value).not.toMatch(new RegExp(`var\\(${name}[,)]`));
    }
  });
});
